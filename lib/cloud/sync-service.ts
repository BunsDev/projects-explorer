import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { nanoid } from "nanoid"
import type { StorageProvider } from "@/lib/cloud/providers/storage-provider"
import type { SyncTask, SyncTaskStatus, SyncTaskType } from "@/lib/cloud/types"

export class CloudSyncService {
  private readonly queue = new Map<string, SyncTask>()

  constructor(private readonly provider: StorageProvider) {}

  listTasks(): SyncTask[] {
    return Array.from(this.queue.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )
  }

  async queueUpload(localPath: string, remoteKey: string, projectId?: string) {
    const checksumSha256 = await this.computeChecksum(localPath)
    return this.enqueue("upload", localPath, remoteKey, checksumSha256, projectId)
  }

  queueDownload(localPath: string, remoteKey: string, projectId?: string) {
    return this.enqueue("download", localPath, remoteKey, undefined, projectId)
  }

  queueEviction(localPath: string, remoteKey: string, projectId?: string) {
    return this.enqueue("evict-cache", localPath, remoteKey, undefined, projectId)
  }

  async markRunning(taskId: string) {
    return this.updateStatus(taskId, "running")
  }

  async markCompleted(taskId: string, bytesTransferred?: number) {
    const task = this.getTask(taskId)
    task.status = "completed"
    task.bytesTransferred = bytesTransferred ?? task.bytesTotal
    task.updatedAt = new Date()
    this.queue.set(taskId, task)
    return task
  }

  async markFailed(taskId: string, error: string) {
    const task = this.getTask(taskId)
    task.status = "failed"
    task.error = error
    task.updatedAt = new Date()
    this.queue.set(taskId, task)
    return task
  }

  async processNext(): Promise<SyncTask | null> {
    const next = this.listTasks().find((task) => task.status === "queued")
    if (!next) return null

    await this.markRunning(next.id)

    try {
      if (next.type === "upload") {
        const body = await readFile(next.localPath)
        next.bytesTotal = body.byteLength
        const stored = await this.provider.put({
          key: next.remoteKey,
          body,
          checksumSha256: next.checksumSha256,
        })
        return this.markCompleted(next.id, stored.size)
      }

      if (next.type === "download") {
        const result = await this.provider.get(next.remoteKey)
        return this.markCompleted(next.id, result.body.byteLength)
      }

      return this.markCompleted(next.id, 0)
    } catch (error) {
      return this.markFailed(
        next.id,
        error instanceof Error ? error.message : "Unknown sync error",
      )
    }
  }

  private async enqueue(
    type: SyncTaskType,
    localPath: string,
    remoteKey: string,
    checksumSha256?: string,
    projectId?: string,
  ): Promise<SyncTask> {
    const now = new Date()
    const task: SyncTask = {
      id: nanoid(),
      type,
      localPath,
      remoteKey,
      status: "queued",
      checksumSha256,
      attempts: 0,
      createdAt: now,
      updatedAt: now,
      projectId,
    }

    this.queue.set(task.id, task)
    return task
  }

  private async computeChecksum(localPath: string): Promise<string> {
    const buffer = await readFile(localPath)
    return createHash("sha256").update(buffer).digest("hex")
  }

  private getTask(taskId: string): SyncTask {
    const task = this.queue.get(taskId)
    if (!task) {
      throw new Error(`Sync task not found: ${taskId}`)
    }
    return task
  }

  private async updateStatus(taskId: string, status: SyncTaskStatus): Promise<SyncTask> {
    const task = this.getTask(taskId)
    task.status = status
    task.attempts += status === "running" ? 1 : 0
    task.updatedAt = new Date()
    this.queue.set(taskId, task)
    return task
  }
}
