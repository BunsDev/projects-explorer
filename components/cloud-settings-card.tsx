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
          Server env is the source of truth. Secrets stay on the server and are never echoed back into the client.
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
            <Input value={provider.endpoint || ""} readOnly placeholder="Optional S3-compatible endpoint" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Base prefix</Label>
            <Input value={provider.basePrefix || ""} readOnly />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => startTransition(async () => setResult(await validateCloudCredentialsAction()))}
            disabled={pending}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Validate credentials
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
