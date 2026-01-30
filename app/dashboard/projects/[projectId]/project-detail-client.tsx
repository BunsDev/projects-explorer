"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DashboardHeader } from "@/components/dashboard-header"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { FolderTree } from "@/components/folder-tree"
import { FileGrid } from "@/components/file-grid"
import { FileManager } from "@/components/file-manager"
import { ProjectShareSettingsModal } from "@/components/share-settings"
import { Upload, FolderTree as FolderTreeIcon, LayoutGrid, Globe, ExternalLink, Settings2, X, Youtube, Share2 } from "lucide-react"
import { getFilesAction, updateProjectDeployedUrlAction } from "@/app/dashboard/actions"
import { GitHubFileTree } from "@/components/github-file-tree" // Import GitHubFileTree component

type Project = {
  id: string
  name: string
  slug: string
  description: string | null
  deployedUrl: string | null
  createdAt: Date
}

type Folder = {
  id: string
  name: string
  parentId: string | null
  fileCount: number
  createdAt: Date
}

type File = {
  id: string
  publicId: string
  title: string
  description: string | null
  originalFilename: string
  fileSize: number
  mimeType: string
  downloadCount: number
  createdAt: Date
  expiresAt: Date | null
}

type TreeFolder = {
  id: string
  name: string
  parentId: string | null
}

type TreeFile = {
  id: string
  publicId: string
  title: string
  originalFilename: string
  folderId: string | null
  mimeType: string
  fileSize: number
  blobUrl: string
}

/** Extract YouTube video ID from youtube.com or youtu.be URLs, or null if not a YouTube URL. */
function getYouTubeVideoId(url: string): string | null {
  if (!url?.trim()) return null
  try {
    const u = new URL(url.trim())
    const host = u.hostname.replace(/^www\./, "")
    if (host === "youtube.com") {
      const v = u.searchParams.get("v")
      return v || null
    }
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0]
      return id || null
    }
    return null
  } catch {
    return null
  }
}

interface ProjectDetailClientProps {
  project: Project
  initialFolders: Folder[]
  initialFiles: File[]
  treeFolders: TreeFolder[]
  treeFiles: TreeFile[]
}

