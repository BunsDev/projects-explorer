export type CloudStorageObject = {
  key: string
  size: number
  etag?: string
  checksumSha256?: string
  lastModified?: Date
  contentType?: string
  metadata?: Record<string, string>
}

export type CloudPutInput = {
  key: string
  body: Buffer | Uint8Array | ArrayBuffer | string
  contentType?: string
  checksumSha256?: string
  metadata?: Record<string, string>
  multipart?: boolean
  partSizeBytes?: number
}

export type CloudDownloadResult = {
  body: Buffer
  contentType?: string
  etag?: string
  checksumSha256?: string
}

export type CloudProviderHealth = {
  provider: string
  configured: boolean
  bucket?: string
  endpoint?: string
  region?: string
  basePrefix?: string
}

export type CloudProviderProbe = {
  success: boolean
  message: string
  bucket?: string
  endpoint?: string
  writable?: boolean
}

export type SyncTaskType = "upload" | "download" | "delete-local-cache" | "evict-cache"
export type SyncTaskStatus = "queued" | "running" | "paused" | "succeeded" | "failed" | "retrying" | "cancelled"

export type SyncTaskEvent = {
  at: string
  status: SyncTaskStatus | "progress" | "created" | "verification-passed" | "verification-failed"
  message: string
  attempt?: number
  bytesTransferred?: number | null
}

export type SyncTask = {
  id: string
  type: SyncTaskType
  localPath?: string | null
  remoteKey: string
  status: SyncTaskStatus
  checksumSha256?: string | null
  bytesTotal?: number | null
  bytesTransferred?: number | null
  attempts: number
  maxAttempts?: number
  createdAt: Date
  updatedAt: Date
  nextRetryAt?: Date | null
  error?: string | null
  projectId?: string | null
  fileId?: string | null
  sourceUrl?: string | null
  metadata?: Record<string, unknown> | null
  history: SyncTaskEvent[]
  lastRunMs?: number | null
}

export type DiskPressureSnapshot = {
  freeBytes: number
  totalBytes: number
  usedBytes: number
  freeRatio: number
  pressureLevel: "healthy" | "warning" | "critical"
  suggestedEvictionBytes: number
}

export type CloudRecentActivity = {
  id: string
  title: string
  detail: string
  status: SyncTaskStatus
  createdAt: Date
  updatedAt: Date
  projectName?: string | null
  history?: SyncTaskEvent[]
  progressLabel?: string
}

export type CloudQueueSummary = {
  queued: number
  running: number
  paused: number
  retrying: number
  succeeded: number
  failed: number
  cancelled: number
  uploadsQueued: number
  downloadsQueued: number
}

export type TraySyncSnapshot = {
  label: string
  activeCount: number
  paused: boolean
  pressureLevel: DiskPressureSnapshot["pressureLevel"]
  providerReady: boolean
  quickActions: Array<"open-app" | "pause-sync" | "resume-sync" | "run-worker"> 
}
