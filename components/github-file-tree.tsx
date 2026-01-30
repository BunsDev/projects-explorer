"use client"

import { useState, useCallback, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileJson,
  FileText,
  FileImage,
  X,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react"
import { getFileContentAction } from "@/app/dashboard/actions"
import { CodeBlock } from "@/components/code-block"

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

interface GitHubFileTreeProps {
  projectName: string
  folders: TreeFolder[]
  files: TreeFile[]
}

// Build nested tree structure
type TreeNode = {
  type: "folder" | "file"
  id: string
  name: string
  children?: TreeNode[]
  file?: TreeFile
}

function buildTree(folders: TreeFolder[], files: TreeFile[]): TreeNode[] {
  const folderMap = new Map<string | null, TreeNode[]>()

  // Initialize root level
  folderMap.set(null, [])

  // Create folder nodes
  const folderNodes = new Map<string, TreeNode>()
  for (const folder of folders) {
    const node: TreeNode = {
      type: "folder",
      id: folder.id,
      name: folder.name,
      children: [],
    }
    folderNodes.set(folder.id, node)
  }

  // Build folder hierarchy
  for (const folder of folders) {
    const node = folderNodes.get(folder.id)!
    const parentChildren = folderMap.get(folder.parentId) || []
    parentChildren.push(node)
    folderMap.set(folder.parentId, parentChildren)

    if (folder.parentId) {
      const parent = folderNodes.get(folder.parentId)
      if (parent && parent.children) {
        parent.children.push(node)
      }
    }
  }

  // Add files to their folders
  for (const file of files) {
    const fileNode: TreeNode = {
      type: "file",
      id: file.id,
      name: file.originalFilename,
      file,
    }

    if (file.folderId) {
      const folder = folderNodes.get(file.folderId)
      if (folder && folder.children) {
        folder.children.push(fileNode)
      }
    } else {
      const rootChildren = folderMap.get(null) || []
      rootChildren.push(fileNode)
      folderMap.set(null, rootChildren)
    }
  }

  // Get root level items (folders without parents + root files)
  const rootItems: TreeNode[] = []
  for (const folder of folders) {
    if (!folder.parentId) {
      const node = folderNodes.get(folder.id)
      if (node) rootItems.push(node)
    }
  }
  for (const file of files) {
    if (!file.folderId) {
      rootItems.push({
        type: "file",
        id: file.id,
        name: file.originalFilename,
        file,
      })
    }
  }

  // Sort: folders first, then files, alphabetically
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

function getFileIcon(filename: string, mimeType: string) {
  const ext = filename.split(".").pop()?.toLowerCase()

  // Code files
  if (["js", "jsx", "ts", "tsx", "mjs", "cjs", "vue", "svelte", "html", "htm", "css", "scss", "sass", "less"].includes(ext || "")) {
    return <FileCode className="h-4 w-4 text-violet-500" />
  }
  // Data/config files
  if (["json", "xml", "yaml", "yml", "toml", "lock", "env"].includes(ext || "")) {
    return <FileJson className="h-4 w-4 text-orange-500" />
  }
  // Images
  if (mimeType.startsWith("image/")) {
    return <FileImage className="h-4 w-4 text-emerald-500" />
  }
  // Documents
  if (["md", "mdx", "txt", "pdf", "doc", "docx"].includes(ext || "")) {
    return <FileText className="h-4 w-4 text-blue-500" />
  }

  return <File className="h-4 w-4 text-muted-foreground" />
}

function TreeItem({
  node,
  depth,
  expandedFolders,
  selectedFile,
  onToggleFolder,
  onSelectFile,
}: {
  node: TreeNode
  depth: number
  expandedFolders: Set<string>
  selectedFile: TreeFile | null
  onToggleFolder: (id: string) => void
  onSelectFile: (file: TreeFile) => void
}) {
  const isExpanded = expandedFolders.has(node.id)
  const isSelected = selectedFile?.id === node.id

  if (node.type === "folder") {
    return (
      <div>
        <button
          onClick={() => onToggleFolder(node.id)}
          className={cn(
            "flex w-full items-center gap-1 rounded px-2 py-1 text-left text-sm hover:bg-muted/50",
            "focus:outline-none focus:ring-1 focus:ring-ring"
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          {isExpanded ? (
            <FolderOpen className="h-4 w-4 text-blue-400" />
          ) : (
            <Folder className="h-4 w-4 text-blue-400" />
          )}
          <span className="truncate font-medium">{node.name}</span>
        </button>
        {isExpanded && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeItem
                key={child.id}
                node={child}
                depth={depth + 1}
                expandedFolders={expandedFolders}
                selectedFile={selectedFile}
                onToggleFolder={onToggleFolder}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={() => node.file && onSelectFile(node.file)}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted/50",
        "focus:outline-none focus:ring-1 focus:ring-ring",
        isSelected && "bg-muted"
      )}
      style={{ paddingLeft: `${depth * 12 + 28}px` }}
    >
      {getFileIcon(node.name, node.file?.mimeType || "")}
      <span className="truncate">{node.name}</span>
    </button>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function FilePreview({ file, onClose }: { file: TreeFile; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const loadContent = async () => {
      setIsLoading(true)
      setError(null)
      setContent(null)

      const result = await getFileContentAction(file.id)
      if (result.success) {
        if (result.content !== undefined) {
          setContent(result.content)
        }
      } else {
        setError(result.error || "Failed to load file")
      }
      setIsLoading(false)
    }

    loadContent()
  }, [file.id])

  const copyLink = async () => {
    const url = `${window.location.origin}/share/${file.publicId}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isImage = file.mimeType.startsWith("image/")
  const isPdf = file.mimeType === "application/pdf"

  return (
    <div className="flex h-full flex-col border-l">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          {getFileIcon(file.originalFilename, file.mimeType)}
          <span className="truncate font-medium text-sm">{file.originalFilename}</span>
          <span className="text-xs text-muted-foreground">({formatBytes(file.fileSize)})</span>
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-destructive">
            {error}
          </div>
        ) : isImage ? (
          <div className="flex h-full items-center justify-center bg-[#0d1117] p-4">
            <img
              src={file.blobUrl || "/placeholder.svg"}
              alt={file.originalFilename}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : isPdf ? (
          <iframe
            src={file.blobUrl}
            className="h-full w-full"
            title={file.originalFilename}
          />
        ) : content !== null ? (
          <CodeBlock code={content} filename={file.originalFilename} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
            <FileText className="h-16 w-16" />
            <p>Preview not available for this file type</p>
            <Button variant="outline" asChild>
              <a href={file.blobUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in new tab
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export function GitHubFileTree({ projectName, folders, files }: GitHubFileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [selectedFile, setSelectedFile] = useState<TreeFile | null>(null)

  const tree = buildTree(folders, files)

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

  const expandAll = useCallback(() => {
    setExpandedFolders(new Set(folders.map((f) => f.id)))
  }, [folders])

  const collapseAll = useCallback(() => {
    setExpandedFolders(new Set())
  }, [])

  // If no files or folders, show empty state
  if (folders.length === 0 && files.length === 0) {
    return (
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-blue-400" />
            <span className="font-semibold">{projectName}</span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Folder className="h-12 w-12 mb-4" />
          <p>No files in this project yet</p>
          <p className="text-sm">Upload files to see them here</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* GitHub-style header */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-blue-400" />
          <span className="font-semibold text-sm">{projectName}</span>
          <span className="text-xs text-muted-foreground">
            {files.length} file{files.length !== 1 ? "s" : ""}
            {folders.length > 0 && `, ${folders.length} folder${folders.length !== 1 ? "s" : ""}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={expandAll}>
            Expand all
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll}>
            Collapse all
          </Button>
        </div>
      </div>

      {/* Split view: tree + preview */}
      <div className="grid h-screen overflow-y-auto" style={{ gridTemplateColumns: selectedFile ? "300px 1fr" : "1fr" }}>
        {/* File tree */}
        <ScrollArea className="h-full border-r">
          <div className="py-2">
            {tree.map((node) => (
              <TreeItem
                key={node.id}
                node={node}
                depth={0}
                expandedFolders={expandedFolders}
                selectedFile={selectedFile}
                onToggleFolder={toggleFolder}
                onSelectFile={setSelectedFile}
              />
            ))}
          </div>
        </ScrollArea>

        {/* Preview panel */}
        {selectedFile && (
          <FilePreview file={selectedFile} onClose={() => setSelectedFile(null)} />
        )}
      </div>
    </div>
  )
}
