import { and, asc, desc, eq, inArray, lte, or, sql } from "drizzle-orm"
import { db, cloudSyncJobs, cloudCacheEntries, files, projects } from "@/lib/db"
import { S3CompatibleStorageProvider } from "@/lib/cloud/providers/s3-compatible-provider"
import { getCloudWorkerRuntime } from "@/lib/cloud/runtime"
import type {
  CloudCacheEntryView,
  CloudRecentActivity,
  CloudQueueSummary,
  ConflictRecord,
  ConflictResolution,
  QueueObservability,
  SyncTask,
  SyncTaskEvent,
  SyncTaskStatus,
  SyncTaskType,
} from "@/lib/cloud/types"

const RETRYABLE: SyncTaskStatus[] = ["queued", "retrying"]
const provider = new S3CompatibleStorageProvider()

function parseMetadata(metadataJson: string | null): Record<string, unknown> | null {
  if (!metadataJson) return null
  try {
    return JSON.parse(metadataJson) as Record<string, unknown>
  } catch {
    return { raw: metadataJson }
  }
}

function getHistory(metadata: Record<string, unknown> | null): SyncTaskEvent[] {
  const history = metadata?.history
  return Array.isArray(history) ? history.filter(Boolean) as SyncTaskEvent[] : []
}

function setHistory(metadata: Record<string, unknown> | null, history: SyncTaskEvent[]) {
  return { ...(metadata ?? {}), history: history.slice(-40) }
}

function createEvent(status: SyncTaskEvent["status"], message: string, extra: Partial<SyncTaskEvent> = {}): SyncTaskEvent {
  return { at: new Date().toISOString(), status, message, ...extra }
}

function getLease(metadata: Record<string, unknown> | null) {
  const leaseOwner = typeof metadata?.leaseOwner === "string" ? metadata.leaseOwner : null
  const leaseExpiresAt = typeof metadata?.leaseExpiresAt === "string" ? new Date(metadata.leaseExpiresAt) : null
  return { leaseOwner, leaseExpiresAt }
}

function mapJob(row: typeof cloudSyncJobs.$inferSelect): SyncTask {
  const metadata = parseMetadata(row.metadataJson)
  const lease = getLease(metadata)
  return {
    id: row.id,
    type: row.type as SyncTaskType,
    localPath: row.localPath,
    remoteKey: row.remoteKey,
    status: row.status as SyncTaskStatus,
    checksumSha256: row.checksumSha256,
    bytesTotal: row.bytesTotal,
    bytesTransferred: row.bytesTransferred,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    createdAt: row.createdAt ?? new Date(),
    updatedAt: row.updatedAt ?? new Date(),
    nextRetryAt: row.nextRetryAt,
    error: row.errorMessage,
    projectId: row.projectId,
    fileId: row.fileId,
    sourceUrl: row.sourceUrl,
    metadata,
    history: getHistory(metadata),
    lastRunMs: typeof metadata?.lastRunMs === "number" ? metadata.lastRunMs : null,
    leaseOwner: lease.leaseOwner,
    leaseExpiresAt: lease.leaseExpiresAt,
  }
}

async function patchJob(jobId: string, mutate: (row: typeof cloudSyncJobs.$inferSelect, metadata: Record<string, unknown> | null) => Partial<typeof cloudSyncJobs.$inferInsert>) {
  const [current] = await db.select().from(cloudSyncJobs).where(eq(cloudSyncJobs.id, jobId)).limit(1)
  if (!current) return null
  const metadata = parseMetadata(current.metadataJson)
  const patch = mutate(current, metadata)
  const [row] = await db.update(cloudSyncJobs).set({ ...patch, updatedAt: new Date() }).where(eq(cloudSyncJobs.id, jobId)).returning()
  return row ? mapJob(row) : null
}

