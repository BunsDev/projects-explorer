"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Github, Loader2, AlertCircle } from "lucide-react"
import {
  connectGitHubRepoAction,
  getCategoriesAction,
  checkGitHubIntegrationAction,
} from "@/app/dashboard/actions"

type Category = {
  id: string
  name: string
  color: string
}

interface GitHubRepoConnectProps {
  children?: React.ReactNode
  onSuccess?: (projectId: string, slug: string) => void
}

export function GitHubRepoConnect({ children, onSuccess }: GitHubRepoConnectProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [repoUrl, setRepoUrl] = useState("")
  const [categoryId, setCategoryId] = useState<string>("")
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isIntegrationAvailable, setIsIntegrationAvailable] = useState<boolean | null>(null)

  // Check if GitHub integration is available
  useEffect(() => {
    async function checkIntegration() {
      const result = await checkGitHubIntegrationAction()
      setIsIntegrationAvailable(result.available)
    }
    checkIntegration()
  }, [])

  // Load categories when dialog opens
  useEffect(() => {
    if (open) {
      loadCategories()
    }
  }, [open])

  async function loadCategories() {
    const result = await getCategoriesAction()
    if (result.success && result.categories) {
      setCategories(result.categories)
      // Select default category if available
      const defaultCat = result.categories.find((c) => c.isDefault)
      if (defaultCat) {
        setCategoryId(defaultCat.id)
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const result = await connectGitHubRepoAction(
        repoUrl,
        categoryId && categoryId !== "none" ? categoryId : undefined
      )

      if (result.success && result.projectId && result.slug) {
        setOpen(false)
        setRepoUrl("")
        if (onSuccess) {
          onSuccess(result.projectId, result.slug)
        } else {
          router.push(`/dashboard/projects/${result.projectId}`)
        }
      } else {
        setError(result.error || "Failed to connect repository")
      }
    } catch (err) {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  // Validate URL format in real-time
  const isValidUrl = repoUrl.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" className="gap-2">
            <Github className="h-4 w-4" />
            Connect GitHub Repo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            Connect GitHub Repository
          </DialogTitle>
          <DialogDescription>
            Enter a GitHub repository URL to browse and optionally save snapshots of its files.
          </DialogDescription>
        </DialogHeader>

        {isIntegrationAvailable === false ? (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">
                GitHub integration not configured
              </p>
              <p className="text-sm text-muted-foreground">
                Please set the <code className="rounded bg-muted px-1 py-0.5 text-xs">GITHUB_TOKEN</code> environment variable to enable GitHub integration.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="repo-url">Repository URL</Label>
              <Input
                id="repo-url"
                type="text"
                placeholder="github.com/owner/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Supports: github.com/owner/repo, https://github.com/owner/repo, or owner/repo
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category (optional)</Label>
              <Select
                value={categoryId}
                onValueChange={setCategoryId}
                disabled={isLoading}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor: `var(--${cat.color}-500, ${cat.color})`,
                          }}
                        />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!isValidUrl || isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Github className="mr-2 h-4 w-4" />
                    Connect
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
