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
import { Upload, FolderTree as FolderTreeIcon, LayoutGrid, Globe, ExternalLink, Settings2, X } from "lucide-react"
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
  
  // Deployed URL state
  const [deployedUrl, setDeployedUrl] = useState(project.deployedUrl || "")
  const [isEditingUrl, setIsEditingUrl] = useState(false)
  const [urlInput, setUrlInput] = useState(project.deployedUrl || "")
  const [isSavingUrl, setIsSavingUrl] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)

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
    <div className="min-h-screen bg-background">
      <DashboardHeader title={project.name ?? "Project"} />
      <main className="container px-4 sm:px-6 py-6">
        <div className="mb-6 flex items-center justify-between">
          <BreadcrumbNav items={getBreadcrumbPath()} />
          <div className="flex items-center gap-2">
            {/* Deployed URL button/indicator */}
            <Dialog open={isEditingUrl} onOpenChange={setIsEditingUrl}>
              <DialogTrigger asChild>
                {deployedUrl ? (
                  <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                    <Globe className="h-4 w-4 text-green-500" />
                    Preview
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                    <Globe className="h-4 w-4" />
                    Add Preview URL
                  </Button>
                )}
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

            {/* Open deployed preview in new tab if exists */}
            {deployedUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(deployedUrl, "_blank")}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Live
              </Button>
            )}

            <Button asChild>
              <Link
                href={`/dashboard/projects/${project.id}/upload${currentFolderId ? `?folder=${currentFolderId}` : ""}`}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Files
              </Link>
            </Button>
          </div>
        </div>

        {/* Deployed Preview iframe */}
        {deployedUrl && (
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Globe className="h-4 w-4 text-green-500" />
                Live Preview
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(deployedUrl, "_blank")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in New Tab
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingUrl(true)}
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative w-full overflow-hidden rounded-b-lg border-t bg-muted/30" style={{ height: "500px" }}>
                <iframe
                  src={deployedUrl}
                  className="h-full w-full border-0"
                  title="Deployed Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "grid" | "tree")} className="space-y-4">
          <TabsList>
            <TabsTrigger value="tree" className="gap-2">
              <FolderTreeIcon className="h-4 w-4" />
              Code View
            </TabsTrigger>
            <TabsTrigger value="grid" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              Grid View
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
            <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
              {/* Sidebar with folder tree */}
              <aside className="rounded-lg border bg-card p-4">
                <FolderTree
                  projectId={project.id}
                  folders={folders}
                  currentFolderId={currentFolderId || undefined}
                  onFolderSelect={handleFolderSelect}
                  onFoldersChange={setFolders}
                />
              </aside>

              {/* Main content area */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {currentFolderId
                        ? folders.find((f) => f.id === currentFolderId)?.name || "Files"
                        : "All Files"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {files.length} file{files.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {isLoadingFiles ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                ) : (
                  <FileGrid files={files} onFilesChange={setFiles} />
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
