import { createHash } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { getCloudStorageConfig } from "@/lib/cloud/config"
import { S3CompatibleStorageProvider } from "@/lib/cloud/providers/s3-compatible-provider"
import { getDiskPressureSnapshot, rankEvictionCandidates } from "@/lib/cloud/server/disk-pressure"
import {
  listEvictionCandidates,
  markCacheEntryEvicted,
  markJobFailed,
  markJobSucceeded,
  reserveJobs,
  updateJobProgress,
  upsertCacheEntry,
} from "@/lib/cloud/queue-store"
import type { SyncTask } from "@/lib/cloud/types"

const provider = new S3CompatibleStorageProvider()

async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch source: ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

function checksum(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex")
}

function retryDelayMs(attempt: number) {
  const jitter = Math.floor(Math.random() * 750)
  return Math.min(90_000, 2_000 * 2 ** Math.max(0, attempt - 1)) + jitter
}

function isRetryableError(message: string) {
  return /timeout|timed out|network|socket|429|5\d\d|slowdown|temporar/i.test(message)
}

async function ensureChecksumMatch(expected: string | undefined | null, actual: string | undefined | null, phase: string) {
  if (expected && expected !== actual) {
    throw new Error(`${phase} checksum mismatch (expected ${expected}, got ${actual})`)
  }
}

async function runUpload(task: SyncTask) {
  const body = task.sourceUrl
    ? await fetchBuffer(task.sourceUrl)
    : task.localPath
      ? await readFile(task.localPath)
      : null
  if (!body) throw new Error("Upload job has no sourceUrl or localPath")

  const checksumSha256 = task.checksumSha256 || checksum(body)
  await updateJobProgress(task.id, { bytesTransferred: 0, message: `Prepared upload payload (${body.byteLength} bytes)` })

  const existing = await provider.head(task.remoteKey)
  if (existing?.checksumSha256 && existing.checksumSha256 === checksumSha256) {
    await markJobSucceeded(task.id, { bytesTransferred: existing.size, checksumSha256, message: "Remote object already matched checksum" })
    return
  }

  const stored = await provider.put({
    key: task.remoteKey,
    body,
    checksumSha256,
    multipart: body.byteLength >= 32 * 1024 * 1024,
  })
  await updateJobProgress(task.id, { bytesTransferred: stored.size, message: "Upload completed, verifying remote checksum" })

  const verified = await provider.head(task.remoteKey)
  await ensureChecksumMatch(checksumSha256, verified?.checksumSha256 || null, "Upload verification")
  await markJobSucceeded(task.id, { bytesTransferred: stored.size, checksumSha256, message: "Upload verified and stored" })

  if (task.localPath) {
    await upsertCacheEntry({
      projectId: task.projectId,
      fileId: task.fileId,
      localPath: task.localPath,
      remoteKey: task.remoteKey,
      cacheState: "resident",
      sizeBytes: stored.size,
      checksumSha256,
      lastSyncedAt: new Date(),
    })
  }
}

async function runDownload(task: SyncTask) {
  const result = await provider.get(task.remoteKey)
  const config = getCloudStorageConfig()
  const targetPath = task.localPath || path.join(config.cacheDir, task.remoteKey)
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, result.body)
  const checksumSha256 = checksum(result.body)
  await ensureChecksumMatch(result.checksumSha256, checksumSha256, "Download verification")
  await markJobSucceeded(task.id, { bytesTransferred: result.body.byteLength, checksumSha256, localPath: targetPath, message: "Download completed and checksum verified" })
  await upsertCacheEntry({
    projectId: task.projectId,
    fileId: task.fileId,
    localPath: targetPath,
    remoteKey: task.remoteKey,
    cacheState: "resident",
    sizeBytes: result.body.byteLength,
    checksumSha256,
    lastSyncedAt: new Date(),
  })
}

async function runEviction(task: SyncTask) {
  const config = getCloudStorageConfig()
  const disk = await getDiskPressureSnapshot(config.cacheDir, config.warningFreeBytes, config.criticalFreeBytes).catch(async () => getDiskPressureSnapshot(process.cwd(), config.warningFreeBytes, config.criticalFreeBytes))
  const candidates = await listEvictionCandidates()
  const targetBytes = Math.max(task.bytesTotal ?? 0, disk.suggestedEvictionBytes)
  const selected = rankEvictionCandidates(candidates.map((item) => ({ ...item, lastAccessedAt: item.lastAccessedAt ?? new Date(0), sizeBytes: item.sizeBytes ?? 0 })), targetBytes)
  for (const item of selected) {
    await rm(item.localPath, { force: true })
  }
  await markCacheEntryEvicted(selected.map((item) => item.id))
  await markJobSucceeded(task.id, {
    bytesTransferred: selected.reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0),
    message: `Evicted ${selected.length} cache item${selected.length === 1 ? "" : "s"}`,
  })
}

async function maybeQueueAutoEviction() {
  const config = getCloudStorageConfig()
  const disk = await getDiskPressureSnapshot(config.cacheDir, config.warningFreeBytes, config.criticalFreeBytes).catch(async () => getDiskPressureSnapshot(process.cwd(), config.warningFreeBytes, config.criticalFreeBytes))
  if (disk.pressureLevel !== "critical" || disk.suggestedEvictionBytes <= 0) return null

  const task: SyncTask = {
    id: "auto-evict",
    type: "evict-cache",
    remoteKey: "auto/eviction",
    status: "running",
    attempts: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    bytesTotal: disk.suggestedEvictionBytes,
    bytesTransferred: 0,
    history: [],
  }
  await runEviction(task)
  return disk.suggestedEvictionBytes
}

async function executeTask(task: SyncTask) {
  if (task.type === "upload") return runUpload(task)
  if (task.type === "download") return runDownload(task)
  if (task.type === "evict-cache" || task.type === "delete-local-cache") return runEviction(task)
  throw new Error(`Unsupported task type: ${task.type}`)
}

export async function processSyncQueue(options: { concurrency?: number } = {}) {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 2, 4))
  let autoEvictedBytes = 0
  try {
    autoEvictedBytes = (await maybeQueueAutoEviction()) ?? 0
  } catch {
    autoEvictedBytes = 0
  }

  const reserved = await reserveJobs(concurrency)
  const results = await Promise.allSettled(reserved.map(async (task) => {
    try {
      await executeTask(task)
      return { id: task.id, ok: true as const }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown sync error"
      const retryAt = isRetryableError(message) && task.attempts < (task.maxAttempts ?? 5)
        ? new Date(Date.now() + retryDelayMs(task.attempts + 1))
        : null
      await markJobFailed(task.id, message, retryAt)
      return { id: task.id, ok: false as const, error: message }
    }
  }))

  return {
    picked: reserved.length,
    succeeded: results.filter((item) => item.status === "fulfilled" && item.value.ok).length,
    failed: results.filter((item) => item.status === "fulfilled" && !item.value.ok).length,
    autoEvictedBytes,
  }
}
