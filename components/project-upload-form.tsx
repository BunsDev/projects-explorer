"use client"

import React from "react"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Upload, X, FileArchive, FileText, FileImage, File, CheckCircle2, Copy, Folder, FileCode, FileJson, Settings } from "lucide-react"
import { uploadFileAction } from "@/app/dashboard/actions"
import { cn } from "@/lib/utils"

// Filenames without extension that are allowed (e.g. Makefile)
const ALLOWED_FILENAMES_NO_EXT = ["Makefile", "makefile", "GNUmakefile"]

// Comprehensive list of supported file extensions
export const PROJECT_UPLOAD_SUPPORTED_EXTENSIONS = [
  // Archives
  ".zip", ".tar", ".gz", ".7z",
  // Documents
  ".pdf", ".doc", ".docx", ".txt", ".md", ".mdx", ".license",
  // Images
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".heif", ".heic", ".webp", ".ico",
  // Data files
  ".json", ".xml", ".csv", ".yaml", ".yml", ".toml", ".sql",
  // Code - JavaScript/TypeScript
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  // Code - Styles
  ".css", ".scss", ".sass", ".less",
  // Code - Other
  ".html", ".htm", ".vue", ".svelte",
  // Build / Make
  ".mk", ".mak",
  // Config files
  ".lock", ".env", ".gitignore", ".npmrc", ".nvmrc",
  // Shell/scripts
  ".sh", ".bash", ".zsh",
]

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

// Allowed dotfiles with their predefined titles
const ALLOWED_DOTFILES: Record<string, string> = {
  ".env.example": "envExample",
  ".gitignore": "gitignore",
}

// Check if a file should be excluded from upload
function shouldExcludeFile(file: File): { excluded: boolean; reason?: string } {
  const relativePath = (file as File & { relativePath?: string }).relativePath || file.name
  
  // Exclude files in node_modules directories
  if (relativePath.includes("node_modules/") || relativePath.includes("node_modules\\")) {
    return { excluded: true, reason: "node_modules" }
  }
  
  // Check if filename starts with a dot
  const filename = file.name
  if (filename.startsWith(".")) {
    // Allow specific dotfiles
    if (ALLOWED_DOTFILES[filename]) {
      return { excluded: false }
    }
    return { excluded: true, reason: "hidden file" }
  }
  
  return { excluded: false }
}

// Get predefined title for special files, or generate from filename
function getFileTitle(file: File): string {
  const filename = file.name
  
  // Check for predefined titles
  if (ALLOWED_DOTFILES[filename]) {
    return ALLOWED_DOTFILES[filename]
  }
  
  // Default: filename without extension
  return filename.replace(/\.[^/.]+$/, "")
}

// Helper to read all files from a dropped folder recursively
async function getFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const files: File[] = []
  const items = Array.from(dataTransfer.items)

  const readEntry = async (entry: FileSystemEntry, path = ""): Promise<void> => {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry
      const file = await new Promise<File>((resolve) => {
        fileEntry.file((f) => {
          // Preserve relative path for display
          Object.defineProperty(f, "relativePath", {
            value: path ? `${path}/${f.name}` : f.name,
            writable: false,
          })
          resolve(f)
        })
      })
      files.push(file)
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry
      const reader = dirEntry.createReader()
      const entries = await new Promise<FileSystemEntry[]>((resolve) => {
        reader.readEntries((entries) => resolve(entries))
      })
      for (const childEntry of entries) {
        await readEntry(childEntry, path ? `${path}/${entry.name}` : entry.name)
      }
    }
  }

  for (const item of items) {
    if (item.kind === "file") {
      const entry = item.webkitGetAsEntry()
      if (entry) {
        await readEntry(entry)
      }
    }
  }

  return files
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase()
  // Archives
  if (["zip", "tar", "gz", "7z"].includes(ext || "")) {
    return <FileArchive className="h-8 w-8 text-amber-500" />
  }
  // Documents
  if (["pdf", "doc", "docx", "txt", "md", "mdx", "license"].includes(ext || "")) {
    return <FileText className="h-8 w-8 text-blue-500" />
  }
  // Images
  if (["png", "jpg", "jpeg", "gif", "svg", "heif", "heic", "webp", "ico"].includes(ext || "")) {
    return <FileImage className="h-8 w-8 text-emerald-500" />
  }
  // Code files
  if (["js", "jsx", "ts", "tsx", "mjs", "cjs", "vue", "svelte", "html", "htm"].includes(ext || "")) {
    return <FileCode className="h-8 w-8 text-violet-500" />
  }
  // Style files
  if (["css", "scss", "sass", "less"].includes(ext || "")) {
    return <FileCode className="h-8 w-8 text-pink-500" />
  }
  // Data/config files
  if (["json", "xml", "csv", "yaml", "yml", "toml", "sql"].includes(ext || "")) {
    return <FileJson className="h-8 w-8 text-orange-500" />
  }
  // Config/lock files
  if (["lock", "env", "gitignore", "npmrc", "nvmrc", "sh", "bash", "zsh"].includes(ext || "")) {
    return <Settings className="h-8 w-8 text-gray-500" />
  }
  return <File className="h-8 w-8 text-muted-foreground" />
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

