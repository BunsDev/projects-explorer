import { processSyncQueue } from "@/lib/cloud/transfer-worker"
import { pauseSyncJobs, resumeSyncJobs } from "@/lib/cloud/queue-store"
import type { QueueWorkerSnapshot } from "@/lib/cloud/types"

const POLL_MS = Number(process.env.CLOUD_WORKER_POLL_MS || 15_000)
const RUNNER_ID = process.env.CLOUD_WORKER_ID || `desktop-${process.pid}`

declare global {
  // eslint-disable-next-line no-var
  var __cloudWorkerRuntime: CloudWorkerRuntime | undefined
}

class CloudWorkerRuntime {
  private timer: NodeJS.Timeout | null = null
  private running = false
  private paused = false
  private startedAt = new Date()
  private lastLoopAt?: string
  private lastSuccessAt?: string
  private lastFailureAt?: string
  private processedJobs = 0

  start() {
    if (this.timer) return
    this.timer = setInterval(() => void this.tick(), POLL_MS)
    void this.tick()
    const shutdown = async () => {
      await this.stop()
      process.exit(0)
    }
    process.once("SIGINT", shutdown)
    process.once("SIGTERM", shutdown)
  }

  async stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.running = false
  }

  async pause(projectId?: string) {
    this.paused = true
    await pauseSyncJobs({ projectId })
  }

  async resume(projectId?: string) {
    this.paused = false
    await resumeSyncJobs({ projectId })
  }

  async runNow() {
    return this.tick(true)
  }

  snapshot(): QueueWorkerSnapshot {
    return {
      runnerId: RUNNER_ID,
      state: this.paused ? "paused" : this.running ? "running" : this.timer ? "idle" : "stopped",
      startedAt: this.startedAt.toISOString(),
      lastLoopAt: this.lastLoopAt,
      lastSuccessAt: this.lastSuccessAt,
      lastFailureAt: this.lastFailureAt,
      processedJobs: this.processedJobs,
    }
  }

  private async tick(force = false) {
    if (this.running || (this.paused && !force)) return { picked: 0, succeeded: 0, failed: 0, autoEvictedBytes: 0 }
    this.running = true
    this.lastLoopAt = new Date().toISOString()
    try {
      const result = await processSyncQueue({ concurrency: 2, leaseOwner: RUNNER_ID })
      this.processedJobs += result.succeeded
      if (result.succeeded > 0) this.lastSuccessAt = new Date().toISOString()
      if (result.failed > 0) this.lastFailureAt = new Date().toISOString()
      return result
    } catch (error) {
      this.lastFailureAt = new Date().toISOString()
      throw error
    } finally {
      this.running = false
    }
  }
}

export function getCloudWorkerRuntime() {
  if (!globalThis.__cloudWorkerRuntime) globalThis.__cloudWorkerRuntime = new CloudWorkerRuntime()
  return globalThis.__cloudWorkerRuntime
}