export async function createSyncJob(input: {
  type: SyncTaskType
  remoteKey: string
  localPath?: string | null
  checksumSha256?: string | null
  projectId?: string | null
  fileId?: string | null
  sourceUrl?: string | null
  bytesTotal?: number | null
  metadata?: Record<string, unknown>
  maxAttempts?: number
}) {
  const history = [createEvent("created", `Queued ${input.type} job`)]
  const [job] = await db.insert(cloudSyncJobs).values({
    type: input.type,
    remoteKey: input.remoteKey,
    localPath: input.localPath ?? null,
    checksumSha256: input.checksumSha256 ?? null,
    projectId: input.projectId ?? null,
    fileId: input.fileId ?? null,
    sourceUrl: input.sourceUrl ?? null,
    bytesTotal: input.bytesTotal ?? null,
    maxAttempts: input.maxAttempts ?? 5,
    status: "queued",
    metadataJson: JSON.stringify(setHistory(input.metadata ?? null, history)),
    nextRetryAt: new Date(),
  }).returning()

  return mapJob(job)
}

export async function reserveJobs(limit: number, leaseOwner = `worker-${process.pid}`, leaseMs = 60_000): Promise<SyncTask[]> {
  const rows = await db.select().from(cloudSyncJobs)
    .where(and(
      or(inArray(cloudSyncJobs.status, RETRYABLE), eq(cloudSyncJobs.status, "running")),
      or(lte(cloudSyncJobs.nextRetryAt, new Date()), sql`${cloudSyncJobs.nextRetryAt} is null`)
    ))
    .orderBy(asc(cloudSyncJobs.createdAt))
    .limit(limit * 4)

  const reserved: SyncTask[] = []
  for (const job of rows) {
    if (reserved.length >= limit) break
    const metadata = parseMetadata(job.metadataJson)
    const history = getHistory(metadata)
    const { leaseOwner: currentLeaseOwner, leaseExpiresAt } = getLease(metadata)
    const leaseActive = leaseExpiresAt && leaseExpiresAt.getTime() > Date.now()
    if (leaseActive && currentLeaseOwner && currentLeaseOwner !== leaseOwner) continue

    const [updated] = await db.update(cloudSyncJobs).set({
      status: "running",
      attempts: job.status === "running" ? job.attempts : job.attempts + 1,
      lastStartedAt: new Date(),
      updatedAt: new Date(),
      errorMessage: null,
      nextRetryAt: new Date(Date.now() + leaseMs),
      metadataJson: JSON.stringify(setHistory({
        ...(metadata ?? {}),
        leaseOwner,
        leaseExpiresAt: new Date(Date.now() + leaseMs).toISOString(),
        lastRunStartedAt: new Date().toISOString(),
      }, [
        ...history,
        createEvent("lease", `Lease acquired by ${leaseOwner}`),
        createEvent("running", `Started ${job.type} attempt ${job.status === "running" ? job.attempts : job.attempts + 1}`, { attempt: job.status === "running" ? job.attempts : job.attempts + 1 }),
      ])),
    }).where(and(eq(cloudSyncJobs.id, job.id), eq(cloudSyncJobs.updatedAt, job.updatedAt ?? new Date(job.createdAt ?? Date.now())))).returning()

    if (updated) reserved.push(mapJob(updated))
  }

  return reserved
}

export async function extendJobLease(jobId: string, leaseOwner: string, leaseMs = 60_000) {
  return patchJob(jobId, (_current, metadata) => ({
    nextRetryAt: new Date(Date.now() + leaseMs),
    metadataJson: JSON.stringify({
      ...(metadata ?? {}),
      leaseOwner,
      leaseExpiresAt: new Date(Date.now() + leaseMs).toISOString(),
      history: getHistory(metadata),
    }),
  }))
}

export async function updateJobProgress(jobId: string, update: { bytesTransferred?: number | null; message: string }) {
  return patchJob(jobId, (_current, metadata) => ({
    bytesTransferred: update.bytesTransferred ?? undefined,
    metadataJson: JSON.stringify(setHistory({ ...(metadata ?? {}), lastProgressAt: new Date().toISOString() }, [
      ...getHistory(metadata),
      createEvent("progress", update.message, { bytesTransferred: update.bytesTransferred ?? null }),
    ])),
  }))
}

