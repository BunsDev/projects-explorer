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

export type SyncTaskType = "upload" | "download" | "delete-local-cache" | "evict-cache"
export type SyncTaskStatus = "queued" | "running" | "succeeded" | "failed" | "retrying" | "cancelled"

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
}

export type CloudQueueSummary = {
  queued: number
  running: number
  retrying: number
  succeeded: number
  failed: number
  uploadsQueued: number
  downloadsQueued: number
}
