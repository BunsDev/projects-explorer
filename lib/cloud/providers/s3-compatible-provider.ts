import { createHash } from "node:crypto"
import { Readable } from "node:stream"
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3"
import { getCloudProviderHealth, getCloudStorageConfig } from "@/lib/cloud/config"
import type { CloudDownloadResult, CloudPutInput, CloudStorageObject } from "@/lib/cloud/types"
import type { StorageProvider } from "@/lib/cloud/providers/storage-provider"

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

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.requireBucket(),
        Key: this.resolveKey(input.key),
        Body: body,
        ContentType: input.contentType,
        Metadata: {
          ...input.metadata,
          checksumsha256: checksumSha256,
        },
      }),
    )

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
