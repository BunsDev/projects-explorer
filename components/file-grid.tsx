"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  FileArchive,
  FileText,
  FileImage,
  FileJson,
  FileCode,
  File,
  Folder,
  FolderOpen,
  MoreVertical,
  Download,
  Trash2,
  Copy,
  ExternalLink,
} from "lucide-react"
import { deleteFileAction } from "@/app/dashboard/actions"

type FolderType = {
  id: string
  name: string
  parentId: string | null
  fileCount: number
  createdAt: Date
}

type FileType = {
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

function getFileIcon(mimeType: string) {
  if (mimeType.includes("zip") || mimeType.includes("tar") || mimeType.includes("gzip")) {
    return <FileArchive className="h-8 w-8" />
  }
  if (mimeType.includes("pdf") || mimeType.includes("document") || mimeType.includes("msword")) {
    return <FileText className="h-8 w-8" />
  }
  if (mimeType.startsWith("image/")) {
    return <FileImage className="h-8 w-8" />
  }
  if (mimeType.includes("json")) {
    return <FileJson className="h-8 w-8" />
  }
  if (mimeType.includes("xml") || mimeType.includes("csv") || mimeType === "text/plain") {
    return <FileCode className="h-8 w-8" />
  }
  return <File className="h-8 w-8" />
}

function getFileColor(mimeType: string) {
  if (mimeType.includes("zip") || mimeType.includes("tar") || mimeType.includes("gzip")) {
    return "text-amber-500"
  }
  if (mimeType.includes("pdf")) {
    return "text-red-500"
  }
  if (mimeType.includes("document") || mimeType.includes("msword")) {
    return "text-blue-500"
  }
  if (mimeType.startsWith("image/")) {
    return "text-emerald-500"
  }
  if (mimeType.includes("json") || mimeType.includes("xml")) {
    return "text-purple-500"
  }
  return "text-muted-foreground"
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date))
}

interface FileGridProps {
  files: FileType[]
  folders?: FolderType[]
  onFilesChange: (files: FileType[]) => void
  onFolderClick?: (folderId: string) => void
  showFolders?: boolean
}

export function FileGrid({ files, folders = [], onFilesChange, onFolderClick, showFolders = true }: FileGridProps) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<FileType | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!selectedFile) return

    setIsLoading(true)

    const result = await deleteFileAction(selectedFile.id)

    if (result.success) {
      onFilesChange(files.filter((f) => f.id !== selectedFile.id))
    }

    setIsDeleteOpen(false)
    setSelectedFile(null)
    setIsLoading(false)
  }

  const copyLink = async (publicId: string) => {
    const url = `${window.location.origin}/share/${publicId}`
    await navigator.clipboard.writeText(url)
    setCopiedId(publicId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const openDeleteDialog = (file: FileType) => {
    setSelectedFile(file)
    setIsDeleteOpen(true)
  }

  const displayFolders = showFolders ? folders : []
  const hasContent = files.length > 0 || displayFolders.length > 0

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileArchive className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">No files yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload files to this folder to see them here
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Folders first */}
        {displayFolders.map((folder) => (
          <Card 
            key={`folder-${folder.id}`} 
            className="group relative overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
            onClick={() => onFolderClick?.(folder.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="rounded-lg bg-muted p-3 text-amber-500">
                  <Folder className="h-8 w-8" />
                </div>
              </div>

              <div className="mt-3 space-y-1">
                <h3 className="font-medium leading-tight line-clamp-1" title={folder.name}>
                  {folder.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {folder.fileCount} file{folder.fileCount !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="mt-3 text-xs text-muted-foreground">
                {formatDate(folder.createdAt)}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Files */}
        {files.map((file) => (
          <Card key={file.id} className="group relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className={`rounded-lg bg-muted p-3 ${getFileColor(file.mimeType)}`}>
                  {getFileIcon(file.mimeType)}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <a href={`/share/${file.publicId}`} target="_blank" rel="noopener noreferrer">
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => copyLink(file.publicId)}>
                      <Copy className="mr-2 h-4 w-4" />
                      {copiedId === file.publicId ? "Copied!" : "Copy Link"}
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={`/share/${file.publicId}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open in New Tab
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => openDeleteDialog(file)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-3 space-y-1">
                <h3 className="font-medium leading-tight line-clamp-1" title={file.title}>
                  {file.title}
                </h3>
                <p className="text-xs text-muted-foreground truncate" title={file.originalFilename}>
                  {file.originalFilename}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatBytes(file.fileSize)}</span>
                <span>{file.downloadCount} downloads</span>
              </div>

              <div className="mt-2 text-xs text-muted-foreground">
                {formatDate(file.createdAt)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedFile?.title}&quot;? This will permanently
              remove the file and its download link will stop working. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedFile(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isLoading ? "Deleting..." : "Delete File"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
