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
export type SyncTaskStatus = "queued" | "running" | "completed" | "failed" | "cancelled"

export type SyncTask = {
  id: string
  type: SyncTaskType
  localPath: string
  remoteKey: string
  status: SyncTaskStatus
  checksumSha256?: string
  bytesTotal?: number
  bytesTransferred?: number
  attempts: number
  createdAt: Date
  updatedAt: Date
  error?: string
  projectId?: string
}

export type DiskPressureSnapshot = {
  freeBytes: number
  totalBytes: number
  usedBytes: number
  freeRatio: number
  pressureLevel: "healthy" | "warning" | "critical"
  suggestedEvictionBytes: number
}
