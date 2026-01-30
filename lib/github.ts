/**
 * GitHub API utilities for repository integration
 */

const GITHUB_API_BASE = "https://api.github.com"

/**
 * Get GitHub token from environment
 */
function getGitHubToken(): string | undefined {
  return process.env.GITHUB_TOKEN
}

/**
 * Create headers for GitHub API requests
 */
function getGitHubHeaders(): HeadersInit {
  const token = getGitHubToken()
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Projects-Explorer",
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

/**
 * Parse a GitHub URL and extract owner and repo
 * Supports formats:
 * - https://github.com/owner/repo
 * - github.com/owner/repo
 * - owner/repo
 */
export function parseGitHubUrl(
  url: string
): { owner: string; repo: string } | null {
  if (!url || typeof url !== "string") return null

  // Clean the URL
  let cleaned = url.trim()

  // Remove trailing .git
  if (cleaned.endsWith(".git")) {
    cleaned = cleaned.slice(0, -4)
  }

  // Remove trailing slash
  if (cleaned.endsWith("/")) {
    cleaned = cleaned.slice(0, -1)
  }

  // Try to parse as full URL
  try {
    const parsed = new URL(
      cleaned.startsWith("http") ? cleaned : `https://${cleaned}`
    )
    if (
      parsed.hostname === "github.com" ||
      parsed.hostname === "www.github.com"
    ) {
      const parts = parsed.pathname.split("/").filter(Boolean)
      if (parts.length >= 2) {
        return { owner: parts[0], repo: parts[1] }
      }
    }
  } catch {
    // Not a URL, try parsing as owner/repo
  }

  // Try parsing as owner/repo format
  const parts = cleaned.split("/").filter(Boolean)
  if (parts.length === 2 && parts[0] && parts[1]) {
    // Basic validation: no special characters that would be invalid
    const validPattern = /^[a-zA-Z0-9._-]+$/
    if (validPattern.test(parts[0]) && validPattern.test(parts[1])) {
      return { owner: parts[0], repo: parts[1] }
    }
  }

  return null
}

/**
 * GitHub repository metadata
 */
export type GitHubRepoInfo = {
  id: number
  name: string
  fullName: string
  description: string | null
  defaultBranch: string
  private: boolean
  htmlUrl: string
  size: number
  language: string | null
  stargazersCount: number
  forksCount: number
}

/**
 * Fetch repository metadata from GitHub API
 */
export async function fetchRepoInfo(
  owner: string,
  repo: string
): Promise<{ success: true; data: GitHubRepoInfo } | { success: false; error: string }> {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { headers: getGitHubHeaders() }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: "Repository not found" }
      }
      if (response.status === 401) {
        return { success: false, error: "Invalid GitHub token" }
      }
      if (response.status === 403) {
        const remaining = response.headers.get("X-RateLimit-Remaining")
        if (remaining === "0") {
          return { success: false, error: "GitHub API rate limit exceeded" }
        }
        return { success: false, error: "Access denied to repository" }
      }
      return { success: false, error: `GitHub API error: ${response.status}` }
    }

    const data = await response.json()

    return {
      success: true,
      data: {
        id: data.id,
        name: data.name,
        fullName: data.full_name,
        description: data.description,
        defaultBranch: data.default_branch,
        private: data.private,
        htmlUrl: data.html_url,
        size: data.size,
        language: data.language,
        stargazersCount: data.stargazers_count,
        forksCount: data.forks_count,
      },
    }
  } catch (error) {
    console.error("GitHub API error:", error)
    return { success: false, error: "Failed to connect to GitHub API" }
  }
}

/**
 * GitHub tree item
 */
export type GitHubTreeItem = {
  path: string
  mode: string
  type: "blob" | "tree"
  sha: string
  size?: number
  url: string
}

/**
 * Fetch repository tree (file structure) from GitHub API
 */
export async function fetchRepoTree(
  owner: string,
  repo: string,
  branch?: string
): Promise<
  | { success: true; tree: GitHubTreeItem[]; sha: string; truncated: boolean }
  | { success: false; error: string }
