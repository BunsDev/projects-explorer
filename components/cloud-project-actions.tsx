"use client"

import { useState } from "react"
import Link from "next/link"
import { FolderUp, CloudUpload, ArrowDownToLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function CloudProjectActions({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [message, setMessage] = useState<string | null>(null)

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CloudUpload className="size-4 text-primary" />
          Cloud project actions
        </CardTitle>
        <CardDescription>
          Placeholder controls for the upcoming Tauri desktop + tray flow.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" asChild>
            <Link href={`/dashboard/upload?project=${projectId}`}>
              <FolderUp className="size-4" />
              Upload folder/project
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMessage(`Restore queue scaffold is ready for ${projectName}. Phase 2 should connect this button to the desktop sync worker.`)}
          >
            <ArrowDownToLine className="size-4" />
            Queue restore
          </Button>
        </div>
        {message && <p className="text-sm text-muted-foreground sm:max-w-md">{message}</p>}
      </CardContent>
    </Card>
  )
}
