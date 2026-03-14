import { createHash, randomUUID } from "node:crypto"
import { Readable } from "node:stream"
import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { Upload } from "@aws-sdk/lib-storage"
import { getCloudProviderHealth, getCloudStorageConfig } from "@/lib/cloud/config"
import type { CloudDownloadResult, CloudProviderProbe, CloudPutInput, CloudStorageObject } from "@/lib/cloud/types"
import type { StorageProvider } from "@/lib/cloud/providers/storage-provider"

const MULTIPART_THRESHOLD_BYTES = 32 * 1024 * 1024
const DEFAULT_PART_SIZE_BYTES = 8 * 1024 * 1024

function asBuffer(body: CloudPutInput["body"]): Buffer {
  if (typeof body === "string") return Buffer.from(body)
  if (body instanceof ArrayBuffer) return Buffer.from(body)
  if (body instanceof Uint8Array) return Buffer.from(body)
  return Buffer.from(body)
}

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (stream instanceof Readable) {
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }

  if (stream instanceof Uint8Array) {
    return Buffer.from(stream)
  }

  if (stream instanceof ArrayBuffer) {
    return Buffer.from(stream)
  }

  throw new Error("Unsupported S3 response body type")
}

export class S3CompatibleStorageProvider implements StorageProvider {
  readonly name = "s3-compatible"
  private readonly config = getCloudStorageConfig()
  private readonly client = new S3Client({
    region: this.config.region,
    endpoint: this.config.endpoint,
    forcePathStyle: this.config.forcePathStyle,
    credentials: this.config.accessKeyId && this.config.secretAccessKey
      ? {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
          sessionToken: this.config.sessionToken,
        }
      : undefined,
  })

  private requireBucket(): string {
    if (!this.config.bucket) {
      throw new Error("CLOUD_S3_BUCKET is required")
    }
    return this.config.bucket
  }

  private resolveKey(key: string): string {
    return [this.config.basePrefix, key].filter(Boolean).join("/")
  }

  async getHealth() {
    return getCloudProviderHealth(this.config)
  }

  async probe(): Promise<CloudProviderProbe> {
    if (!this.config.endpoint || !this.config.bucket || !this.config.region || !this.config.accessKeyId || !this.config.secretAccessKey) {
      return {
        success: false,
        message: "Cloud env vars are incomplete. Set endpoint, bucket, region, access key, and secret.",
        bucket: this.config.bucket,
        endpoint: this.config.endpoint,
        writable: false,
      }
    }

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.requireBucket() }))
      const key = `${this.resolveKey("healthchecks")}/${randomUUID()}.txt`
      await this.client.send(new PutObjectCommand({
        Bucket: this.requireBucket(),
        Key: key,
        Body: Buffer.from("projects-explorer-healthcheck"),
        Metadata: { createdby: "projects-explorer-phase3" },
      }))
      await this.client.send(new DeleteObjectCommand({ Bucket: this.requireBucket(), Key: key }))

      return {
        success: true,
        message: "Connection succeeded, bucket is reachable, and a write/delete probe completed.",
        bucket: this.config.bucket,
        endpoint: this.config.endpoint,
        writable: true,
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Cloud probe failed",
        bucket: this.config.bucket,
        endpoint: this.config.endpoint,
        writable: false,
      }
    }
  }

  async head(key: string): Promise<CloudStorageObject | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.requireBucket(),
          Key: this.resolveKey(key),
        }),
      )

      return {
        key,
        size: result.ContentLength ?? 0,
        etag: result.ETag,
        checksumSha256: result.Metadata?.checksumsha256,
        lastModified: result.LastModified,
        contentType: result.ContentType,
        metadata: result.Metadata,
      }
    } catch {
      return null
    }
  }

  async put(input: CloudPutInput): Promise<CloudStorageObject> {
    const body = asBuffer(input.body)
    const checksumSha256 = input.checksumSha256 ?? createHash("sha256").update(body).digest("hex")
    const metadata = {
      ...input.metadata,
      checksumsha256: checksumSha256,
      multipart: String(Boolean(input.multipart || body.byteLength >= MULTIPART_THRESHOLD_BYTES)),
    }

    if (input.multipart || body.byteLength >= MULTIPART_THRESHOLD_BYTES) {
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.requireBucket(),
          Key: this.resolveKey(input.key),
          Body: body,
          ContentType: input.contentType,
          Metadata: metadata,
        },
        partSize: Math.max(input.partSizeBytes ?? DEFAULT_PART_SIZE_BYTES, 5 * 1024 * 1024),
        queueSize: 3,
        leavePartsOnError: false,
      })
      await upload.done()
    } else {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.requireBucket(),
          Key: this.resolveKey(input.key),
          Body: body,
          ContentType: input.contentType,
          Metadata: metadata,
        }),
      )
    }

    return {
      key: input.key,
      size: body.byteLength,
      checksumSha256,
      contentType: input.contentType,
      metadata: input.metadata,
    }
  }

  async get(key: string): Promise<CloudDownloadResult> {
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.requireBucket(),
        Key: this.resolveKey(key),
      }),
    )

    return {
      body: await streamToBuffer(result.Body),
      contentType: result.ContentType,
      etag: result.ETag,
      checksumSha256: result.Metadata?.checksumsha256,
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.requireBucket(),
        Key: this.resolveKey(key),
      }),
    )
  }

  async list(prefix = ""): Promise<CloudStorageObject[]> {
    const result = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.requireBucket(),
        Prefix: this.resolveKey(prefix),
      }),
    )

    return (result.Contents ?? []).map((item) => ({
      key: (item.Key ?? "").replace(`${this.config.basePrefix}/`, ""),
      size: item.Size ?? 0,
      etag: item.ETag,
      lastModified: item.LastModified,
    }))
  }

  getPublicUrl(key: string): string | null {
    if (!this.config.endpoint || !this.config.bucket) {
      return null
    }

    const bucketPart = this.config.forcePathStyle ? `${this.config.bucket}/` : ""
    return `${this.config.endpoint.replace(/\/$/, "")}/${bucketPart}${this.resolveKey(key)}`
  }
}