export function ProjectDetailClient({
  project,
  initialFolders,
  initialFiles,
  treeFolders,
  treeFiles,
}: ProjectDetailClientProps) {
  const router = useRouter()
  const [folders, setFolders] = useState<Folder[]>(initialFolders)
  const [files, setFiles] = useState<File[]>(initialFiles)
  const [localTreeFolders, setLocalTreeFolders] = useState(treeFolders)
  const [localTreeFiles, setLocalTreeFiles] = useState(treeFiles)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [viewMode, setViewMode] = useState<"grid" | "tree">("tree")

  // Hydration fix: defer rendering of Radix components until after mount
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Deployed URL state
  const [deployedUrl, setDeployedUrl] = useState(project.deployedUrl || "")
  const [isEditingUrl, setIsEditingUrl] = useState(false)
  const [urlInput, setUrlInput] = useState(project.deployedUrl || "")
  const [isSavingUrl, setIsSavingUrl] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)

  // Share settings modal state
  const [isShareSettingsOpen, setIsShareSettingsOpen] = useState(false)

  // Refresh data when file manager changes data
  const handleDataChange = useCallback(() => {
    router.refresh()
  }, [router])

  // Save deployed URL
  const handleSaveDeployedUrl = async () => {
    setIsSavingUrl(true)
    setUrlError(null)

    const result = await updateProjectDeployedUrlAction(project.id, urlInput || null)

    if (result.success) {
      setDeployedUrl(urlInput)
      setIsEditingUrl(false)
    } else {
      setUrlError(result.error || "Failed to save URL")
    }
    setIsSavingUrl(false)
  }

  const handleRemoveDeployedUrl = async () => {
    setIsSavingUrl(true)
    const result = await updateProjectDeployedUrlAction(project.id, null)
    if (result.success) {
      setDeployedUrl("")
      setUrlInput("")
      setIsEditingUrl(false)
    }
    setIsSavingUrl(false)
  }

  // Build breadcrumb path
  const getBreadcrumbPath = () => {
    if (!currentFolderId) {
      return [{ label: project.name }]
    }

    const path: { label: string; href?: string }[] = [
      { label: project.name, href: `/dashboard/projects/${project.id}` },
    ]

    // Build folder path
    const buildPath = (folderId: string): Folder[] => {
      const folder = folders.find((f) => f.id === folderId)
      if (!folder) return []
      if (folder.parentId) {
        return [...buildPath(folder.parentId), folder]
      }
      return [folder]
    }

    const folderPath = buildPath(currentFolderId)
    folderPath.forEach((folder, index) => {
      if (index === folderPath.length - 1) {
        path.push({ label: folder.name })
      } else {
        path.push({ label: folder.name, href: "#" })
      }
    })

    return path
  }

  // Load files when folder changes
  useEffect(() => {
    const loadFiles = async () => {
      setIsLoadingFiles(true)
      const result = await getFilesAction(project.id, currentFolderId || undefined)
      if (result.success && result.files) {
        setFiles(result.files)
      }
      setIsLoadingFiles(false)
    }

    if (currentFolderId !== null || initialFiles.length === 0) {
      loadFiles()
    } else {
      setFiles(initialFiles)
    }
  }, [currentFolderId, project.id, initialFiles])

  const handleFolderSelect = (folderId: string | null) => {
    setCurrentFolderId(folderId)
  }

  return (
    <div className="min-h-screen mx-auto max-w-screen-2xl w-full bg-background">
      <DashboardHeader title={project.name ?? "Project"} />
      <main className="mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-screen-2xl w-full pb-4 sm:pb-8">
        <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <BreadcrumbNav items={getBreadcrumbPath()} />
          <div className="flex items-center gap-2 flex-wrap">
            {/* Deployed URL button/indicator */}
            {mounted ? (
              <Dialog open={isEditingUrl} onOpenChange={setIsEditingUrl}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 bg-transparent hover:bg-accent/50 hover:text-accent-foreground border-muted-foreground">
                    <Globe className="size-4" />
                    <span className="hidden sm:inline">{deployedUrl ? "Preview URL" : "Add Preview URL"}</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Deployed Preview URL</DialogTitle>
                    <DialogDescription>
                      Add a deployment URL to preview your project live. This could be a Vercel, Netlify, or any other hosted URL.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="deployed-url">Preview URL</Label>
                      <Input
                        id="deployed-url"
                        placeholder="https://"
                        value={urlInput}
                        onChange={(e) => {
                          setUrlInput(e.target.value)
                          setUrlError(null)
                        }}
                      />
                      {urlError && (
                        <p className="text-sm text-destructive">{urlError}</p>
                      )}
                    </div>
                    {deployedUrl && (
                      <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
                        <Globe className="h-4 w-4 text-green-500" />
                        <a
                          href={deployedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 truncate text-sm text-primary hover:underline"
                        >
                          {deployedUrl}
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => window.open(deployedUrl, "_blank")}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <DialogFooter className="flex-col gap-2 sm:flex-row">
                    {deployedUrl && (
                      <Button
                        variant="outline"
                        onClick={handleRemoveDeployedUrl}
                        disabled={isSavingUrl}
                        className="text-destructive hover:text-destructive bg-transparent"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Remove URL
                      </Button>
                    )}
                    <div className="flex gap-2 sm:ml-auto">
                      <Button variant="outline" onClick={() => setIsEditingUrl(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSaveDeployedUrl} disabled={isSavingUrl}>
                        {isSavingUrl ? "Saving..." : "Save URL"}
                      </Button>
                    </div>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : (
              <Button variant="outline" size="sm" className="gap-2 bg-transparent hover:bg-accent/50 hover:text-accent-foreground border-muted-foreground">
                <Globe className="size-4" />
                <span className="hidden sm:inline">{deployedUrl ? "Preview URL" : "Add Preview URL"}</span>
              </Button>
            )}

            {/* Open deployed preview in new tab if exists */}
            {deployedUrl && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => window.open(deployedUrl, "_blank")}
              >
                <ExternalLink className="size-4" />
                <span className="sr-only">Open Live Preview</span>
              </Button>
            )}

            {/* Share Settings button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsShareSettingsOpen(true)}
              className="gap-2 bg-transparent hover:bg-accent/50 hover:text-accent-foreground border-muted-foreground"
            >
              <Share2 className="size-4" />
              <span className="hidden sm:inline">Share Settings</span>
            </Button>

            <Button variant="glass" asChild>
              <Link href={`/dashboard/projects/${project.id}/upload${currentFolderId ? `?folder=${currentFolderId}` : ""}`}>
                <Upload className="size-4" />
                <span className="font-normal">Upload Files</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Deployed Preview iframe or YouTube widget */}
        {deployedUrl && (() => {
          const youtubeVideoId = getYouTubeVideoId(deployedUrl)
          const isYouTube = !!youtubeVideoId
          const embedSrc = isYouTube
            ? `https://www.youtube.com/embed/${youtubeVideoId}?autoplay=0`
            : deployedUrl
          return (
            <Card className="mb-4 pb-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 -my-4">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  {isYouTube ? (
                    <Youtube className="size-4 text-red-500" />
                  ) : (
                    <Globe className="size-4 text-green-500" />
                  )}
                  Live Preview
                  {isYouTube && (
                    <span className="text-xs font-normal text-muted-foreground">YouTube</span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(deployedUrl, "_blank")}
                    className="hover:bg-accent/50 hover:text-accent-foreground border-muted-foreground"
                  >
                    <ExternalLink className="size-4" />
                    <span className="sr-only">Open in New Tab</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsEditingUrl(true)}
                    className="hover:bg-accent/50 hover:text-accent-foreground border-muted-foreground"
                  >
                    <Settings2 className="size-4" />
                    <span className="sr-only">Edit URL</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="relative w-full overflow-hidden rounded-b-lg border-t bg-muted/30 h-[280px] sm:h-[360px] md:h-[440px] lg:h-[524px]">
                  <iframe
                    src={embedSrc}
                    className="h-full w-full border-0"
                    title={isYouTube ? "YouTube video" : "Deployed Preview"}
                    allow={isYouTube ? "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" : undefined}
                    allowFullScreen={isYouTube}
                    sandbox={isYouTube ? undefined : "allow-scripts allow-same-origin allow-forms allow-popups"}
                  />
                </div>
              </CardContent>
            </Card>
          )
        })()}

        {/* Defer Tabs (and Radix IDs) until after mount to avoid server/client hydration mismatch */}
        {mounted ? (
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "grid" | "tree")} className="space-y-4">
            <TabsList className="w-full sm:w-auto grid grid-cols-2">
              <TabsTrigger value="tree" className="gap-1.5 sm:gap-2 text-xs sm:text-sm">
                <FolderTreeIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="truncate">Code View</span>
              </TabsTrigger>
              <TabsTrigger value="grid" className="gap-1.5 sm:gap-2 text-xs sm:text-sm">
                <LayoutGrid className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="truncate">Grid View</span>
              </TabsTrigger>
            </TabsList>

            {/* File Manager with drag-and-drop */}
            <TabsContent value="tree" className="mt-4">
              <FileManager
                projectId={project.id}
                projectName={project.name}
                folders={localTreeFolders}
                files={localTreeFiles}
                onDataChange={handleDataChange}
              />
            </TabsContent>

            {/* Traditional grid view */}
            <TabsContent value="grid" className="mt-4">
              <div className="grid gap-4 sm:gap-6 lg:grid-cols-[250px_1fr]">
                {/* Sidebar with folder tree */}
                <aside className="rounded-lg border bg-card p-4 order-2 lg:order-1 min-w-0">
                  <FolderTree
                    projectId={project.id}
                    folders={folders}
                    files={localTreeFiles.map((f) => ({
                      id: f.id,
                      originalFilename: f.originalFilename,
                      mimeType: f.mimeType,
                      folderId: f.folderId,
                    }))}
                    currentFolderId={currentFolderId || undefined}
                    onFolderSelect={handleFolderSelect}
                    onFoldersChange={setFolders}
                  />
                </aside>

                {/* Main content area */}
                <div className="space-y-4 order-1 lg:order-2 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {currentFolderId
                          ? folders.find((f) => f.id === currentFolderId)?.name || "Files"
                          : "All Files"}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {(() => {
                          const displayFolders = currentFolderId === null
                            ? folders.filter((f) => f.parentId === null)
                            : folders.filter((f) => f.parentId === currentFolderId)
                          const folderCount = displayFolders.length
                          const parts = []
                          if (folderCount > 0) parts.push(`${folderCount} folder${folderCount !== 1 ? "s" : ""}`)
                          parts.push(`${files.length} file${files.length !== 1 ? "s" : ""}`)
                          return parts.join(", ")
                        })()}
                      </p>
                    </div>
                  </div>

                  {isLoadingFiles ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                  ) : (
                    <FileGrid
                      files={files}
                      folders={
                        currentFolderId === null
                          ? folders.filter((f) => f.parentId === null)
                          : folders.filter((f) => f.parentId === currentFolderId)
                      }
                      onFilesChange={setFiles}
                      onFolderClick={(folderId) => setCurrentFolderId(folderId)}
                      showFolders={true}
                    />
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4" aria-hidden>
            <div className="w-full sm:w-auto grid grid-cols-2 rounded-lg bg-muted p-1 gap-1 max-w-[280px]">
              <div className="rounded-md bg-background px-3 py-2 flex items-center gap-2 text-xs sm:text-sm" />
              <div className="rounded-md px-3 py-2 flex items-center gap-2 text-xs sm:text-sm opacity-50" />
            </div>
            <div className="mt-4 min-h-[200px] rounded-lg border bg-card animate-pulse" />
          </div>
        )}

        {/* Project Share Settings Modal */}
        <ProjectShareSettingsModal
          projectId={project.id}
          projectName={project.name}
          open={isShareSettingsOpen}
          onOpenChange={setIsShareSettingsOpen}
          onSave={handleDataChange}
        />
      </main>
    </div>
  )
}