> {
  try {
    // First, get the default branch if not provided
    let treeSha = branch || "HEAD"

    // Get the commit SHA for the branch
    const refResponse = await fetch(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(treeSha === "HEAD" ? "main" : treeSha)}`,
      { headers: getGitHubHeaders() }
    )

    if (refResponse.ok) {
      const refData = await refResponse.json()
      treeSha = refData.object.sha
    } else if (treeSha === "HEAD") {
      // Try master branch as fallback
      const masterResponse = await fetch(
        `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/master`,
        { headers: getGitHubHeaders() }
      )
      if (masterResponse.ok) {
        const masterData = await masterResponse.json()
        treeSha = masterData.object.sha
      }
    }

    // Fetch the tree recursively
    const treeResponse = await fetch(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${treeSha}?recursive=1`,
      { headers: getGitHubHeaders() }
    )

    if (!treeResponse.ok) {
      if (treeResponse.status === 404) {
        return { success: false, error: "Repository or branch not found" }
      }
      return {
        success: false,
        error: `GitHub API error: ${treeResponse.status}`,
      }
    }

    const treeData = await treeResponse.json()

    return {
      success: true,
      tree: treeData.tree as GitHubTreeItem[],
      sha: treeData.sha,
      truncated: treeData.truncated || false,
    }
  } catch (error) {
    console.error("GitHub tree fetch error:", error)
    return { success: false, error: "Failed to fetch repository tree" }
  }
}

/**
 * Fetch file content from GitHub API
 * Returns base64 decoded content for text files
 */
export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<
  | { success: true; content: string; sha: string; size: number; encoding: string }
  | { success: false; error: string }
> {
  try {
    const url = new URL(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`
    )
    if (ref) {
      url.searchParams.set("ref", ref)
    }

    const response = await fetch(url.toString(), {
      headers: getGitHubHeaders(),
    })

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: "File not found" }
      }
      return { success: false, error: `GitHub API error: ${response.status}` }
    }

    const data = await response.json()

    // Handle directory response
    if (Array.isArray(data)) {
      return { success: false, error: "Path is a directory, not a file" }
    }

    // Check if content is too large (GitHub returns download_url for large files)
    if (data.content === undefined && data.download_url) {
      // Fetch from raw URL for large files
      const rawResponse = await fetch(data.download_url)
      if (!rawResponse.ok) {
        return { success: false, error: "Failed to download large file" }
      }
      const content = await rawResponse.text()
      return {
        success: true,
        content,
        sha: data.sha,
        size: data.size,
        encoding: "utf-8",
      }
    }

    // Decode base64 content
    let content: string
    if (data.encoding === "base64") {
      content = Buffer.from(data.content, "base64").toString("utf-8")
    } else {
      content = data.content
    }

    return {
      success: true,
      content,
      sha: data.sha,
      size: data.size,
      encoding: data.encoding,
    }
  } catch (error) {
    console.error("GitHub file fetch error:", error)
    return { success: false, error: "Failed to fetch file content" }
  }
}

/**
 * Get the URL for downloading a repository as a zip archive
 */
export function getRepoZipUrl(
  owner: string,
  repo: string,
  ref?: string
): string {
  const branch = ref || "HEAD"
  return `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zipball/${encodeURIComponent(branch)}`
}

/**
 * Download repository as a zip archive
 * Returns the zip file as an ArrayBuffer
 */
export async function downloadRepoZip(
  owner: string,
  repo: string,
  ref?: string
): Promise<
  | { success: true; data: ArrayBuffer; filename: string; size: number }
  | { success: false; error: string }
> {
  try {
    const url = getRepoZipUrl(owner, repo, ref)

    const response = await fetch(url, {
      headers: getGitHubHeaders(),
      redirect: "follow",
    })

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: "Repository or branch not found" }
      }
      if (response.status === 403) {
        return { success: false, error: "Access denied or rate limit exceeded" }
      }
      return { success: false, error: `GitHub API error: ${response.status}` }
    }

    const data = await response.arrayBuffer()

    // Extract filename from Content-Disposition header or generate one
    const contentDisposition = response.headers.get("Content-Disposition")
    let filename = `${owner}-${repo}-${ref || "main"}.zip`
    if (contentDisposition) {
      const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, "")
      }
    }

    return {
      success: true,
      data,
      filename,
      size: data.byteLength,
    }
  } catch (error) {
    console.error("GitHub zip download error:", error)
    return { success: false, error: "Failed to download repository archive" }
  }
}

/**
 * Check if GitHub integration is available (token is set)
 */
export function isGitHubIntegrationAvailable(): boolean {
  return !!getGitHubToken()
}

/**
 * Get GitHub API rate limit status
 */
export async function getGitHubRateLimit(): Promise<
  | {
      success: true
      limit: number
      remaining: number
      reset: Date
      used: number
    }
  | { success: false; error: string }
> {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/rate_limit`, {
      headers: getGitHubHeaders(),
    })

    if (!response.ok) {
      return { success: false, error: `GitHub API error: ${response.status}` }
    }

    const data = await response.json()
    const core = data.resources.core

    return {
      success: true,
      limit: core.limit,
      remaining: core.remaining,
      reset: new Date(core.reset * 1000),
      used: core.used,
    }
  } catch (error) {
    console.error("GitHub rate limit check error:", error)
    return { success: false, error: "Failed to check rate limit" }
  }
}