interface ProjectUploadFormProps {
  projectId: string
  folderId: string | null
  folders: { id: string; name: string; parentId: string | null }[]
}

type QueuedFile = {
  file: File
  title: string
  relativePath?: string
}

type UploadResult = {
  filename: string
  publicId?: string
  error?: string
}

export function ProjectUploadForm({ projectId, folderId: initialFolderId, folders }: ProjectUploadFormProps) {
  const router = useRouter()
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([])
  const [description, setDescription] = useState("")
  const [selectedFolderId, setSelectedFolderId] = useState<string>(initialFolderId || "root")
  const [expiresAt, setExpiresAt] = useState("")
  const [sharePassword, setSharePassword] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<UploadResult[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [success, setSuccess] = useState<{ publicId: string } | null>(null)
  const [preserveFolderStructure, setPreserveFolderStructure] = useState(true)

  // Check if any files have folder paths
  const hasNestedFiles = queuedFiles.some((f) => f.relativePath?.includes("/"))

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name}: File size (${formatBytes(file.size)}) exceeds the 10MB limit`
    }

    // Allow Makefile / makefile / GNUmakefile (no extension)
    if (ALLOWED_FILENAMES_NO_EXT.includes(file.name)) {
      return null
    }

    const ext = `.${file.name.split(".").pop()?.toLowerCase()}`
    if (!PROJECT_UPLOAD_SUPPORTED_EXTENSIONS.includes(ext)) {
      const extLabel = ext === "." ? "no extension" : `extension "${ext}"`
      return `${file.name}: Unsupported file type — ${extLabel} is not in the allowed list`
    }

    return null
  }

  const handleFiles = (files: File[]) => {
    const validFiles: QueuedFile[] = []
    const errors: string[] = []
    let excludedCount = 0

    for (const file of files) {
      // First check if file should be excluded (node_modules, dotfiles)
      const exclusion = shouldExcludeFile(file)
      if (exclusion.excluded) {
        excludedCount++
        continue // Silently skip excluded files
      }

      // Then validate file type and size
      const validationError = validateFile(file)
      if (validationError) {
        errors.push(validationError)
      } else {
        const relativePath = (file as File & { relativePath?: string }).relativePath
        validFiles.push({
          file,
          title: getFileTitle(file),
          relativePath,
        })
      }
    }

    // Build status message — show all errors in full and make unsupported types clear
    const messages: string[] = []
    if (excludedCount > 0) {
      messages.push(`${excludedCount} file${excludedCount !== 1 ? "s" : ""} excluded (node_modules or hidden files)`)
    }
    if (errors.length > 0) {
      messages.push("The following files were not included:")
      messages.push(errors.join("\n"))
    }

    if (messages.length > 0) {
      setError(messages.join("\n\n"))
    } else {
      setError(null)
    }

    if (validFiles.length > 0) {
      setQueuedFiles((prev) => [...prev, ...validFiles])
    }
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    // Check if it's a folder drop using webkitGetAsEntry
    const items = Array.from(e.dataTransfer.items)
    const hasDirectory = items.some((item) => {
      const entry = item.webkitGetAsEntry()
      return entry?.isDirectory
    })

    if (hasDirectory) {
      // Folder drop - recursively get all files
      const files = await getFilesFromDataTransfer(e.dataTransfer)
      handleFiles(files)
    } else {
      // Regular file drop
      const files = Array.from(e.dataTransfer.files)
      handleFiles(files)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      handleFiles(files)
    }
    // Reset input so same file can be selected again
    e.target.value = ""
  }

  const removeFile = (index: number) => {
    setQueuedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const updateFileTitle = (index: number, newTitle: string) => {
    setQueuedFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, title: newTitle } : f))
    )
  }

  const clearAllFiles = () => {
    setQueuedFiles([])
    setError(null)
  }

  const handleFile = (selectedFile: File) => {
    const validationError = validateFile(selectedFile)
    if (validationError) {
      setError(validationError)
    } else {
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "")
      setFile(selectedFile)
      setTitle(nameWithoutExt)
      setError(null)
    }
  }

  const clearFile = () => {
    setFile(null)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (queuedFiles.length === 0) {
      setError("Please select at least one file")
      return
    }

    // Check all files have titles
    const missingTitles = queuedFiles.filter((f) => !f.title.trim())
    if (missingTitles.length > 0) {
      const fileNames = missingTitles.slice(0, 3).map((f) => f.file.name).join(", ")
      const moreCount = missingTitles.length > 3 ? ` and ${missingTitles.length - 3} more` : ""
      setError(`Missing title for: ${fileNames}${moreCount}. Each file needs a title before uploading.`)
      return
    }

    setIsUploading(true)
    setError(null)
    setUploadProgress({ current: 0, total: queuedFiles.length })

    const uploadResults: UploadResult[] = []

    for (let i = 0; i < queuedFiles.length; i++) {
      const queuedFile = queuedFiles[i]
      setUploadProgress({ current: i + 1, total: queuedFiles.length })

      const formData = new FormData()
      formData.append("file", queuedFile.file)
      formData.append("title", queuedFile.title)
      formData.append("description", description)
      formData.append("projectId", projectId)
      formData.append("folderId", selectedFolderId === "root" ? "" : selectedFolderId)
      // Include relative path to auto-create folder structure (if enabled)
      if (preserveFolderStructure && queuedFile.relativePath) {
        formData.append("relativePath", queuedFile.relativePath)
      }
      if (expiresAt) {
        formData.append("expiresAt", new Date(expiresAt).toISOString())
      }
      if (sharePassword.trim()) {
        formData.append("sharePassword", sharePassword)
      }

      const result = await uploadFileAction(formData)

      uploadResults.push({
        filename: queuedFile.file.name,
        publicId: result.publicId,
        error: result.error,
      })
    }

    setResults(uploadResults)
    setIsUploading(false)
    setUploadProgress(null)
  }

  const copyLink = async (publicId: string) => {
    const url = `${window.location.origin}/share/${publicId}`
    await navigator.clipboard.writeText(url)
    setCopied(publicId)
    setTimeout(() => setCopied(null), 2000)
  }

  const uploadAnother = () => {
    setQueuedFiles([])
    setDescription("")
    setExpiresAt("")
    setSharePassword("")
    setResults([])
    setError(null)
  }

  const uploadMore = () => {
    setQueuedFiles([])
    setDescription("")
    setExpiresAt("")
    setSharePassword("")
    setResults([])
    setError(null)
  }

  // Build folder path for display
  const getFolderPath = (folderId: string): string => {
    const folder = folders.find((f) => f.id === folderId)
    if (!folder) return ""
    if (folder.parentId) {
      return `${getFolderPath(folder.parentId)} / ${folder.name}`
    }
    return folder.name
  }

  if (results.length > 0) {
    const successCount = results.filter((r) => r.publicId).length
    const failCount = results.filter((r) => r.error).length

    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center text-center">
            <div className="rounded-full bg-emerald-100 p-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">
              Upload Complete!
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {successCount} file{successCount !== 1 ? "s" : ""} uploaded successfully
              {failCount > 0 && `, ${failCount} failed`}
            </p>
          </div>

          <div className="mt-6 max-h-64 space-y-2 overflow-y-auto">
            {results.map((result, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3",
                  result.error ? "border-destructive/50 bg-destructive/5" : "border-muted"
                )}
              >
                {result.publicId ? (
                  <>
                    {getFileIcon(result.filename)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{result.filename}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        /share/{result.publicId}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyLink(result.publicId!)}
                    >
                      <Copy className="h-4 w-4" />
                      {copied === result.publicId && (
                        <span className="ml-1 text-xs">Copied!</span>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <X className="h-5 w-5 text-destructive" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{result.filename}</p>
                      <p className="text-xs text-destructive whitespace-pre-wrap break-words">{result.error}</p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3 justify-center">
            <Button variant="outline" onClick={uploadMore}>
              Upload More
            </Button>
            <Button onClick={() => router.push(`/dashboard/projects/${projectId}`)}>
              Back to Project
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Drop Zone */}
          <div
            className={cn(
              "relative rounded-lg border-2 border-dashed p-8 transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="flex flex-col items-center text-center">
              <div className="flex gap-2">
                <div className="rounded-full bg-muted p-3">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="rounded-full bg-muted p-3">
                  <Folder className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
              <p className="mt-4 font-medium">Drop files or folders here, or click to browse</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Max 100MB per file. Supports images, documents, code, configs, and more.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                node_modules and hidden files are automatically excluded (except .env.example, .gitignore)
              </p>
              <input
                type="file"
                onChange={handleFileInput}
                accept={PROJECT_UPLOAD_SUPPORTED_EXTENSIONS.join(",")}
                multiple
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </div>
          </div>

          {/* Queued Files */}
          {queuedFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{queuedFiles.length} file{queuedFiles.length !== 1 ? "s" : ""} queued</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Total size: {formatBytes(queuedFiles.reduce((sum, f) => sum + f.file.size, 0))}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={clearAllFiles}>
                  Clear All
                </Button>
              </div>

              {/* Preserve folder structure toggle - only show when there are nested paths */}
              {hasNestedFiles && (
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="preserve-structure" className="text-sm font-medium">
                      Preserve folder structure
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically create subfolders matching the uploaded folder hierarchy
                    </p>
                  </div>
                  <Switch
                    id="preserve-structure"
                    checked={preserveFolderStructure}
                    onCheckedChange={setPreserveFolderStructure}
                  />
                </div>
              )}

              <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-2">
                {queuedFiles.map((qf, idx) => (
                  <div key={idx} className="flex items-center gap-3 rounded-md bg-muted/50 p-2">
                    {getFileIcon(qf.file.name)}
                    <div className="flex-1 min-w-0 space-y-1">
                      <Input
                        value={qf.title}
                        onChange={(e) => updateFileTitle(idx, e.target.value)}
                        placeholder="Title"
                        className="h-8 text-sm"
                      />
                      <p className="text-xs text-muted-foreground truncate">
                        {preserveFolderStructure && qf.relativePath?.includes("/") ? (
                          <span className="flex items-center gap-1">
                            <Folder className="h-3 w-3" />
                            {qf.relativePath}
                          </span>
                        ) : (
                          qf.file.name
                        )} ({formatBytes(qf.file.size)})
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(idx)}
                      className="shrink-0 h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Folder Selection */}
          <div className="space-y-2">
            <Label htmlFor="folder">Folder</Label>
            <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">Root (No folder)</SelectItem>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {getFolderPath(folder.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Expiration */}
          <div className="space-y-2">
            <Label htmlFor="expires">Expiration Date (optional)</Label>
            <Input
              id="expires"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty for no expiration
            </p>
          </div>

          {/* Share password (optional) */}
          <div className="space-y-2">
            <Label htmlFor="sharePassword">Share password (optional)</Label>
            <Input
              id="sharePassword"
              type="password"
              value={sharePassword}
              onChange={(e) => setSharePassword(e.target.value)}
              placeholder="Require password to download"
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              If set, anyone with the link must enter this password to download
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive whitespace-pre-wrap max-h-64 overflow-y-auto">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/dashboard/projects/${projectId}`)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isUploading || queuedFiles.length === 0} className="flex-1">
              {isUploading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Uploading {uploadProgress?.current}/{uploadProgress?.total}...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload {queuedFiles.length > 0 ? `${queuedFiles.length} File${queuedFiles.length !== 1 ? "s" : ""}` : "Files"}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
