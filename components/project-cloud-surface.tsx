"use client"

import { useTransition } from "react"
import { resolveCloudConflictAction, setFilePinProtectionAction } from "@/app/dashboard/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { CloudCacheEntryView, ConflictRecord } from "@/lib/cloud/types"

export function ProjectCloudSurface({ projectId, cacheEntries, conflicts }: { projectId: string; cacheEntries: CloudCacheEntryView[]; conflicts: ConflictRecord[] }) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cache + pinning</CardTitle>
          <CardDescription>Per-file cache residency, pin protection, and eviction visibility.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {cacheEntries.length ? cacheEntries.map((entry) => (
            <div key={entry.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{entry.title}</p>
                  <p className="text-muted-foreground break-all">{entry.remoteKey}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{entry.cacheState} • {entry.sizeBytes} bytes{entry.evictionReason ? ` • ${entry.evictionReason}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  {entry.pinned ? <Badge>pinned</Badge> : <Badge variant="outline">unpinned</Badge>}
                  {entry.fileId ? (
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => { await setFilePinProtectionAction(entry.fileId!, !entry.pinned, projectId) })}>
                      {entry.pinned ? "Unpin" : "Pin"}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          )) : <p className="text-sm text-muted-foreground">No cache entries yet. Restore or sync a project to populate desktop cache state.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conflict reconciliation</CardTitle>
          <CardDescription>Obvious checksum mismatches between local cache and remote cloud objects.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {conflicts.length ? conflicts.map((conflict) => (
            <div key={`${conflict.remoteKey}-${conflict.fileId}`} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{conflict.title}</p>
              <p className="mt-1 text-muted-foreground break-all">remote {conflict.remoteChecksum} • local {conflict.localChecksum}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" disabled={pending} onClick={() => startTransition(async () => { await resolveCloudConflictAction({ projectId, fileId: conflict.fileId ?? undefined, remoteKey: conflict.remoteKey, resolution: "force-upload" }) })}>Force upload</Button>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => { await resolveCloudConflictAction({ projectId, fileId: conflict.fileId ?? undefined, remoteKey: conflict.remoteKey, resolution: "force-restore" }) })}>Force restore</Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(async () => { await resolveCloudConflictAction({ projectId, fileId: conflict.fileId ?? undefined, remoteKey: conflict.remoteKey, resolution: "skip" }) })}>Skip</Button>
              </div>
            </div>
          )) : <p className="text-sm text-muted-foreground">No obvious local-vs-remote conflicts detected.</p>}
        </CardContent>
      </Card>
    </div>
  )
}
