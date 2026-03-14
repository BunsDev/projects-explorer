import type {
  CloudDownloadResult,
  CloudProviderHealth,
  CloudProviderProbe,
  CloudPutInput,
  CloudStorageObject,
} from "@/lib/cloud/types"

export interface StorageProvider {
  readonly name: string

  getHealth(): Promise<CloudProviderHealth>
  probe(): Promise<CloudProviderProbe>
  head(key: string): Promise<CloudStorageObject | null>
  put(input: CloudPutInput): Promise<CloudStorageObject>
  get(key: string): Promise<CloudDownloadResult>
  delete(key: string): Promise<void>
  list(prefix?: string): Promise<CloudStorageObject[]>
  getPublicUrl?(key: string): string | null
}
