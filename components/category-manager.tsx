"use client"

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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Settings, Plus, MoreHorizontal, Pencil, Trash2, Star, Check, ListOrdered } from "lucide-react"
import {
  type Category,
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  setDefaultCategoryAction,
} from "@/app/dashboard/actions"
import { CATEGORY_COLORS } from "@/lib/constants"
import { cn } from "@/lib/utils"

interface CategoryManagerProps {
  categories: Category[]
  onCategoriesChange: () => void
}

export function CategoryManager({ categories, onCategoriesChange }: CategoryManagerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [name, setName] = useState("")
  const [color, setColor] = useState("blue")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const resetForm = () => {
    setName("")
    setColor("blue")
    setError("")
    setEditingCategory(null)
  }

  const handleCreate = async () => {
    setIsLoading(true)
    setError("")
    const result = await createCategoryAction(name, color)
    setIsLoading(false)

    if (result.success) {
      resetForm()
      setIsCreateOpen(false)
      onCategoriesChange()
    } else {
      setError(result.error || "Failed to create category")
    }
  }

  const handleUpdate = async () => {
    if (!editingCategory) return
    setIsLoading(true)
    setError("")
    const result = await updateCategoryAction(editingCategory.id, name, color)
    setIsLoading(false)

    if (result.success) {
      resetForm()
      onCategoriesChange()
    } else {
      setError(result.error || "Failed to update category")
    }
  }

  const handleDelete = async (categoryId: string) => {
    if (!confirm("Are you sure you want to delete this category? Projects in this category will become uncategorized.")) {
      return
    }
    const result = await deleteCategoryAction(categoryId)
    if (result.success) {
      onCategoriesChange()
    }
  }

  const handleSetDefault = async (categoryId: string, isCurrentlyDefault: boolean) => {
    const result = await setDefaultCategoryAction(isCurrentlyDefault ? null : categoryId)
    if (result.success) {
      onCategoriesChange()
    }
  }

  const startEdit = (category: Category) => {
    setEditingCategory(category)
    setName(category.name)
    setColor(category.color)
    setError("")
  }

  const cancelEdit = () => {
    resetForm()
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-2 border-primary hover:bg-accent/50 hover:text-accent-foreground">
          <ListOrdered className="size-4" />
          <span className="sr-only">Categories</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Manage Categories</DialogTitle>
          <DialogDescription>
            Create and organize categories for your projects. Set a default category for new projects.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Category List */}
          <div className="space-y-2">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No categories yet. Create your first category below.
              </p>
            ) : (
              categories.map((category) => (
                <div
                  key={category.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    editingCategory?.id === category.id && "ring-2 ring-primary"
                  )}
                >
                  {editingCategory?.id === category.id ? (
                    <div className="flex-1 space-y-3">
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Category name"
                        className="h-8"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {CATEGORY_COLORS.map((c) => (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() => setColor(c.name)}
                            title={c.name}
                            className={cn(
                              "w-7 h-7 rounded-full border-2 transition-all shrink-0",
                              c.bg,
                              color === c.name
                                ? "border-foreground ring-2 ring-foreground ring-offset-2 ring-offset-background"
                                : "border-gray-300 dark:border-gray-600"
                            )}
                            aria-pressed={color === c.name}
                            aria-label={`Color ${c.name}`}
                          />
                        ))}
                      </div>
                      {error && <p className="text-sm text-destructive">{error}</p>}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleUpdate} disabled={isLoading}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-3 h-3 rounded-full",
                            CATEGORY_COLORS.find((c) => c.name === category.color)?.bg || "bg-gray-200"
                          )}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{category.name}</span>
                            {category.isDefault && (
                              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                Default
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {category.projectCount} project{category.projectCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => startEdit(category)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleSetDefault(category.id, category.isDefault)}
                          >
                            {category.isDefault ? (
                              <>
                                <Check className="h-4 w-4 mr-2" />
                                Remove Default
                              </>
                            ) : (
                              <>
                                <Star className="h-4 w-4 mr-2" />
                                Set as Default
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(category.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Create New Category */}
          {!editingCategory && (
            <>
              {isCreateOpen ? (
                <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                  <Label htmlFor="new-category-name">New Category</Label>
                  <Input
                    id="new-category-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter category name"
                  />
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORY_COLORS.map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => setColor(c.name)}
                          title={c.name}
                          className={cn(
                            "w-7 h-7 rounded-full border-2 transition-all shrink-0",
                            c.bg,
                            color === c.name
                              ? "border-foreground ring-2 ring-foreground ring-offset-2 ring-offset-background scale-105"
                              : "border-gray-300 dark:border-gray-600"
                          )}
                          aria-pressed={color === c.name}
                          aria-label={`Color ${c.name}`}
                        />
                      ))}
                    </div>
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <div className="flex gap-2">
                    <Button onClick={handleCreate} disabled={isLoading || !name.trim()}>
                      Create Category
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsCreateOpen(false)
                        resetForm()
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full bg-transparent"
                  onClick={() => setIsCreateOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