export async function markJobSucceeded(jobId: string, update: { bytesTransferred?: number | null; checksumSha256?: string | null; localPath?: string | null; message?: string } = {}) {
  return patchJob(jobId, (current, metadata) => {
    const history = getHistory(metadata)
    const lastStartedAt = current.lastStartedAt ? new Date(current.lastStartedAt).getTime() : null
    const lastRunMs = lastStartedAt ? Date.now() - lastStartedAt : null
    return {
      status: "succeeded",
      bytesTransferred: update.bytesTransferred ?? undefined,
      checksumSha256: update.checksumSha256 ?? undefined,
      localPath: update.localPath ?? undefined,
      completedAt: new Date(),
      nextRetryAt: null,
      errorMessage: null,
      metadataJson: JSON.stringify(setHistory({ ...(metadata ?? {}), leaseOwner: null, leaseExpiresAt: null, lastRunMs }, [
        ...history,
        createEvent("succeeded", update.message ?? "Transfer completed"),
      ])),
    }
  })
}

export async function markJobFailed(jobId: string, errorMessage: string, retryAt?: Date | null) {
  return patchJob(jobId, (current, metadata) => {
    const history = getHistory(metadata)
    const exhausted = current.attempts >= current.maxAttempts
    return {
      status: exhausted || !retryAt ? "failed" : "retrying",
      errorMessage,
      nextRetryAt: exhausted ? null : retryAt,
      metadataJson: JSON.stringify(setHistory({ ...(metadata ?? {}), leaseOwner: null, leaseExpiresAt: null }, [
        ...history,
        createEvent(exhausted || !retryAt ? "failed" : "retrying", exhausted ? `Failed permanently: ${errorMessage}` : `Retry scheduled: ${errorMessage}`, { attempt: current.attempts }),
      ])),
    }
  })
}

async function mutateMany(statuses: SyncTaskStatus[], nextStatus: SyncTaskStatus, message: string, projectId?: string) {
  const conditions = [inArray(cloudSyncJobs.status, statuses)]
  if (projectId) conditions.push(eq(cloudSyncJobs.projectId, projectId))
  const rows = await db.select().from(cloudSyncJobs).where(and(...conditions))
  let count = 0
  for (const row of rows) {
    const updated = await patchJob(row.id, (_current, metadata) => ({
      status: nextStatus,
      nextRetryAt: nextStatus === "queued" ? new Date() : null,
      errorMessage: nextStatus === "queued" ? null : row.errorMessage,
      metadataJson: JSON.stringify(setHistory(metadata, [...getHistory(metadata), createEvent(nextStatus, message)])),
    }))
    if (updated) count += 1
  }
  return count
}

export const pauseSyncJobs = (filter: { projectId?: string } = {}) => mutateMany(["queued", "retrying", "running"], "paused", "Paused from admin controls", filter.projectId)
export const resumeSyncJobs = (filter: { projectId?: string } = {}) => mutateMany(["paused"], "queued", "Resumed from admin controls", filter.projectId)
export const cancelSyncJobs = (filter: { projectId?: string } = {}) => mutateMany(["queued", "retrying", "paused"], "cancelled", "Cancelled from admin controls", filter.projectId)
export const retrySyncJobs = (filter: { projectId?: string; onlyFailed?: boolean } = {}) => mutateMany(filter.onlyFailed ? ["failed", "cancelled"] : ["failed", "cancelled", "paused"], "queued", "Manually requeued", filter.projectId)

export async function listSyncTasks(limit = 100) {
  const rows = await db.select().from(cloudSyncJobs).orderBy(desc(cloudSyncJobs.createdAt)).limit(limit)
  return rows.map(mapJob)
}

