"use client"

import React from "react"

import { useState, useCallback, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FolderPlus,
  File,
  FileCode,
  FileJson,
  FileText,
  FileImage,
  FileArchive,
  MoreVertical,
  Trash2,
  Pencil,
  Copy,
  ExternalLink,
  Check,
  X,
  Move,
  GripVertical,
  Settings2,
  RefreshCw,
  Link2,
} from "lucide-react"
import { FileShareSettingsModal } from "@/components/share-settings"
import {
  createFolderAction,
  renameFolderAction,
  deleteFolderAction,
  deleteFileAction,
  moveFileAction,
  moveFilesAction,
  moveFolderAction,
  getFileContentAction,
  regenerateShareLinkAction,
} from "@/app/dashboard/actions"
import { useToast } from "@/hooks/use-toast"

// Types
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

interface FileManagerProps {
  projectId: string
  projectName: string
  folders: TreeFolder[]
  files: TreeFile[]
  onDataChange?: () => void
}

// Helper functions
function getFileIcon(filename: string, mimeType: string, size: "sm" | "md" = "sm") {
  const iconClass = size === "sm" ? "h-4 w-4" : "h-5 w-5"
  const ext = filename.split(".").pop()?.toLowerCase()

  if (mimeType.includes("zip") || mimeType.includes("tar") || mimeType.includes("gzip")) {
    return <FileArchive className={cn(iconClass, "text-amber-500")} />
  }
  if (["js", "jsx", "ts", "tsx", "mjs", "cjs", "vue", "svelte", "html", "css", "scss"].includes(ext || "")) {
    return <FileCode className={cn(iconClass, "text-violet-500")} />
  }
  if (["json", "xml", "yaml", "yml", "toml", "lock"].includes(ext || "")) {
    return <FileJson className={cn(iconClass, "text-orange-500")} />
  }
  if (mimeType.startsWith("image/")) {
    return <FileImage className={cn(iconClass, "text-emerald-500")} />
  }
  if (["md", "mdx", "txt", "pdf", "doc", "docx"].includes(ext || "")) {
    return <FileText className={cn(iconClass, "text-blue-500")} />
  }
  return <File className={cn(iconClass, "text-muted-foreground")} />
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

// Tree node types
type TreeNode = {
  type: "folder" | "file"
  id: string
  name: string
  parentId?: string | null
  children?: TreeNode[]
  file?: TreeFile
  folder?: TreeFolder
}

function buildTree(folders: TreeFolder[], files: TreeFile[]): TreeNode[] {
  const folderNodes = new Map<string, TreeNode>()

  // Create folder nodes
  for (const folder of folders) {
    folderNodes.set(folder.id, {
      type: "folder",
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      children: [],
      folder,
    })
  }

  // Build folder hierarchy
  const rootItems: TreeNode[] = []
  for (const folder of folders) {
    const node = folderNodes.get(folder.id)!
    if (folder.parentId) {
      const parent = folderNodes.get(folder.parentId)
      if (parent?.children) {
        parent.children.push(node)
      }
    } else {
      rootItems.push(node)
    }
  }

  // Add files
  for (const file of files) {
    const fileNode: TreeNode = {
      type: "file",
      id: file.id,
      name: file.originalFilename,
      file,
    }
    if (file.folderId) {
      const folder = folderNodes.get(file.folderId)
      if (folder?.children) {
        folder.children.push(fileNode)
      }
    } else {
      rootItems.push(fileNode)
    }
  }

  // Sort: folders first, then alphabetically
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    for (const node of nodes) {
      if (node.children) sortNodes(node.children)
    }
  }
  sortNodes(rootItems)
  return rootItems
}

