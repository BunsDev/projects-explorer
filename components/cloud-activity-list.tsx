import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { CloudRecentActivity } from "@/lib/cloud/types"

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  queued: "secondary",
  running: "default",
  retrying: "outline",
  succeeded: "secondary",
  failed: "destructive",
  cancelled: "outline",
}

export function CloudActivityList({ items }: { items: CloudRecentActivity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Recent cloud activity</CardTitle>
        <CardDescription>Latest queue and transfer events from the durable sync store.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cloud activity yet.</p>
        ) : items.map((item) => (
          <div key={item.id} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground break-all">{item.detail}</p>
                <p className="mt-2 text-xs text-muted-foreground">Updated {new Date(item.updatedAt).toLocaleString()}</p>
              </div>
              <Badge variant={statusVariant[item.status] ?? "outline"}>{item.status}</Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