export async function listSyncTasksFiltered(input: { limit?: number; status?: string; projectId?: string; sinceHours?: number } = {}) {
  const limit = input.limit ?? 150
  const rows = await listSyncTasks(Math.max(limit, 200))
  const since = input.sinceHours ? Date.now() - input.sinceHours * 60 * 60 * 1000 : 0
  return rows.filter((row) => {
    if (input.status && row.status !== input.status) return false
    if (input.projectId && row.projectId !== input.projectId) return false
    if (since && row.updatedAt.getTime() < since) return false
    return true
  }).slice(0, limit)
}

export async function getQueueSummary(): Promise<CloudQueueSummary> {
  const rows = await db.select({ status: cloudSyncJobs.status, type: cloudSyncJobs.type, count: sql<number>`count(*)::int` }).from(cloudSyncJobs).groupBy(cloudSyncJobs.status, cloudSyncJobs.type)
  const summary: CloudQueueSummary = { queued: 0, running: 0, paused: 0, retrying: 0, succeeded: 0, failed: 0, cancelled: 0, uploadsQueued: 0, downloadsQueued: 0 }
  for (const row of rows) {
    const count = Number(row.count ?? 0)
    if (row.status === "queued") summary.queued += count
    if (row.status === "running") summary.running += count
    if (row.status === "paused") summary.paused += count
    if (row.status === "retrying") summary.retrying += count
    if (row.status === "succeeded") summary.succeeded += count
    if (row.status === "failed") summary.failed += count
    if (row.status === "cancelled") summary.cancelled += count
    if (row.status === "queued" && row.type === "upload") summary.uploadsQueued += count
    if (row.status === "queued" && row.type === "download") summary.downloadsQueued += count
  }
  return summary
}

export async function getRecentActivity(limit = 12): Promise<CloudRecentActivity[]> {
  const rows = await db.select({
    id: cloudSyncJobs.id,
    type: cloudSyncJobs.type,
    status: cloudSyncJobs.status,
    remoteKey: cloudSyncJobs.remoteKey,
    errorMessage: cloudSyncJobs.errorMessage,
    createdAt: cloudSyncJobs.createdAt,
    updatedAt: cloudSyncJobs.updatedAt,
    projectName: projects.name,
    projectId: cloudSyncJobs.projectId,
    bytesTotal: cloudSyncJobs.bytesTotal,
    bytesTransferred: cloudSyncJobs.bytesTransferred,
    metadataJson: cloudSyncJobs.metadataJson,
  }).from(cloudSyncJobs).leftJoin(projects, eq(projects.id, cloudSyncJobs.projectId)).orderBy(desc(cloudSyncJobs.updatedAt)).limit(limit)

  return rows.map((row) => {
    const metadata = parseMetadata(row.metadataJson)
    const history = getHistory(metadata)
    const bytesTotal = Number(row.bytesTotal ?? 0)
    const bytesTransferred = Number(row.bytesTransferred ?? 0)
    const progressLabel = bytesTotal > 0 ? `${Math.min(100, Math.round((bytesTransferred / bytesTotal) * 100))}% • ${bytesTransferred}/${bytesTotal} bytes` : undefined
    return {
      id: row.id,
      title: `${row.type === "upload" ? "Upload" : row.type === "download" ? "Download" : row.type === "evict-cache" ? "Evict cache" : "Delete local cache"} ${row.projectName ? `• ${row.projectName}` : ""}`.trim(),
      detail: row.errorMessage || history.at(-1)?.message || row.remoteKey,
      status: row.status as SyncTaskStatus,
      createdAt: row.createdAt ?? new Date(),
      updatedAt: row.updatedAt ?? new Date(),
      projectName: row.projectName,
      projectId: row.projectId,
      history,
      progressLabel,
      failureCategory: row.errorMessage ? classifyFailure(row.errorMessage) : undefined,
    }
  })
}

function classifyFailure(message: string) {
  if (/checksum|mismatch/i.test(message)) return "integrity"
  if (/timeout|network|socket|429|5\d\d|slowdown/i.test(message)) return "transient"
  if (/forbidden|denied|unauthor/i.test(message)) return "auth"
  return "other"
}

