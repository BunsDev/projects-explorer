"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Shield,
  Lock,
  Clock,
  Download,
  RefreshCw,
  Copy,
  Check,
  Link2,
  Settings2,
  Globe,
  FolderOpen,
  FileText,
} from "lucide-react"
import {
  getGlobalShareSettingsAction,
  updateGlobalShareSettingsAction,
  getProjectShareSettingsAction,
  updateProjectShareSettingsAction,
  getFileShareSettingsAction,
  updateFileShareSettingsAction,
  regenerateShareLinkAction,
  regenerateAllProjectLinksAction,
  type GlobalShareSettings,
  type ProjectShareSettings,
  type FileShareSettings,
} from "@/app/dashboard/actions"

// ============ GLOBAL SHARE SETTINGS COMPONENT ============

interface GlobalShareSettingsProps {
  onSave?: () => void
}

export function GlobalShareSettingsCard({ onSave }: GlobalShareSettingsProps) {
  const [settings, setSettings] = useState<GlobalShareSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [sharingEnabled, setSharingEnabled] = useState(true)
  const [passwordRequired, setPasswordRequired] = useState(false)
  const [defaultExpiryDays, setDefaultExpiryDays] = useState<string>("")
  const [downloadLimitPerIp, setDownloadLimitPerIp] = useState<string>("")
  const [downloadLimitWindowMinutes, setDownloadLimitWindowMinutes] = useState<string>("60")

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    const result = await getGlobalShareSettingsAction()
    if (result.success && result.settings) {
      setSettings(result.settings)
      setSharingEnabled(result.settings.sharingEnabled)
      setPasswordRequired(result.settings.passwordRequired)
      setDefaultExpiryDays(result.settings.defaultExpiryDays?.toString() ?? "")
      setDownloadLimitPerIp(result.settings.downloadLimitPerIp?.toString() ?? "")
      setDownloadLimitWindowMinutes(result.settings.downloadLimitWindowMinutes?.toString() ?? "60")
    }
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    const result = await updateGlobalShareSettingsAction({
      sharingEnabled,
      passwordRequired,
      defaultExpiryDays: defaultExpiryDays ? parseInt(defaultExpiryDays, 10) : null,
      downloadLimitPerIp: downloadLimitPerIp ? parseInt(downloadLimitPerIp, 10) : null,
      downloadLimitWindowMinutes: downloadLimitWindowMinutes ? parseInt(downloadLimitWindowMinutes, 10) : 60,
    })

    if (result.success) {
      await loadSettings()
      onSave?.()
    } else {
      setError(result.error || "Failed to save settings")
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Share Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Global Share Settings
            </CardTitle>
            <CardDescription>
              Default settings for all shared files. Projects and files can only be more restrictive.
            </CardDescription>
          </div>
          {/* <Badge variant="secondary">
            <Shield className="h-3 w-3 mr-1" />
            Admin Only
          </Badge> */}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Sharing Enabled */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="sharing-enabled" className="text-base font-medium">
              Enable File Sharing
            </Label>
            <p className="text-sm text-muted-foreground">
              When disabled, all share links will return 404
            </p>
          </div>
          <Switch
            id="sharing-enabled"
            checked={sharingEnabled}
            onCheckedChange={setSharingEnabled}
          />
        </div>

        <Separator />

        {/* Password Required */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="password-required" className="text-base font-medium flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Require Password
            </Label>
            <p className="text-sm text-muted-foreground">
              All shared files must have a password set
            </p>
          </div>
          <Switch
            id="password-required"
            checked={passwordRequired}
            onCheckedChange={setPasswordRequired}
          />
        </div>

        <Separator />

        {/* Default Expiry */}
        <div className="space-y-2">
          <Label htmlFor="default-expiry" className="text-base font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Default Link Expiry (days)
          </Label>
          <p className="text-sm text-muted-foreground">
            Leave empty for no default expiry
          </p>
          <Input
            id="default-expiry"
            type="number"
            min="1"
            placeholder="No default expiry"
            value={defaultExpiryDays}
            onChange={(e) => setDefaultExpiryDays(e.target.value)}
            className="max-w-xs"
          />
        </div>

        <Separator />

        {/* Download Limit */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="download-limit" className="text-base font-medium flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download Limit per IP
            </Label>
            <p className="text-sm text-muted-foreground">
              Maximum downloads per IP address within the time window. Leave empty for no limit.
            </p>
            <Input
              id="download-limit"
              type="number"
              min="1"
              placeholder="No limit"
              value={downloadLimitPerIp}
              onChange={(e) => setDownloadLimitPerIp(e.target.value)}
              className="max-w-xs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="download-window" className="text-sm font-medium">
              Time Window (minutes)
            </Label>
            <Input
              id="download-window"
              type="number"
              min="1"
              placeholder="60"
              value={downloadLimitWindowMinutes}
              onChange={(e) => setDownloadLimitWindowMinutes(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </div>

        <div className="pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============ PROJECT SHARE SETTINGS MODAL ============

interface ProjectShareSettingsModalProps {
  projectId: string
  projectName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: () => void
}

export function ProjectShareSettingsModal({
  projectId,
  projectName,
  open,
  onOpenChange,
  onSave,
}: ProjectShareSettingsModalProps) {
  const [settings, setSettings] = useState<ProjectShareSettings | null>(null)
  const [globalSettings, setGlobalSettings] = useState<GlobalShareSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [regenerateResult, setRegenerateResult] = useState<{ count: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form state - null means "inherit from global"
  const [shareEnabled, setShareEnabled] = useState<boolean | null>(null)
  const [sharePasswordRequired, setSharePasswordRequired] = useState<boolean | null>(null)
  const [shareExpiryDays, setShareExpiryDays] = useState<string>("")
  const [shareDownloadLimitPerIp, setShareDownloadLimitPerIp] = useState<string>("")
  const [shareDownloadLimitWindowMinutes, setShareDownloadLimitWindowMinutes] = useState<string>("")

  useEffect(() => {
    if (open) {
      loadSettings()
      setRegenerateResult(null)
    }
  }, [open, projectId])

  const loadSettings = async () => {
    setLoading(true)
    // Fetch both project and global settings
    const [projectResult, globalResult] = await Promise.all([
      getProjectShareSettingsAction(projectId),
      getGlobalShareSettingsAction(),
    ])
    
    if (globalResult.success && globalResult.settings) {
      setGlobalSettings(globalResult.settings)
    }
    
    if (projectResult.success && projectResult.settings) {
      setSettings(projectResult.settings)
      setShareEnabled(projectResult.settings.shareEnabled)
      setSharePasswordRequired(projectResult.settings.sharePasswordRequired)
      setShareExpiryDays(projectResult.settings.shareExpiryDays?.toString() ?? "")
      setShareDownloadLimitPerIp(projectResult.settings.shareDownloadLimitPerIp?.toString() ?? "")
      setShareDownloadLimitWindowMinutes(projectResult.settings.shareDownloadLimitWindowMinutes?.toString() ?? "")
    }
    setLoading(false)
  }

  // Helper to format inherited value display
  const formatInheritedValue = (value: boolean | number | null | undefined, type: "boolean" | "number" | "days" | "minutes") => {
    if (value === null || value === undefined) {
      return type === "boolean" ? "Not set" : "No limit"
    }
    if (type === "boolean") {
      return value ? "Enabled" : "Disabled"
    }
    if (type === "days") {
      return `${value} day${value !== 1 ? "s" : ""}`
    }
    if (type === "minutes") {
      return `${value} min`
    }
    return String(value)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    const result = await updateProjectShareSettingsAction(projectId, {
      shareEnabled,
      sharePasswordRequired,
      shareExpiryDays: shareExpiryDays ? parseInt(shareExpiryDays, 10) : null,
      shareDownloadLimitPerIp: shareDownloadLimitPerIp ? parseInt(shareDownloadLimitPerIp, 10) : null,
      shareDownloadLimitWindowMinutes: shareDownloadLimitWindowMinutes
        ? parseInt(shareDownloadLimitWindowMinutes, 10)
        : null,
    })

    if (result.success) {
      onSave?.()
      onOpenChange(false)
    } else {
      setError(result.error || "Failed to save settings")
    }
    setSaving(false)
  }

  const handleReset = () => {
    setShareEnabled(null)
    setSharePasswordRequired(null)
    setShareExpiryDays("")
    setShareDownloadLimitPerIp("")
    setShareDownloadLimitWindowMinutes("")
  }

  const handleRegenerateAllLinks = async () => {
    if (!confirm(`Regenerate ALL share links for "${projectName}"? This will invalidate all existing share URLs for files in this project.`)) {
      return
    }

    setRegenerating(true)
    setError(null)
    setRegenerateResult(null)

    const result = await regenerateAllProjectLinksAction(projectId)
    if (result.success) {
      setRegenerateResult({ count: result.count || 0 })
      onSave?.()
    } else {
      setError(result.error || "Failed to regenerate links")
    }
    setRegenerating(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Share Settings: {projectName}
          </DialogTitle>
          <DialogDescription>
            Override global settings for this project. Empty/inherit values use global defaults.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Sharing Enabled */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Enable Sharing</Label>
                <p className="text-xs text-muted-foreground">
                  {shareEnabled === null 
                    ? `Inherits from global: ${formatInheritedValue(globalSettings?.sharingEnabled, "boolean")}`
                    : shareEnabled ? "Enabled" : "Disabled"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={shareEnabled === null ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setShareEnabled(null)}
                  disabled={shareEnabled === null}
                >
                  Inherit{shareEnabled == null && "ed"}
                </Button>
                {shareEnabled !== null && <Switch
                  checked={shareEnabled ?? true}
                  onCheckedChange={setShareEnabled}
                  disabled={shareEnabled === null}
                />
                }
              </div>
            </div>

            <Separator />

            {/* Password Required */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Lock className="h-3 w-3" />
                  Require Password
                </Label>
                <p className="text-xs text-muted-foreground">
                  {sharePasswordRequired === null
                    ? `Inherits from global: ${globalSettings?.passwordRequired ? "Required" : "Optional"}`
                    : sharePasswordRequired
                      ? "Required"
                      : "Optional"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={sharePasswordRequired === null ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setSharePasswordRequired(null)}
                  disabled={sharePasswordRequired === null}
                >
                  Inherit{sharePasswordRequired == null && "ed"}
                </Button>
                {sharePasswordRequired !== null && <Switch
                  checked={sharePasswordRequired ?? false}
                  onCheckedChange={setSharePasswordRequired}
                  disabled={sharePasswordRequired === null}
                />
                }
              </div>
            </div>

            <Separator />

            {/* Expiry Days */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Default Expiry (days)
              </Label>
              <p className="text-xs text-muted-foreground">
                Global default: {formatInheritedValue(globalSettings?.defaultExpiryDays, "days")}
              </p>
              <Input
                type="number"
                min="1"
                placeholder={globalSettings?.defaultExpiryDays ? `${globalSettings.defaultExpiryDays} (from global)` : "No limit (from global)"}
                value={shareExpiryDays}
                onChange={(e) => setShareExpiryDays(e.target.value)}
              />
            </div>

            <Separator />

            {/* Download Limit */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Download className="h-3 w-3" />
                  Download Limit per IP
                </Label>
                <p className="text-xs text-muted-foreground">
                  Global default: {formatInheritedValue(globalSettings?.downloadLimitPerIp, "number")}
                </p>
                <Input
                  type="number"
                  min="1"
                  placeholder={globalSettings?.downloadLimitPerIp ? `${globalSettings.downloadLimitPerIp} (from global)` : "No limit (from global)"}
                  value={shareDownloadLimitPerIp}
                  onChange={(e) => setShareDownloadLimitPerIp(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Time Window (minutes)</Label>
                <p className="text-xs text-muted-foreground">
                  Global default: {formatInheritedValue(globalSettings?.downloadLimitWindowMinutes, "minutes")}
                </p>
                <Input
                  type="number"
                  min="1"
                  placeholder={globalSettings?.downloadLimitWindowMinutes ? `${globalSettings.downloadLimitWindowMinutes} (from global)` : "60 (from global)"}
                  value={shareDownloadLimitWindowMinutes}
                  onChange={(e) => setShareDownloadLimitWindowMinutes(e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {/* Regenerate All Links */}
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <RefreshCw className="h-3 w-3" />
                  Regenerate All Share Links
                </Label>
                <p className="text-xs text-muted-foreground">
                  Create new share URLs for all files in this project. This will invalidate all existing links.
                </p>
              </div>
              {regenerateResult && (
                <div className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
                  Successfully regenerated {regenerateResult.count} file link{regenerateResult.count !== 1 ? "s" : ""}.
                </div>
              )}
              <Button
                variant="outline"
                onClick={handleRegenerateAllLinks}
                disabled={regenerating || loading}
                className="w-full"
              >
                {regenerating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Regenerate All Links
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleReset}>
            Reset to Inherit
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ FILE SHARE SETTINGS MODAL ============

interface FileShareSettingsModalProps {
  fileId: string
  fileName: string
  projectId?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: () => void
}

export function FileShareSettingsModal({
  fileId,
  fileName,
  projectId,
  open,
  onOpenChange,
  onSave,
}: FileShareSettingsModalProps) {
  const [settings, setSettings] = useState<FileShareSettings | null>(null)
  const [projectSettings, setProjectSettings] = useState<ProjectShareSettings | null>(null)
  const [globalSettings, setGlobalSettings] = useState<GlobalShareSettings | null>(null)
  const [publicId, setPublicId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Form state
  const [shareEnabled, setShareEnabled] = useState<boolean | null>(null)
  const [expiresAt, setExpiresAt] = useState<string>("")
  const [newPassword, setNewPassword] = useState<string>("")
  const [removePassword, setRemovePassword] = useState(false)
  const [downloadLimitPerIp, setDownloadLimitPerIp] = useState<string>("")
  const [downloadLimitWindowMinutes, setDownloadLimitWindowMinutes] = useState<string>("")

  useEffect(() => {
    if (open) {
      loadSettings()
    }
  }, [open, fileId])

  const loadSettings = async () => {
    setLoading(true)
    setNewPassword("")
    setRemovePassword(false)
    
    // Fetch file settings, project settings (if projectId), and global settings
    const promises: Promise<unknown>[] = [
      getFileShareSettingsAction(fileId),
      getGlobalShareSettingsAction(),
    ]
    if (projectId) {
      promises.push(getProjectShareSettingsAction(projectId))
    }
    
    const results = await Promise.all(promises)
    const fileResult = results[0] as Awaited<ReturnType<typeof getFileShareSettingsAction>>
    const globalResult = results[1] as Awaited<ReturnType<typeof getGlobalShareSettingsAction>>
    const projectResult = results[2] as Awaited<ReturnType<typeof getProjectShareSettingsAction>> | undefined
    
    if (globalResult.success && globalResult.settings) {
      setGlobalSettings(globalResult.settings)
    }
    
    if (projectResult?.success && projectResult.settings) {
      setProjectSettings(projectResult.settings)
    }
    
    if (fileResult.success && fileResult.settings) {
      setSettings(fileResult.settings)
      setPublicId(fileResult.publicId || "")
      setShareEnabled(fileResult.settings.shareEnabled)
      setExpiresAt(
        fileResult.settings.expiresAt
          ? new Date(fileResult.settings.expiresAt).toISOString().slice(0, 16)
          : ""
      )
      setDownloadLimitPerIp(fileResult.settings.downloadLimitPerIp?.toString() ?? "")
      setDownloadLimitWindowMinutes(fileResult.settings.downloadLimitWindowMinutes?.toString() ?? "")
    }
    setLoading(false)
  }

  // Compute effective inherited values (project overrides global)
  const getEffectiveInheritedValue = <T,>(
    projectValue: T | null | undefined,
    globalValue: T | null | undefined
  ): { value: T | null | undefined; source: "project" | "global" } => {
    if (projectValue !== null && projectValue !== undefined) {
      return { value: projectValue, source: "project" }
    }
    return { value: globalValue, source: "global" }
  }

  const effectiveSharingEnabled = getEffectiveInheritedValue(
    projectSettings?.shareEnabled,
    globalSettings?.sharingEnabled
  )
  const effectiveDownloadLimit = getEffectiveInheritedValue(
    projectSettings?.shareDownloadLimitPerIp,
    globalSettings?.downloadLimitPerIp
  )
  const effectiveDownloadWindow = getEffectiveInheritedValue(
    projectSettings?.shareDownloadLimitWindowMinutes,
    globalSettings?.downloadLimitWindowMinutes
  )
  const effectiveExpiryDays = getEffectiveInheritedValue(
    projectSettings?.shareExpiryDays,
    globalSettings?.defaultExpiryDays
  )

  const formatInheritedSource = (source: "project" | "global") => 
    source === "project" ? "from project" : "from global"

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    const updateSettings: Parameters<typeof updateFileShareSettingsAction>[1] = {
      shareEnabled,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      downloadLimitPerIp: downloadLimitPerIp ? parseInt(downloadLimitPerIp, 10) : null,
      downloadLimitWindowMinutes: downloadLimitWindowMinutes
        ? parseInt(downloadLimitWindowMinutes, 10)
        : null,
    }

    // Handle password changes
    if (removePassword) {
      updateSettings.sharePassword = ""
    } else if (newPassword) {
      updateSettings.sharePassword = newPassword
    }

    const result = await updateFileShareSettingsAction(fileId, updateSettings)

    if (result.success) {
      onSave?.()
      onOpenChange(false)
    } else {
      setError(result.error || "Failed to save settings")
    }
    setSaving(false)
  }

  const handleRegenerateLink = async () => {
    if (!confirm("This will invalidate the current share link. Are you sure?")) {
      return
    }

    setRegenerating(true)
    const result = await regenerateShareLinkAction(fileId)
    if (result.success && result.publicId) {
      setPublicId(result.publicId)
    } else {
      setError(result.error || "Failed to regenerate link")
    }
    setRegenerating(false)
  }

  const copyLink = async () => {
    const url = `${window.location.origin}/share/${publicId}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareUrl = publicId ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${publicId}` : ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Share Settings: {fileName}
          </DialogTitle>
          <DialogDescription>
            Configure sharing options for this file.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Share Link */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Link2 className="h-3 w-3" />
                Share Link
              </Label>
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={copyLink}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRegenerateLink}
                  disabled={regenerating}
                >
                  <RefreshCw className={`h-4 w-4 ${regenerating ? "animate-spin" : ""}`} />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Regenerating creates a new URL and invalidates the old one.
              </p>
            </div>

            <Separator />

            {/* Sharing Enabled */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Enable Sharing</Label>
                <p className="text-xs text-muted-foreground">
                  {shareEnabled === null 
                    ? `Inherits ${formatInheritedSource(effectiveSharingEnabled.source)}: ${effectiveSharingEnabled.value === false ? "Disabled" : "Enabled"}`
                    : shareEnabled ? "Enabled" : "Disabled"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={shareEnabled === null ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setShareEnabled(null)}
                  disabled={shareEnabled === null}
                >
                  Inherit{shareEnabled === null && "ed"}
                </Button>
                {shareEnabled !== null && (
                  <Switch
                    checked={shareEnabled ?? true}
                    onCheckedChange={setShareEnabled}
                  />
                )}
              </div>
            </div>

            <Separator />

            {/* Password */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Lock className="h-3 w-3" />
                Password Protection
              </Label>
              {settings?.hasPassword && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Password set</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRemovePassword(!removePassword)}
                    className={removePassword ? "text-destructive" : ""}
                  >
                    {removePassword ? "Keep password" : "Remove password"}
                  </Button>
                </div>
              )}
              {!removePassword && (
                <Input
                  type="password"
                  placeholder={settings?.hasPassword ? "Enter new password to change" : "Set password (optional)"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              )}
            </div>

            <Separator />

            {/* Expiry */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Expiration Date
              </Label>
              <p className="text-xs text-muted-foreground">
                Default expiry {formatInheritedSource(effectiveExpiryDays.source)}: {effectiveExpiryDays.value ? `${effectiveExpiryDays.value} day${effectiveExpiryDays.value !== 1 ? "s" : ""}` : "No limit"}
              </p>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
              {expiresAt && (
                <Button variant="ghost" size="sm" onClick={() => setExpiresAt("")}>
                  Clear expiration
                </Button>
              )}
            </div>

            <Separator />

            {/* Download Limit */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Download className="h-3 w-3" />
                  Download Limit per IP
                </Label>
                <p className="text-xs text-muted-foreground">
                  Inherited {formatInheritedSource(effectiveDownloadLimit.source)}: {effectiveDownloadLimit.value ?? "No limit"}
                </p>
                <Input
                  type="number"
                  min="1"
                  placeholder={effectiveDownloadLimit.value ? `${effectiveDownloadLimit.value} (${formatInheritedSource(effectiveDownloadLimit.source)})` : `No limit (${formatInheritedSource(effectiveDownloadLimit.source)})`}
                  value={downloadLimitPerIp}
                  onChange={(e) => setDownloadLimitPerIp(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Time Window (minutes)</Label>
                <p className="text-xs text-muted-foreground">
                  Inherited {formatInheritedSource(effectiveDownloadWindow.source)}: {effectiveDownloadWindow.value ?? 60} min
                </p>
                <Input
                  type="number"
                  min="1"
                  placeholder={`${effectiveDownloadWindow.value ?? 60} (${formatInheritedSource(effectiveDownloadWindow.source)})`}
                  value={downloadLimitWindowMinutes}
                  onChange={(e) => setDownloadLimitWindowMinutes(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
