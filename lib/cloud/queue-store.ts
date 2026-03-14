import { and, asc, desc, eq, inArray, lte, or, sql } from "drizzle-orm"
import { db, cloudSyncJobs, cloudCacheEntries, files, projects } from "@/lib/db"
import type { CloudRecentActivity, CloudQueueSummary, SyncTask, SyncTaskStatus, SyncTaskType } from "@/lib/cloud/types"

const RETRYABLE: SyncTaskStatus[] = ["queued", "retrying"]

function mapJob(row: typeof cloudSyncJobs.$inferSelect): SyncTask {
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
  }
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
    metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    nextRetryAt: new Date(),
  }).returning()

  return mapJob(job)
}

export async function reserveJobs(limit: number): Promise<SyncTask[]> {
  const due = await db.select().from(cloudSyncJobs)
    .where(and(
      inArray(cloudSyncJobs.status, RETRYABLE),
      or(lte(cloudSyncJobs.nextRetryAt, new Date()), sql`${cloudSyncJobs.nextRetryAt} is null`)
    ))
    .orderBy(asc(cloudSyncJobs.createdAt))
    .limit(limit)

  const reserved: SyncTask[] = []
  for (const job of due) {
    const [updated] = await db.update(cloudSyncJobs).set({
      status: "running",
      attempts: job.attempts + 1,
      lastStartedAt: new Date(),
      updatedAt: new Date(),
      errorMessage: null,
    }).where(and(eq(cloudSyncJobs.id, job.id), eq(cloudSyncJobs.status, job.status))).returning()

    if (updated) reserved.push(mapJob(updated))
  }

  return reserved
}

export async function markJobSucceeded(jobId: string, update: { bytesTransferred?: number | null; checksumSha256?: string | null; localPath?: string | null } = {}) {
  const [row] = await db.update(cloudSyncJobs).set({
    status: "succeeded",
    bytesTransferred: update.bytesTransferred ?? undefined,
    checksumSha256: update.checksumSha256 ?? undefined,
    localPath: update.localPath ?? undefined,
    completedAt: new Date(),
    nextRetryAt: null,
    errorMessage: null,
    updatedAt: new Date(),
  }).where(eq(cloudSyncJobs.id, jobId)).returning()
  return row ? mapJob(row) : null
}

export async function markJobFailed(jobId: string, errorMessage: string, retryAt?: Date | null) {
  const [current] = await db.select().from(cloudSyncJobs).where(eq(cloudSyncJobs.id, jobId)).limit(1)
  if (!current) return null

  const exhausted = current.attempts >= current.maxAttempts
  const [row] = await db.update(cloudSyncJobs).set({
    status: exhausted || !retryAt ? "failed" : "retrying",
    errorMessage,
    nextRetryAt: exhausted ? null : retryAt,
    updatedAt: new Date(),
  }).where(eq(cloudSyncJobs.id, jobId)).returning()
  return row ? mapJob(row) : null
}

export async function listSyncTasks(limit = 100) {
  const rows = await db.select().from(cloudSyncJobs).orderBy(desc(cloudSyncJobs.createdAt)).limit(limit)
  return rows.map(mapJob)
}

export async function getQueueSummary(): Promise<CloudQueueSummary> {
  const rows = await db.select({ status: cloudSyncJobs.status, type: cloudSyncJobs.type, count: sql<number>`count(*)::int` }).from(cloudSyncJobs).groupBy(cloudSyncJobs.status, cloudSyncJobs.type)
  const summary: CloudQueueSummary = { queued: 0, running: 0, retrying: 0, succeeded: 0, failed: 0, uploadsQueued: 0, downloadsQueued: 0 }
  for (const row of rows) {
    const count = Number(row.count ?? 0)
    if (row.status === "queued") summary.queued += count
    if (row.status === "running") summary.running += count
    if (row.status === "retrying") summary.retrying += count
    if (row.status === "succeeded") summary.succeeded += count
    if (row.status === "failed") summary.failed += count
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
  }).from(cloudSyncJobs).leftJoin(projects, eq(projects.id, cloudSyncJobs.projectId)).orderBy(desc(cloudSyncJobs.updatedAt)).limit(limit)

  return rows.map((row) => ({
    id: row.id,
    title: `${row.type === "upload" ? "Upload" : row.type === "download" ? "Download" : row.type === "evict-cache" ? "Evict cache" : "Delete local cache"} ${row.projectName ? `• ${row.projectName}` : ""}`.trim(),
    detail: row.errorMessage || row.remoteKey,
    status: row.status as SyncTaskStatus,
    createdAt: row.createdAt ?? new Date(),
    updatedAt: row.updatedAt ?? new Date(),
    projectName: row.projectName,
  }))
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
}) {
  if (input.fileId) {
    const existing = await db.select().from(cloudCacheEntries).where(eq(cloudCacheEntries.fileId, input.fileId)).limit(1)
    if (existing[0]) {
      await db.update(cloudCacheEntries).set({
        localPath: input.localPath,
        remoteKey: input.remoteKey,
        cacheState: input.cacheState,
        sizeBytes: input.sizeBytes ?? existing[0].sizeBytes,
        checksumSha256: input.checksumSha256 ?? existing[0].checksumSha256,
        pinned: input.pinned ?? existing[0].pinned,
        lastAccessedAt: new Date(),
        lastSyncedAt: input.lastSyncedAt ?? existing[0].lastSyncedAt,
        updatedAt: new Date(),
      }).where(eq(cloudCacheEntries.id, existing[0].id))
      return
    }
  }

  await db.insert(cloudCacheEntries).values({
    projectId: input.projectId ?? null,
    fileId: input.fileId ?? null,
    localPath: input.localPath,
    remoteKey: input.remoteKey,
    cacheState: input.cacheState,
    sizeBytes: input.sizeBytes ?? 0,
    checksumSha256: input.checksumSha256 ?? null,
    pinned: input.pinned ?? false,
    lastAccessedAt: new Date(),
    lastSyncedAt: input.lastSyncedAt ?? null,
  })
}

export async function listEvictionCandidates(limit = 50) {
  return db.select().from(cloudCacheEntries)
    .where(and(eq(cloudCacheEntries.cacheState, "resident"), eq(cloudCacheEntries.pinned, false)))
    .orderBy(asc(cloudCacheEntries.lastAccessedAt))
    .limit(limit)
}

export async function markCacheEntryEvicted(ids: string[]) {
  if (ids.length === 0) return
  await db.update(cloudCacheEntries).set({ cacheState: "evicted", updatedAt: new Date() }).where(inArray(cloudCacheEntries.id, ids))
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