export async function getQueueObservability(): Promise<QueueObservability> {
  const recent = await getRecentActivity(100)
  const minuteAgo = Date.now() - 60_000
  const completedRecently = recent.filter((item) => item.status === "succeeded" && item.updatedAt.getTime() >= minuteAgo)
  const running = (await listSyncTasksFiltered({ status: "running", limit: 20 })).map((job) => job)
  const projectIds = Array.from(new Set(recent.map((item) => item.projectId).filter(Boolean) as string[]))
  return {
    throughputPerMinute: completedRecently.length,
    recentFailures: recent.filter((item) => item.status === "failed" || item.status === "retrying").slice(0, 8),
    running,
    filters: { statuses: ["queued", "running", "paused", "retrying", "failed", "succeeded", "cancelled"], projectIds },
    worker: getCloudWorkerRuntime().snapshot(),
  }
}

export async function upsertCacheEntry(input: {
  projectId?: string | null
  fileId?: string | null
  localPath: string
  remoteKey: string
  cacheState: string
  sizeBytes?: number
  checksumSha256?: string | null
  pinned?: boolean
  lastSyncedAt?: Date | null
  evictionReason?: string | null
}) {
  const patch = {
    localPath: input.localPath,
    remoteKey: input.remoteKey,
    cacheState: input.cacheState,
    sizeBytes: input.sizeBytes ?? 0,
    checksumSha256: input.checksumSha256 ?? null,
    pinned: input.pinned ?? false,
    lastAccessedAt: new Date(),
    lastSyncedAt: input.lastSyncedAt ?? null,
    updatedAt: new Date(),
  }
  if (input.fileId) {
    const existing = await db.select().from(cloudCacheEntries).where(eq(cloudCacheEntries.fileId, input.fileId)).limit(1)
    if (existing[0]) {
      await db.update(cloudCacheEntries).set(patch).where(eq(cloudCacheEntries.id, existing[0].id))
      return
    }
  }
  await db.insert(cloudCacheEntries).values({ ...patch, projectId: input.projectId ?? null, fileId: input.fileId ?? null })
}

export async function listEvictionCandidates(limit = 50) {
  return db.select().from(cloudCacheEntries)
    .where(and(eq(cloudCacheEntries.cacheState, "resident"), eq(cloudCacheEntries.pinned, false)))
    .orderBy(asc(cloudCacheEntries.lastAccessedAt))
    .limit(limit)
}

export async function markCacheEntryEvicted(ids: string[], reason = "disk pressure") {
  if (ids.length === 0) return
  for (const id of ids) {
    await patchCacheEntryMetadata(id, { cacheState: "evicted", evictionReason: reason })
  }
}

async function patchCacheEntryMetadata(id: string, update: { cacheState?: string; pinned?: boolean; evictionReason?: string | null }) {
  const [row] = await db.select().from(cloudCacheEntries).where(eq(cloudCacheEntries.id, id)).limit(1)
  if (!row) return
  const metadata = parseMetadata((row as { metadataJson?: string | null }).metadataJson ?? null)
  await db.update(cloudCacheEntries).set({
    cacheState: update.cacheState ?? row.cacheState,
    pinned: update.pinned ?? row.pinned,
    updatedAt: new Date(),
    ...(metadata ? {} : {}),
  }).where(eq(cloudCacheEntries.id, id))
}

export async function setProjectCachePinned(projectId: string, pinned: boolean) {
  const rows = await db.select().from(cloudCacheEntries).where(eq(cloudCacheEntries.projectId, projectId))
  if (rows.length === 0) return 0
  await db.update(cloudCacheEntries).set({ pinned, updatedAt: new Date() }).where(eq(cloudCacheEntries.projectId, projectId))
  return rows.length
}

export async function setFileCachePinned(fileId: string, pinned: boolean) {
  const rows = await db.select().from(cloudCacheEntries).where(eq(cloudCacheEntries.fileId, fileId))
  if (rows.length === 0) return 0
  await db.update(cloudCacheEntries).set({ pinned, updatedAt: new Date() }).where(eq(cloudCacheEntries.fileId, fileId))
  return rows.length
}

