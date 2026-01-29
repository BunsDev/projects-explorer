"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FolderOpen, Plus, MoreVertical, Pencil, Trash2, FileArchive, Tag, Globe, ExternalLink, HardDrive, ChevronDown, ChevronRight, Lock, Clock, Download, Shield } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  createProjectAction,
  updateProjectAction,
  deleteProjectAction,
  assignProjectCategoryAction,
  getCategoriesAction,
  type Category,
  type Project,
  type CreateProjectShareSettings,
} from "@/app/dashboard/actions"
import { CATEGORY_COLORS } from "@/lib/constants"
import { CategoryManager } from "@/components/category-manager"
import { cn } from "@/lib/utils"

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function getCategoryColorClasses(colorName: string | null) {
  const color = CATEGORY_COLORS.find((c) => c.name === colorName)
  return color || { bg: "bg-gray-100", text: "text-gray-900", border: "border-gray-200", name: "gray" }
}

interface ProjectListProps {
  initialProjects: Project[]
  initialCategories: Category[]
}

export function ProjectList({ initialProjects, initialCategories }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Hydration fix: defer Dialog rendering until after mount
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [url, setUrl] = useState("")

  // Share settings state (for create dialog)
  const [showShareSettings, setShowShareSettings] = useState(false)
  const [shareEnabled, setShareEnabled] = useState<boolean | null>(null)
  const [sharePasswordRequired, setSharePasswordRequired] = useState<boolean | null>(null)
  const [shareExpiryDays, setShareExpiryDays] = useState<string>("")
  const [shareDownloadLimitPerIp, setShareDownloadLimitPerIp] = useState<string>("")
  const [shareDownloadLimitWindowMinutes, setShareDownloadLimitWindowMinutes] = useState<string>("")

  // Get default category for new projects
  const defaultCategory = categories.find((c) => c.isDefault)

  const resetForm = () => {
    setName("")
    setDescription("")
    setCategoryId(defaultCategory?.id || null)
    setUrl("")
    setError(null)
    // Reset share settings
    setShowShareSettings(false)
    setShareEnabled(null)
    setSharePasswordRequired(null)
    setShareExpiryDays("")
    setShareDownloadLimitPerIp("")
    setShareDownloadLimitWindowMinutes("")
  }

  const refreshCategories = useCallback(async () => {
    const result = await getCategoriesAction()
    if (result.success && result.categories) {
      setCategories(result.categories)
    }
  }, [])

  // Filter projects by selected category
  const filteredProjects = selectedCategoryFilter
    ? selectedCategoryFilter === "uncategorized"
      ? projects.filter((p) => !p.categoryId)
      : projects.filter((p) => p.categoryId === selectedCategoryFilter)
    : projects

  const handleCreate = async () => {
    setIsLoading(true)
    setError(null)

    // Build share settings object only if any settings were configured
    const shareSettings: CreateProjectShareSettings | undefined = showShareSettings
      ? {
        shareEnabled,
        sharePasswordRequired,
        shareExpiryDays: shareExpiryDays ? parseInt(shareExpiryDays, 10) : null,
        shareDownloadLimitPerIp: shareDownloadLimitPerIp ? parseInt(shareDownloadLimitPerIp, 10) : null,
        shareDownloadLimitWindowMinutes: shareDownloadLimitWindowMinutes
          ? parseInt(shareDownloadLimitWindowMinutes, 10)
          : null,
      }
      : undefined

    const result = await createProjectAction(name, description, categoryId || undefined, url || undefined, shareSettings)

    if (result.success && result.projectId) {
      const assignedCategory = categoryId
        ? categories.find((c) => c.id === categoryId)
        : defaultCategory
      setProjects([
        {
          id: result.projectId,
          name,
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          description: description || null,
          deployedUrl: url || null,
          categoryId: assignedCategory?.id || null,
          categoryName: assignedCategory?.name || null,
          categoryColor: assignedCategory?.color || null,
          fileCount: 0,
          totalSize: 0,
          createdAt: new Date(),
        },
        ...projects,
      ])
      setIsCreateOpen(false)
      resetForm()
    } else {
      setError(result.error || "Failed to create project")
    }

    setIsLoading(false)
  }

  const handleEdit = async () => {
    if (!selectedProject) return

    setIsLoading(true)
    setError(null)

    const result = await updateProjectAction(selectedProject.id, name, description)

    if (result.success) {
      const newCategory = categoryId ? categories.find((c) => c.id === categoryId) : null
      // Also update category if changed
      if (categoryId !== selectedProject.categoryId) {
        await assignProjectCategoryAction(selectedProject.id, categoryId)
      }
      setProjects(
        projects.map((p) =>
          p.id === selectedProject.id
            ? {
              ...p,
              name,
              description: description || null,
              categoryId: categoryId,
              categoryName: newCategory?.name || null,
              categoryColor: newCategory?.color || null,
            }
            : p
        )
      )
      setIsEditOpen(false)
      setSelectedProject(null)
      resetForm()
    } else {
      setError(result.error || "Failed to update project")
    }

    setIsLoading(false)
  }

  const handleDelete = async () => {
    if (!selectedProject) return

    setIsLoading(true)

    const result = await deleteProjectAction(selectedProject.id)

    if (result.success) {
      setProjects(projects.filter((p) => p.id !== selectedProject.id))
    }

    setIsDeleteOpen(false)
    setSelectedProject(null)
    setIsLoading(false)
  }

  const openEditDialog = (project: Project) => {
    setSelectedProject(project)
    setName(project.name)
    setDescription(project.description || "")
    setCategoryId(project.categoryId)
    setUrl(project.deployedUrl || "")
    setIsEditOpen(true)
  }

  const openDeleteDialog = (project: Project) => {
    setSelectedProject(project)
    setIsDeleteOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-primary">Projects</h2>
          <p className="text-sm text-muted-foreground">
            Organize your files into projects and folders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CategoryManager categories={categories} onCategoriesChange={refreshCategories} />
          {mounted ? (
            <Dialog
              open={isCreateOpen}
              onOpenChange={(open) => {
                setIsCreateOpen(open)
                if (!open) resetForm()
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="gap-2 border-2 border-primary hover:bg-accent/50 hover:text-accent-foreground">
                  <Plus className="size-4" />
                  <span className="sr-only">New Project</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Project</DialogTitle>
                  <DialogDescription>
                    Add a new project to organize your files
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="Project name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe your project"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="url">Project URL (optional)</Label>
                    <Input
                      id="url"
                      type="url"
                      placeholder="https://example.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Link to deployed site or repository
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={categoryId || "none"}
                      onValueChange={(val) => setCategoryId(val === "none" ? null : val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No category</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "h-2 w-2 rounded-full",
                                  getCategoryColorClasses(cat.color).bg
                                )}
                              />
                              {cat.name}
                              {cat.isDefault && (
                                <span className="text-xs text-muted-foreground">(default)</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Share Settings Collapsible */}
                  <Collapsible open={showShareSettings} onOpenChange={setShowShareSettings}>
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full justify-between px-0 hover:bg-transparent"
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <Shield className="h-4 w-4" />
                          Share Settings (Optional)
                        </span>
                        {showShareSettings ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 pt-2">
                      <p className="text-xs text-muted-foreground">
                        Configure default share settings for this project. Leave empty to inherit from global settings.
                      </p>

                      {/* Enable Sharing */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium">Enable Sharing</Label>
                          <p className="text-xs text-muted-foreground">
                            {shareEnabled === null
                              ? "Inherits from global"
                              : shareEnabled
                                ? "Enabled"
                                : "Disabled"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant={shareEnabled === null ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setShareEnabled(null)}
                          >
                            Inherit
                          </Button>
                          <Switch
                            checked={shareEnabled ?? true}
                            onCheckedChange={setShareEnabled}
                            disabled={shareEnabled === null}
                          />
                        </div>
                      </div>

                      {/* Require Password */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <Lock className="h-3 w-3" />
                            Require Password
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {sharePasswordRequired === null
                              ? "Inherits from global"
                              : sharePasswordRequired
                                ? "Required"
                                : "Optional"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant={sharePasswordRequired === null ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setSharePasswordRequired(null)}
                          >
                            Inherit
                          </Button>
                          <Switch
                            checked={sharePasswordRequired ?? false}
                            onCheckedChange={setSharePasswordRequired}
                            disabled={sharePasswordRequired === null}
                          />
                        </div>
                      </div>

                      {/* Expiry Days */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          Default Expiry (days)
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          placeholder="Inherit from global"
                          value={shareExpiryDays}
                          onChange={(e) => setShareExpiryDays(e.target.value)}
                        />
                      </div>

                      {/* Download Limit */}
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <Download className="h-3 w-3" />
                            Download Limit per IP
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            placeholder="Inherit from global"
                            value={shareDownloadLimitPerIp}
                            onChange={(e) => setShareDownloadLimitPerIp(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Time Window (minutes)</Label>
                          <Input
                            type="number"
                            min="1"
                            placeholder="Inherit from global"
                            value={shareDownloadLimitWindowMinutes}
                            onChange={(e) => setShareDownloadLimitWindowMinutes(e.target.value)}
                          />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreateOpen(false)
                      resetForm()
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={isLoading || !name.trim()}>
                    {isLoading ? "Creating..." : "Create Project"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Button variant="outline" size="icon" className="gap-2 border-2 border-primary hover:bg-accent/50 hover:text-accent-foreground">
              <Plus className="size-4" />
              <span className="sr-only">New Project</span>
            </Button>
          )}
        </div>
      </div>

      {/* Category filter — glass pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Project categories">
          <button
            type="button"
            onClick={() => setSelectedCategoryFilter(null)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
              "glass-pill",
              selectedCategoryFilter === null
                ? "text-foreground ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All ({projects.length})
          </button>
          {categories.map((category) => {
            const count = projects.filter((p) => p.categoryId === category.id).length
            const isSelected = selectedCategoryFilter === category.id
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategoryFilter(category.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
                  "glass-pill",
                  isSelected
                    ? "text-foreground ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {category.name} ({count})
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setSelectedCategoryFilter("uncategorized")}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
              "glass-pill",
              selectedCategoryFilter === "uncategorized"
                ? "text-foreground ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Uncategorized ({projects.filter((p) => !p.categoryId).length})
          </button>
        </div>
      )}

      {filteredProjects.length === 0 && projects.length > 0 ? (
        <div className="glass rounded-2xl border-dashed border-2 border-border/50">
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="rounded-2xl stat-icon-bg p-4 mb-4">
              <Tag className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">No projects in this category</h3>
            <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
              Try selecting a different category or create a new project
            </p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => setSelectedCategoryFilter(null)}
            >
              View All Projects
            </Button>
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="glass rounded-2xl border-dashed border-2 border-border/50">
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="rounded-2xl stat-icon-bg p-4 mb-4">
              <FolderOpen className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">No projects yet</h3>
            <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
              Create your first project to start organizing files
            </p>
            <Button variant="glass" className="mt-6" onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="group relative">
              <Link href={`/dashboard/projects/${project.id}`} className="absolute inset-0 z-10" />
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl stat-icon-bg p-2.5">
                      <FolderOpen className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg font-semibold">{project.name}</CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="relative z-20 h-8 w-8 opacity-0 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(project)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => openDeleteDialog(project)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {project.description && (
                  <CardDescription className="line-clamp-2 mt-1">
                    {project.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap justify-end items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1 border border-primary/20 rounded-full px-2 py-0.5">
                    <FileArchive className="size-3 text-primary" strokeWidth={1.5} />
                    <span className="font-medium text-primary">{project.fileCount} {project.fileCount === 1 ? "file" : "files"}</span>
                  </div>
                  <div className="flex items-center gap-1 border border-primary/20 rounded-full px-2 py-0.5">
                    <HardDrive className="size-3 text-primary" strokeWidth={1.5} />
                    <span className="font-medium text-primary">{formatBytes(project.totalSize)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) { setSelectedProject(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update project details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                placeholder="Project name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Textarea
                id="edit-description"
                placeholder="Describe your project"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-url">Project URL (optional)</Label>
              <Input
                id="edit-url"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Link to deployed site or repository
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category">Category</Label>
              <Select
                value={categoryId || "none"}
                onValueChange={(val) => setCategoryId(val === "none" ? null : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            getCategoryColorClasses(cat.color).bg
                          )}
                        />
                        {cat.name}
                        {cat.isDefault && (
                          <span className="text-xs text-muted-foreground">(default)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditOpen(false)
                setSelectedProject(null)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={isLoading || !name.trim()}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedProject?.name}&quot;? This will permanently
              delete all folders and files within this project. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedProject(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isLoading ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
