"use client"

import { useState, useTransition } from "react"
import { CheckCircle2, Loader2, Shield, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CloudProviderHealth } from "@/lib/cloud/types"
import { validateCloudCredentialsAction } from "@/app/dashboard/actions"

export function CloudSettingsCard({ provider }: { provider: CloudProviderHealth }) {
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Shield className="size-4 text-primary" />
          Cloud provider settings
        </CardTitle>
        <CardDescription>
          Server env is the source of truth. This screen tests connectivity, bucket reachability, and write permissions without exposing secrets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Input value={provider.provider} readOnly />
          </div>
          <div className="space-y-2">
            <Label>Bucket</Label>
            <Input value={provider.bucket || ""} readOnly placeholder="Set CLOUD_S3_BUCKET" />
          </div>
          <div className="space-y-2">
            <Label>Region</Label>
            <Input value={provider.region || ""} readOnly placeholder="Set CLOUD_S3_REGION" />
          </div>
          <div className="space-y-2">
            <Label>Endpoint</Label>
            <Input value={provider.endpoint || ""} readOnly placeholder="Set CLOUD_S3_ENDPOINT" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Base prefix</Label>
            <Input value={provider.basePrefix || ""} readOnly placeholder="Optional key prefix" />
          </div>
        </div>

        {!provider.configured ? (
          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            Missing cloud configuration. Add the S3 endpoint, bucket, region, access key, and secret before queue workers will run.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => startTransition(async () => setResult(await validateCloudCredentialsAction()))}
            disabled={pending}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Test connection & verify bucket
          </Button>
          {result ? (
            <p className={`text-sm ${result.success ? "text-emerald-600" : "text-destructive"}`}>
              {result.success ? <CheckCircle2 className="mr-1 inline size-4" /> : <ShieldAlert className="mr-1 inline size-4" />}
              {result.message}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
