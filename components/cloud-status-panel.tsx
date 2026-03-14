import Link from "next/link"
import { Cloud, Database, HardDriveDownload, Upload, RefreshCw, AlertTriangle, CheckCircle2, PauseCircle, MonitorSmartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { CloudProviderHealth, CloudQueueSummary, DiskPressureSnapshot, TraySyncSnapshot } from "@/lib/cloud/types"

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
  summary,
  tray,
}: {
  provider: CloudProviderHealth
  disk: DiskPressureSnapshot
  summary: CloudQueueSummary
  tray: TraySyncSnapshot
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Cloud className="size-4 text-primary" />
            Cloud status
          </CardTitle>
          <CardDescription>
            Durable sync queue, worker pool, cache pressure signals, and desktop tray integration hooks.
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
      <CardContent className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Database className="size-4 text-muted-foreground" />
            Provider
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{provider.provider}</p>
            <p>{provider.configured ? `Bucket: ${provider.bucket}` : "Credentials not configured yet"}</p>
            <p>{provider.region ? `Region: ${provider.region}` : "Region missing"}</p>
            {provider.configured ? <Badge variant="secondary" className="mt-2"><CheckCircle2 className="mr-1 size-3" />Ready</Badge> : <Badge variant="outline" className="mt-2">Env missing</Badge>}
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
            {disk.pressureLevel !== "healthy" ? <Badge variant="outline" className="mt-2"><AlertTriangle className="mr-1 size-3" />Eviction recommended</Badge> : null}
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <RefreshCw className="size-4 text-muted-foreground" />
            Sync queue
          </div>
          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{summary.queued + summary.running + summary.retrying} active task{summary.queued + summary.running + summary.retrying === 1 ? "" : "s"}</p>
            <p>{summary.uploadsQueued} upload queued</p>
            <p>{summary.downloadsQueued} download queued</p>
            <p>{summary.running} running • {summary.retrying} retrying</p>
            <p>{summary.paused} paused • {summary.failed} failed</p>
            <p>{summary.cancelled} cancelled • {summary.succeeded} succeeded</p>
            {summary.paused > 0 ? <Badge variant="outline" className="mt-2"><PauseCircle className="mr-1 size-3" />Paused jobs present</Badge> : null}
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MonitorSmartphone className="size-4 text-muted-foreground" />
            Desktop / tray
          </div>
          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{tray.label}</p>
            <p>Quick actions: {tray.quickActions.join(", ")}</p>
            <p>Provider ready: {tray.providerReady ? "yes" : "no"}</p>
            <p>Pressure: {tray.pressureLevel}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
