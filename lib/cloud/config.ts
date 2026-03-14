import type { CloudProviderHealth } from "@/lib/cloud/types"

export type CloudStorageConfig = {
  provider: "s3"
  endpoint?: string
  region?: string
  bucket?: string
  accessKeyId?: string
  secretAccessKey?: string
  sessionToken?: string
  forcePathStyle: boolean
  basePrefix: string
  metadataDatabaseUrl?: string
  cacheDir: string
  maxCacheBytes: number
  warningFreeBytes: number
  criticalFreeBytes: number
}

const DEFAULT_CACHE_DIR = "./data/cloud-cache"
const DEFAULT_BASE_PREFIX = "projects-explorer"
const GB = 1024 * 1024 * 1024

export function getCloudStorageConfig(env: NodeJS.ProcessEnv = process.env): CloudStorageConfig {
  return {
    provider: "s3",
    endpoint: env.CLOUD_S3_ENDPOINT,
    region: env.CLOUD_S3_REGION,
    bucket: env.CLOUD_S3_BUCKET,
    accessKeyId: env.CLOUD_S3_ACCESS_KEY_ID,
    secretAccessKey: env.CLOUD_S3_SECRET_ACCESS_KEY,
    sessionToken: env.CLOUD_S3_SESSION_TOKEN,
    forcePathStyle: env.CLOUD_S3_FORCE_PATH_STYLE === "true",
    basePrefix: env.CLOUD_STORAGE_PREFIX || DEFAULT_BASE_PREFIX,
    metadataDatabaseUrl: env.CLOUD_METADATA_DATABASE_URL,
    cacheDir: env.CLOUD_CACHE_DIR || DEFAULT_CACHE_DIR,
    maxCacheBytes: Number(env.CLOUD_CACHE_MAX_BYTES || 20 * GB),
    warningFreeBytes: Number(env.CLOUD_WARNING_FREE_BYTES || 15 * GB),
    criticalFreeBytes: Number(env.CLOUD_CRITICAL_FREE_BYTES || 5 * GB),
  }
}

export function isCloudStorageConfigured(config = getCloudStorageConfig()): boolean {
  return Boolean(
    config.bucket &&
      config.region &&
      config.accessKeyId &&
      config.secretAccessKey,
  )
}

export function getCloudProviderHealth(config = getCloudStorageConfig()): CloudProviderHealth {
  return {
    provider: "s3-compatible",
    configured: isCloudStorageConfigured(config),
    bucket: config.bucket,
    endpoint: config.endpoint,
    region: config.region,
    basePrefix: config.basePrefix,
  }
}