// Tree line connector component for visual hierarchy
function TreeConnector({ depth, isLast, parentIsLast }: { depth: number; isLast: boolean; parentIsLast: boolean[] }) {
  if (depth === 0) return null

  return (
    <div className="flex" style={{ width: `${depth * 20}px` }}>
      {Array.from({ length: depth }).map((_, i) => {
        const showVerticalLine = i < depth - 1 && !parentIsLast[i]
        const isLastLevel = i === depth - 1

        return (
          <div key={i} className="relative w-5 h-full flex-shrink-0">
            {/* Vertical line continuing from parent */}
            {showVerticalLine && (
              <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
            )}
            {/* Connector lines at the last level */}
            {isLastLevel && (
              <>
                {/* Vertical line to current item */}
                <div
                  className={cn(
                    "absolute left-2 w-px bg-border",
                    isLast ? "top-0 h-3.5" : "top-0 bottom-0"
                  )}
                />
                {/* Horizontal line to item */}
                <div className="absolute left-2 top-3.5 w-2.5 h-px bg-border" />
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Draggable item component
function DraggableItem({
  node,
  depth,
  isExpanded,
  isSelected,
  isDragOver,
  isLast,
  parentIsLast,
  selectedIds,
  onToggle,
  onSelect,
  onMultiSelect,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onContextMenu,
  onDoubleClick,
}: {
  node: TreeNode
  depth: number
  isExpanded: boolean
  isSelected: boolean
  isDragOver: boolean
  isLast: boolean
  parentIsLast: boolean[]
  selectedIds: Set<string>
  onToggle: () => void
  onSelect: (e: React.MouseEvent) => void
  onMultiSelect: (checked: boolean) => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  onDoubleClick: () => void
}) {
  const isFolder = node.type === "folder"
  const hasChildren = isFolder && node.children && node.children.length > 0

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      onClick={onSelect}
      className={cn(
        "group flex items-center h-7 text-sm cursor-pointer select-none transition-colors",
        "hover:bg-muted/50",
        isSelected && "bg-primary/10 hover:bg-primary/15",
        isDragOver && isFolder && "bg-primary/20 ring-2 ring-primary ring-inset"
      )}
    >
      {/* Tree connector lines */}
      <TreeConnector depth={depth} isLast={isLast} parentIsLast={parentIsLast} />

      {/* Selection checkbox - appears on hover */}
      <div className="w-5 flex items-center justify-center flex-shrink-0">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onMultiSelect}
          onClick={(e) => e.stopPropagation()}
          className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 data-[state=checked]:opacity-100"
        />
      </div>

      {/* Expand/collapse for folders */}
      <div className="w-5 flex items-center justify-center flex-shrink-0">
        {isFolder ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            className="p-0.5 hover:bg-muted rounded"
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )
            ) : (
              <span className="w-3.5" />
            )}
          </button>
        ) : null}
      </div>

      {/* Icon */}
      <div className="w-5 flex items-center justify-center flex-shrink-0">
        {isFolder ? (
          isExpanded ? (
            <FolderOpen className="h-4 w-4 text-amber-500" />
          ) : (
            <Folder className="h-4 w-4 text-amber-500" />
          )
        ) : (
          getFileIcon(node.name, node.file?.mimeType || "")
        )}
      </div>

      {/* Name */}
      <span className="truncate flex-1 px-1.5">{node.name}</span>

      {/* Size for files */}
      {node.file && (
        <span className="text-xs text-muted-foreground pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {formatBytes(node.file.fileSize)}
        </span>
      )}

      {/* Drag handle indicator */}
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 mr-2 flex-shrink-0" />
    </div>
  )
}

// File preview component
function FilePreview({
  file,
  onClose,
}: {
  file: TreeFile
  onClose: () => void
}) {
  const [content, setContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const loadContent = async () => {
      setIsLoading(true)
      const result = await getFileContentAction(file.id)
      if (result.success && result.content !== undefined) {
        setContent(result.content)
      }
      setIsLoading(false)
    }
    loadContent()
  }, [file.id])

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/share/${file.publicId}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isImage = file.mimeType.startsWith("image/")
  const isPdf = file.mimeType === "application/pdf"

  return (
    <div className="flex h-full flex-col border-l bg-background">
      <div className="flex items-center justify-between border-b px-4 py-2 bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          {getFileIcon(file.originalFilename, file.mimeType, "md")}
          <span className="truncate font-medium">{file.originalFilename}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={copyLink}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href={file.blobUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : isImage ? (
          <div className="flex h-full items-center justify-center bg-[#0d1117] p-4">
            <img src={file.blobUrl || "/placeholder.svg"} alt={file.originalFilename} className="max-h-full max-w-full object-contain" />
          </div>
        ) : isPdf ? (
          <iframe src={file.blobUrl} className="h-full w-full" title={file.originalFilename} />
        ) : content !== null ? (
          <ScrollArea className="h-full">
            <pre className="bg-[#0d1117] p-4 text-sm text-[#c9d1d9] font-mono leading-relaxed">
              <code>{content}</code>
            </pre>
          </ScrollArea>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
            <FileText className="h-16 w-16" />
            <p>Preview not available</p>
            <Button variant="outline" asChild>
              <a href={file.blobUrl} target="_blank" rel="noopener noreferrer">
                Open in new tab
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export function FileManager({
  projectId,
  projectName,
  folders,
  files,
  onDataChange,
}: FileManagerProps) {
  // State
  const [localFolders, setLocalFolders] = useState(folders)
  const [localFiles, setLocalFiles] = useState(files)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [previewFile, setPreviewFile] = useState<TreeFile | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [isMoving, setIsMoving] = useState(false)

  // Dialog states
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [createFolderParent, setCreateFolderParent] = useState<string | null>(null)
  const [renameFolderOpen, setRenameFolderOpen] = useState(false)
  const [renameFolder, setRenameFolder] = useState<TreeFolder | null>(null)
  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false)
  const [deleteFolder, setDeleteFolder] = useState<TreeFolder | null>(null)
  const [deleteFilesOpen, setDeleteFilesOpen] = useState(false)
  const [folderName, setFolderName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // File share settings modal state
  const [shareSettingsFileId, setShareSettingsFileId] = useState<string | null>(null)
  const [shareSettingsFileName, setShareSettingsFileName] = useState<string>("")

  // Toast for notifications
  const { toast } = useToast()

  // Handler to regenerate a file's share link
  const handleRegenerateLink = useCallback(async (fileId: string, fileName: string) => {
    const confirmed = confirm(`Regenerate share link for "${fileName}"? This will invalidate the current link.`)
    if (!confirmed) return

    const result = await regenerateShareLinkAction(fileId)
    if (result.success && result.publicId) {
      const newUrl = `${window.location.origin}/share/${result.publicId}`
      await navigator.clipboard.writeText(newUrl)
      toast({
        title: "Link Regenerated",
        description: "New share link copied to clipboard.",
      })
      onDataChange?.()
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to regenerate link",
        variant: "destructive",
      })
    }
  }, [toast, onDataChange])

  // Build tree
  const tree = buildTree(localFolders, localFiles)

  // Selection helpers
  const getSelectedItems = useCallback(() => {
    const selectedFolders = localFolders.filter((f) => selectedIds.has(f.id))
    const selectedFiles = localFiles.filter((f) => selectedIds.has(f.id))
    return { folders: selectedFolders, files: selectedFiles }
  }, [localFolders, localFiles, selectedIds])

  // Handlers
  const toggleFolder = useCallback((id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleSelect = useCallback((id: string, e: React.MouseEvent) => {
    if (e.shiftKey && selectedIds.size > 0) {
      // Range selection (simplified - just toggle for now)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })
    } else if (e.ctrlKey || e.metaKey) {
      // Multi-select
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })
    } else {
      // Single select
      setSelectedIds(new Set([id]))
    }
  }, [selectedIds])

  const handleMultiSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])

  // Drag and drop
  const handleDragStart = useCallback((e: React.DragEvent, node: TreeNode) => {
    // If dragging an unselected item, select only it
    if (!selectedIds.has(node.id)) {
      setSelectedIds(new Set([node.id]))
    }

    const dragData = {
      ids: selectedIds.has(node.id) ? Array.from(selectedIds) : [node.id],
      type: node.type,
    }
    e.dataTransfer.setData("application/json", JSON.stringify(dragData))
    e.dataTransfer.effectAllowed = "move"
  }, [selectedIds])

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string | null, isFolder: boolean) => {
    e.preventDefault()
    if (isFolder || targetId === null) {
      setDragOverId(targetId)
      e.dataTransfer.dropEffect = "move"
    }
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverId(null)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault()
    setDragOverId(null)

    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"))
      const { ids } = data as { ids: string[]; type: string }

      // Don't drop on self
      if (ids.includes(targetFolderId || "")) {
        return
      }

      setIsMoving(true)

      // Separate files and folders
      const fileIds = ids.filter((id) => localFiles.some((f) => f.id === id))
      const folderIds = ids.filter((id) => localFolders.some((f) => f.id === id))

      // Move files
      if (fileIds.length > 0) {
        const result = await moveFilesAction(fileIds, targetFolderId)
        if (result.success) {
          setLocalFiles((prev) =>
            prev.map((f) => (fileIds.includes(f.id) ? { ...f, folderId: targetFolderId } : f))
          )
        }
      }

      // Move folders
      for (const folderId of folderIds) {
        const result = await moveFolderAction(folderId, targetFolderId)
        if (result.success) {
          setLocalFolders((prev) =>
            prev.map((f) => (f.id === folderId ? { ...f, parentId: targetFolderId } : f))
          )
        }
      }

      setSelectedIds(new Set())
      onDataChange?.()
    } catch {
      // Invalid drop data
    } finally {
      setIsMoving(false)
    }
  }, [localFiles, localFolders, onDataChange])

  // Create folder
  const handleCreateFolder = async () => {
    if (!folderName.trim()) return

    setIsLoading(true)
    setError(null)

    const result = await createFolderAction(projectId, folderName.trim(), createFolderParent || undefined)

    if (result.success && result.folderId) {
      setLocalFolders((prev) => [
        ...prev,
        { id: result.folderId!, name: folderName.trim(), parentId: createFolderParent },
      ])
      setCreateFolderOpen(false)
      setFolderName("")
      setCreateFolderParent(null)
      onDataChange?.()
    } else {
      setError(result.error || "Failed to create folder")
    }

    setIsLoading(false)
  }

  // Rename folder
  const handleRenameFolder = async () => {
    if (!renameFolder || !folderName.trim()) return

    setIsLoading(true)
    setError(null)

    const result = await renameFolderAction(renameFolder.id, folderName.trim())

    if (result.success) {
      setLocalFolders((prev) =>
        prev.map((f) => (f.id === renameFolder.id ? { ...f, name: folderName.trim() } : f))
      )
      setRenameFolderOpen(false)
      setRenameFolder(null)
      setFolderName("")
      onDataChange?.()
    } else {
      setError(result.error || "Failed to rename folder")
    }

    setIsLoading(false)
  }

  // Delete folder
  const handleDeleteFolder = async () => {
    if (!deleteFolder) return

    setIsLoading(true)

    const result = await deleteFolderAction(deleteFolder.id)

    if (result.success) {
      // Remove folder and all descendants
      const idsToRemove = new Set<string>()
      const collectIds = (id: string) => {
        idsToRemove.add(id)
        localFolders.filter((f) => f.parentId === id).forEach((f) => collectIds(f.id))
      }
      collectIds(deleteFolder.id)

      setLocalFolders((prev) => prev.filter((f) => !idsToRemove.has(f.id)))
      setLocalFiles((prev) => prev.filter((f) => !f.folderId || !idsToRemove.has(f.folderId)))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const id of idsToRemove) next.delete(id)
        return next
      })
      onDataChange?.()
    }

    setDeleteFolderOpen(false)
    setDeleteFolder(null)
    setIsLoading(false)
  }

  // Delete selected files
  const handleDeleteFiles = async () => {
    const { files: selectedFiles } = getSelectedItems()

    setIsLoading(true)

    for (const file of selectedFiles) {
      await deleteFileAction(file.id)
    }

    setLocalFiles((prev) => prev.filter((f) => !selectedIds.has(f.id)))
    setSelectedIds(new Set())
    setDeleteFilesOpen(false)
    setIsLoading(false)
    onDataChange?.()
  }

  // Context menu handlers
  const openCreateFolder = (parentId: string | null) => {
    setCreateFolderParent(parentId)
    setFolderName("")
    setError(null)
    setCreateFolderOpen(true)
  }

  const openRenameFolder = (folder: TreeFolder) => {
    setRenameFolder(folder)
    setFolderName(folder.name)
    setError(null)
    setRenameFolderOpen(true)
  }

  const openDeleteFolder = (folder: TreeFolder) => {
    setDeleteFolder(folder)
    setDeleteFolderOpen(true)
  }

  // Render tree item recursively with proper tree line tracking
  const renderNode = (node: TreeNode, depth: number = 0, isLast: boolean = false, parentIsLast: boolean[] = []) => {
    const isExpanded = expandedFolders.has(node.id)
    const isSelected = selectedIds.has(node.id)
    const isDragOver = dragOverId === node.id
    const childCount = node.children?.length || 0

    return (
      <div key={node.id}>
        <ContextMenu>
          <ContextMenuTrigger>
            <DraggableItem
              node={node}
              depth={depth}
              isExpanded={isExpanded}
              isSelected={isSelected}
              isDragOver={isDragOver}
              isLast={isLast}
              parentIsLast={parentIsLast}
              selectedIds={selectedIds}
              onToggle={() => toggleFolder(node.id)}
              onSelect={(e) => handleSelect(node.id, e)}
              onMultiSelect={(checked) => handleMultiSelect(node.id, checked)}
              onDragStart={(e) => handleDragStart(e, node)}
              onDragOver={(e) => handleDragOver(e, node.id, node.type === "folder")}
              onDragLeave={handleDragLeave}
              onDrop={(e) => node.type === "folder" ? handleDrop(e, node.id) : undefined}
              onContextMenu={(e) => e.preventDefault()}
              onDoubleClick={() => {
                if (node.type === "folder") {
                  toggleFolder(node.id)
                } else if (node.file) {
                  setPreviewFile(node.file)
                }
              }}
            />
          </ContextMenuTrigger>
          <ContextMenuContent>
            {node.type === "folder" ? (
              <>
                <ContextMenuItem onClick={() => openCreateFolder(node.id)}>
                  <FolderPlus className="mr-2 h-4 w-4" />
                  New Subfolder
                </ContextMenuItem>
                <ContextMenuItem onClick={() => openRenameFolder(node.folder!)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Rename
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  className="text-destructive"
                  onClick={() => openDeleteFolder(node.folder!)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </ContextMenuItem>
              </>
            ) : (
              <>
                <ContextMenuItem onClick={() => setPreviewFile(node.file!)}>
                  <FileText className="mr-2 h-4 w-4" />
                  Preview
                </ContextMenuItem>
                <ContextMenuItem asChild>
                  <a href={node.file?.blobUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open in New Tab
                  </a>
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => {
                    setShareSettingsFileId(node.file!.id)
                    setShareSettingsFileName(node.file!.originalFilename)
                  }}
                >
                  <Settings2 className="mr-2 h-4 w-4" />
                  Share Settings
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => handleRegenerateLink(node.file!.id, node.file!.originalFilename)}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerate Link
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  className="text-destructive"
                  onClick={() => {
                    setSelectedIds(new Set([node.id]))
                    setDeleteFilesOpen(true)
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>
        {node.type === "folder" && isExpanded && node.children?.map((child, idx) =>
          renderNode(
            child,
            depth + 1,
            idx === childCount - 1,
            [...parentIsLast, isLast]
          )
        )}
      </div>
    )
  }

  const { files: selectedFiles, folders: selectedFolders } = getSelectedItems()
  const selectionCount = selectedIds.size

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-blue-400" />
          <span className="font-semibold text-sm">{projectName}</span>
          <span className="text-xs text-muted-foreground">
            {files.length} file{files.length !== 1 ? "s" : ""}, {folders.length} folder{folders.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selectionCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {selectionCount} selected
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={() => openCreateFolder(null)}>
            <FolderPlus className="h-4 w-4 mr-1" />
            New Folder
          </Button>
          {selectionCount > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {selectedFiles.length > 0 && (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setDeleteFilesOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setSelectedIds(new Set())}>
                  <X className="mr-2 h-4 w-4" />
                  Clear Selection
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Moving indicator */}
      {isMoving && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
          <div className="flex items-center gap-2">
            <Move className="h-5 w-5 animate-pulse" />
            <span>Moving items...</span>
          </div>
        </div>
      )}

      {/* Main content */}
      <div
        className="grid overflow-hidden"
        style={{
          gridTemplateColumns: previewFile ? "1fr 1fr" : "1fr",
          height: "calc(100vh - 300px)",
          minHeight: "400px",
        }}
      >
        {/* Tree view */}
        <ScrollArea className="h-full">
          {/* Root drop zone */}
          <div
            className={cn(
              "p-2 min-h-full",
              dragOverId === "root" && "bg-primary/10"
            )}
            onDragOver={(e) => handleDragOver(e, null, true)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, null)}
          >
            {tree.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Folder className="h-12 w-12 mb-4" />
                <p>No files yet</p>
                <p className="text-sm">Upload files or create folders to get started</p>
              </div>
            ) : (
              tree.map((node, idx) => renderNode(node, 0, idx === tree.length - 1, []))
            )}
          </div>
        </ScrollArea>

        {/* Preview panel */}
        {previewFile && (
          <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} />
        )}
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
            <DialogDescription>
              {createFolderParent
                ? `Create a subfolder in "${localFolders.find((f) => f.id === createFolderParent)?.name}"`
                : "Create a new folder at the root level"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                placeholder="Enter folder name"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={isLoading || !folderName.trim()}>
              {isLoading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog open={renameFolderOpen} onOpenChange={setRenameFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-folder">Folder Name</Label>
              <Input
                id="rename-folder"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRenameFolder()}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameFolder} disabled={isLoading || !folderName.trim()}>
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Folder Confirmation */}
      <AlertDialog open={deleteFolderOpen} onOpenChange={setDeleteFolderOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteFolder?.name}&quot;? This will also delete
              all subfolders and files within. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFolder}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Files Confirmation */}
      <AlertDialog open={deleteFilesOpen} onOpenChange={setDeleteFilesOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Files</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedFiles.length} file
              {selectedFiles.length !== 1 ? "s" : ""}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFiles}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* File Share Settings Modal */}
      {shareSettingsFileId && (
        <FileShareSettingsModal
          fileId={shareSettingsFileId}
          fileName={shareSettingsFileName}
          projectId={projectId}
          open={!!shareSettingsFileId}
          onOpenChange={(open) => {
            if (!open) {
              setShareSettingsFileId(null)
              setShareSettingsFileName("")
            }
          }}
          onSave={onDataChange}
        />
      )}
    </div>
  )
}
