"use client"

import React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Folder, FolderPlus, MoreVertical, Pencil, Trash2, ChevronRight } from "lucide-react"
import { createFolderAction, renameFolderAction, deleteFolderAction } from "@/app/dashboard/actions"
import { cn } from "@/lib/utils"

type FolderType = {
  id: string
  name: string
  parentId: string | null
  fileCount: number
  createdAt: Date
}

interface FolderTreeProps {
  projectId: string
  folders: FolderType[]
  currentFolderId?: string
  onFolderSelect: (folderId: string | null) => void
  onFoldersChange: (folders: FolderType[]) => void
}

export function FolderTree({
  projectId,
  folders,
  currentFolderId,
  onFolderSelect,
  onFoldersChange,
}: FolderTreeProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<FolderType | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [folderName, setFolderName] = useState("")
  const [createInFolder, setCreateInFolder] = useState<string | null>(null)

  const resetForm = () => {
    setFolderName("")
    setError(null)
    setCreateInFolder(null)
  }

  const handleCreate = async () => {
    setIsLoading(true)
    setError(null)

    const result = await createFolderAction(projectId, folderName, createInFolder || undefined)

    if (result.success && result.folderId) {
      onFoldersChange([
        ...folders,
        {
          id: result.folderId,
          name: folderName,
          parentId: createInFolder,
          fileCount: 0,
          createdAt: new Date(),
        },
      ])
      setIsCreateOpen(false)
      resetForm()
    } else {
      setError(result.error || "Failed to create folder")
    }

    setIsLoading(false)
  }

  const handleRename = async () => {
    if (!selectedFolder) return

    setIsLoading(true)
    setError(null)

    const result = await renameFolderAction(selectedFolder.id, folderName)

    if (result.success) {
      onFoldersChange(
        folders.map((f) => (f.id === selectedFolder.id ? { ...f, name: folderName } : f))
      )
      setIsRenameOpen(false)
      setSelectedFolder(null)
      resetForm()
    } else {
      setError(result.error || "Failed to rename folder")
    }

    setIsLoading(false)
  }

  const handleDelete = async () => {
    if (!selectedFolder) return

    setIsLoading(true)

    const result = await deleteFolderAction(selectedFolder.id)

    if (result.success) {
      // Remove folder and all subfolders
      const idsToRemove = new Set<string>()
      const collectIds = (id: string) => {
        idsToRemove.add(id)
        folders.filter((f) => f.parentId === id).forEach((f) => collectIds(f.id))
      }
      collectIds(selectedFolder.id)

      onFoldersChange(folders.filter((f) => !idsToRemove.has(f.id)))
      
      if (currentFolderId && idsToRemove.has(currentFolderId)) {
        onFolderSelect(null)
      }
    }

    setIsDeleteOpen(false)
    setSelectedFolder(null)
    setIsLoading(false)
  }

  const openRenameDialog = (folder: FolderType, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedFolder(folder)
    setFolderName(folder.name)
    setIsRenameOpen(true)
  }

  const openDeleteDialog = (folder: FolderType, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedFolder(folder)
    setIsDeleteOpen(true)
  }

  const openCreateInFolder = (folderId: string | null, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setCreateInFolder(folderId)
    setIsCreateOpen(true)
  }

  // Build folder hierarchy for root level only (folders with null parentId)
  const rootFolders = folders.filter((f) => f.parentId === null)
  const getSubfolders = (parentId: string) => folders.filter((f) => f.parentId === parentId)

  const FolderItem = ({ folder, depth = 0 }: { folder: FolderType; depth?: number }) => {
    const subfolders = getSubfolders(folder.id)
    const isSelected = currentFolderId === folder.id

    return (
      <div>
        <div
          className={cn(
            "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/50",
            isSelected && "bg-muted"
          )}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => onFolderSelect(folder.id)}
        >
          {subfolders.length > 0 ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <span className="w-4" />
          )}
          <Folder className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
          <span className="flex-1 truncate">{folder.name}</span>
          <span className="text-xs text-muted-foreground">{folder.fileCount}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => openCreateInFolder(folder.id, e as unknown as React.MouseEvent)}>
                <FolderPlus className="mr-2 h-4 w-4" />
                New Subfolder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => openRenameDialog(folder, e as unknown as React.MouseEvent)}>
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => openDeleteDialog(folder, e as unknown as React.MouseEvent)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {subfolders.map((sub) => (
          <FolderItem key={sub.id} folder={sub} depth={depth + 1} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-2">
        <span className="text-xs font-medium uppercase text-muted-foreground">Folders</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openCreateInFolder(null)}>
          <FolderPlus className="h-4 w-4" />
        </Button>
      </div>

      <div
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/50",
          !currentFolderId && "bg-muted"
        )}
        onClick={() => onFolderSelect(null)}
      >
        <span className="w-4" />
        <Folder className={cn("h-4 w-4", !currentFolderId ? "text-primary" : "text-muted-foreground")} />
        <span className="flex-1">All Files</span>
      </div>

      {rootFolders.map((folder) => (
        <FolderItem key={folder.id} folder={folder} />
      ))}

      {/* Create Folder Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
            <DialogDescription>
              {createInFolder
                ? `Create a new subfolder in "${folders.find((f) => f.id === createInFolder)?.name}"`
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
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isLoading || !folderName.trim()}>
              {isLoading ? "Creating..." : "Create Folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={(open) => { setIsRenameOpen(open); if (!open) { setSelectedFolder(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogDescription>Enter a new name for the folder</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-folder">Folder Name</Label>
              <Input
                id="rename-folder"
                placeholder="Enter folder name"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsRenameOpen(false); setSelectedFolder(null); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={isLoading || !folderName.trim()}>
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedFolder?.name}&quot;? This will also delete all
              subfolders and files within. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedFolder(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
