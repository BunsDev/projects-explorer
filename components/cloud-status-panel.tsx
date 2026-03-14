import Link from "next/link"
import { Cloud, Database, HardDriveDownload, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { CloudProviderHealth, DiskPressureSnapshot, SyncTask } from "@/lib/cloud/types"

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

export function CloudStatusPanel({
  provider,
  disk,
  queuedTasks,
}: {
  provider: CloudProviderHealth
  disk: DiskPressureSnapshot
  queuedTasks: SyncTask[]
}) {
  const uploadsQueued = queuedTasks.filter((task) => task.type === "upload" && task.status === "queued").length
  const downloadsQueued = queuedTasks.filter((task) => task.type === "download" && task.status === "queued").length

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Cloud className="size-4 text-primary" />
            Cloud Status
          </CardTitle>
          <CardDescription>
            MVP scaffold for cloud-backed sync, cache management, and future desktop tray status.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/upload">
              <Upload className="size-4" />
              Upload folder/project
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Database className="size-4 text-muted-foreground" />
            Provider
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{provider.provider}</p>
            <p>{provider.configured ? `Bucket: ${provider.bucket}` : "Credentials not configured yet"}</p>
            <p>{provider.region ? `Region: ${provider.region}` : "Region missing"}</p>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <HardDriveDownload className="size-4 text-muted-foreground" />
            Disk pressure
          </div>
          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            <p className="font-medium capitalize text-foreground">{disk.pressureLevel}</p>
            <p>Free: {formatBytes(disk.freeBytes)} / {formatBytes(disk.totalBytes)}</p>
            <p>Suggested eviction: {formatBytes(disk.suggestedEvictionBytes)}</p>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Upload className="size-4 text-muted-foreground" />
            Sync queue
          </div>
          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{queuedTasks.length} task{queuedTasks.length === 1 ? "" : "s"}</p>
            <p>{uploadsQueued} upload queued</p>
            <p>{downloadsQueued} download queued</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
