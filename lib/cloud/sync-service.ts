import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import type { StorageProvider } from "@/lib/cloud/providers/storage-provider"
import { createSyncJob, listSyncTasks, markJobFailed, markJobSucceeded, reserveJobs } from "@/lib/cloud/queue-store"
import type { SyncTask } from "@/lib/cloud/types"

export class CloudSyncService {
  constructor(private readonly provider: StorageProvider) {}

  async listTasks(): Promise<SyncTask[]> {
    return listSyncTasks()
  }

  async queueUpload(localPath: string, remoteKey: string, projectId?: string) {
    const checksumSha256 = await this.computeChecksum(localPath)
    return createSyncJob({ type: "upload", localPath, remoteKey, checksumSha256, projectId })
  }

  async queueDownload(localPath: string, remoteKey: string, projectId?: string) {
    return createSyncJob({ type: "download", localPath, remoteKey, projectId })
  }

  async queueEviction(localPath: string, remoteKey: string, projectId?: string) {
    return createSyncJob({ type: "evict-cache", localPath, remoteKey, projectId })
  }

  async processNext(): Promise<SyncTask | null> {
    const [next] = await reserveJobs(1)
    if (!next) return null

    try {
      if (next.type === "upload") {
        if (!next.localPath) throw new Error("Upload task missing local path")
        const body = await readFile(next.localPath)
        const stored = await this.provider.put({
          key: next.remoteKey,
          body,
          checksumSha256: next.checksumSha256 ?? undefined,
        })
        return await markJobSucceeded(next.id, { bytesTransferred: stored.size, checksumSha256: stored.checksumSha256 })
      }

      if (next.type === "download") {
        const result = await this.provider.get(next.remoteKey)
        return await markJobSucceeded(next.id, { bytesTransferred: result.body.byteLength, checksumSha256: result.checksumSha256 })
      }

      return await markJobSucceeded(next.id, { bytesTransferred: 0 })
    } catch (error) {
      return await markJobFailed(next.id, error instanceof Error ? error.message : "Unknown sync error")
    }
  }

  private async computeChecksum(localPath: string): Promise<string> {
    const buffer = await readFile(localPath)
    return createHash("sha256").update(buffer).digest("hex")
  }
}