export async function getProjectCloudSurface(projectId: string) {
  const cacheRows = await db.select({
    id: cloudCacheEntries.id,
    fileId: cloudCacheEntries.fileId,
    projectId: cloudCacheEntries.projectId,
    title: files.title,
    remoteKey: cloudCacheEntries.remoteKey,
    localPath: cloudCacheEntries.localPath,
    cacheState: cloudCacheEntries.cacheState,
    pinned: cloudCacheEntries.pinned,
    sizeBytes: cloudCacheEntries.sizeBytes,
    checksumSha256: cloudCacheEntries.checksumSha256,
    lastAccessedAt: cloudCacheEntries.lastAccessedAt,
    lastSyncedAt: cloudCacheEntries.lastSyncedAt,
  }).from(cloudCacheEntries).leftJoin(files, eq(files.id, cloudCacheEntries.fileId)).where(eq(cloudCacheEntries.projectId, projectId)).orderBy(desc(cloudCacheEntries.updatedAt))

  const cacheEntries: CloudCacheEntryView[] = cacheRows.map((row) => ({
    id: row.id,
    fileId: row.fileId,
    projectId: row.projectId,
    title: row.title || row.remoteKey.split("/").at(-1) || "Cached file",
    remoteKey: row.remoteKey,
    localPath: row.localPath,
    cacheState: row.cacheState,
    pinned: row.pinned,
    sizeBytes: Number(row.sizeBytes ?? 0),
    checksumSha256: row.checksumSha256,
    lastAccessedAt: row.lastAccessedAt,
    lastSyncedAt: row.lastSyncedAt,
    evictionReason: row.cacheState === "evicted" ? "Disk pressure or manual eviction" : null,
  }))

  const conflicts: ConflictRecord[] = []
  for (const entry of cacheEntries.slice(0, 20)) {
    try {
      const remote = await provider.head(entry.remoteKey)
      if (entry.checksumSha256 && remote?.checksumSha256 && entry.checksumSha256 !== remote.checksumSha256) {
        conflicts.push({
          fileId: entry.fileId,
          projectId: entry.projectId,
          title: entry.title,
          remoteKey: entry.remoteKey,
          remoteChecksum: remote.checksumSha256,
          localChecksum: entry.checksumSha256,
          cacheState: entry.cacheState,
          status: "conflict",
          suggestedAction: "force-upload",
          updatedAt: entry.lastSyncedAt,
        })
      }
    } catch {
      // ignore probe failures in UI surface
    }
  }

  return { cacheEntries, conflicts }
}

export async function resolveConflict(input: { projectId?: string | null; fileId?: string | null; remoteKey: string; resolution: ConflictResolution; sourceUrl?: string | null; localPath?: string | null; bytesTotal?: number | null }) {
  if (input.resolution === "skip") return { queued: false }
  await createSyncJob({
    type: input.resolution === "force-upload" ? "upload" : "download",
    projectId: input.projectId ?? null,
    fileId: input.fileId ?? null,
    remoteKey: input.remoteKey,
    sourceUrl: input.resolution === "force-upload" ? input.sourceUrl ?? null : null,
    localPath: input.resolution === "force-restore" ? input.localPath ?? null : input.localPath ?? null,
    bytesTotal: input.bytesTotal ?? null,
    metadata: { conflictResolution: input.resolution },
  })
  return { queued: true }
}

export async function getProjectFilesForCloud(projectId: string) {
  return db.select({
    id: files.id,
    title: files.title,
    blobUrl: files.blobUrl,
    size: files.fileSize,
    mimeType: files.mimeType,
    originalFilename: files.originalFilename,
    projectName: projects.name,
  }).from(files).leftJoin(projects, eq(projects.id, files.projectId)).where(eq(files.projectId, projectId)).orderBy(asc(files.createdAt))
}
