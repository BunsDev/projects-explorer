import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { QueueObservability, SyncTask } from "@/lib/cloud/types"

function formatWhen(value?: string) {
  return value ? new Date(value).toLocaleString() : "—"
}

function JobChip({ job }: { job: SyncTask }) {
  return (
    <div className="rounded-md border p-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium truncate">{job.remoteKey}</span>
        <Badge variant="outline">{job.status}</Badge>
      </div>
      <p className="mt-1 text-muted-foreground">{job.type} • attempts {job.attempts}/{job.maxAttempts ?? 5}</p>
    </div>
  )
}

export function CloudObservabilityPanel({ data }: { data: QueueObservability }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Worker observability</CardTitle>
        <CardDescription>Continuous desktop worker state, queue throughput, and the failures most likely to need intervention.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3 text-sm">
            <p className="text-muted-foreground">Throughput</p>
            <p className="mt-1 text-2xl font-semibold">{data.throughputPerMinute}/min</p>
          </div>
          <div className="rounded-lg border p-3 text-sm">
            <p className="text-muted-foreground">Worker</p>
            <p className="mt-1 font-semibold capitalize">{data.worker?.state ?? "stopped"}</p>
            <p className="text-xs text-muted-foreground">Runner {data.worker?.runnerId ?? "n/a"}</p>
          </div>
          <div className="rounded-lg border p-3 text-sm">
            <p className="text-muted-foreground">Last success</p>
            <p className="mt-1 font-semibold">{formatWhen(data.worker?.lastSuccessAt)}</p>
          </div>
          <div className="rounded-lg border p-3 text-sm sm:col-span-3">
            <p className="text-muted-foreground">Running now</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {data.running.length ? data.running.map((job) => <JobChip key={job.id} job={job} />) : <p className="text-xs text-muted-foreground">No leases are active.</p>}
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Recent failures</p>
          {data.recentFailures.length ? data.recentFailures.map((item) => (
            <div key={item.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{item.title}</p>
                <Badge variant={item.status === "failed" ? "destructive" : "outline"}>{item.failureCategory || item.status}</Badge>
              </div>
              <p className="mt-1 text-muted-foreground break-all">{item.detail}</p>
              <p className="mt-2 text-xs text-muted-foreground">{new Date(item.updatedAt).toLocaleString()}</p>
            </div>
          )) : <p className="text-sm text-muted-foreground">No recent failures.</p>}
        </div>
      </CardContent>
    </Card>
  )
}
