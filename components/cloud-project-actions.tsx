"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { FolderUp, CloudUpload, ArrowDownToLine, Loader2, RefreshCw, HardDriveDownload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { enqueueProjectUploadSyncAction, enqueueProjectRestoreAction, processSyncQueueAction, queueEvictionAction } from "@/app/dashboard/actions"

export function CloudProjectActions({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const run = (task: () => Promise<{ success: boolean; message?: string; error?: string }>) => {
    startTransition(async () => {
      const result = await task()
      setMessage(result.message || result.error || "Done")
    })
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CloudUpload className="size-4 text-primary" />
          Cloud project actions
        </CardTitle>
        <CardDescription>
          Queue real transfer jobs, restore cache locally, and kick the worker pool for this project.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" asChild>
            <Link href={`/dashboard/upload?project=${projectId}`}>
              <FolderUp className="size-4" />
              Upload folder/project
            </Link>
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => enqueueProjectUploadSyncAction(projectId))}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <CloudUpload className="size-4" />}
            Queue cloud upload
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => enqueueProjectRestoreAction(projectId))}>
            <ArrowDownToLine className="size-4" />
            Queue restore
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => processSyncQueueAction())}>
            <RefreshCw className="size-4" />
            Run worker now
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => queueEvictionAction(projectId))}>
            <HardDriveDownload className="size-4" />
            Safe cache eviction
          </Button>
        </div>
        {message && <p className="text-sm text-muted-foreground sm:max-w-2xl">{projectName}: {message}</p>}
      </CardContent>
    </Card>
  )
}
