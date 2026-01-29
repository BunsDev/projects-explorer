"use server"

import { clearSession, getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db, sql, categories, projects, folders, files, downloadLogs, auditLogs, shareSettings } from "@/lib/db"
import { hashSharePassword } from "@/lib/share-password"
import { getClientIP, getUserAgent } from "@/lib/auth"
import { put, del } from "@vercel/blob"
import { nanoid } from "nanoid"
import { revalidatePath } from "next/cache"
import { eq, and, isNull, desc, count, sum, sql as drizzleSql } from "drizzle-orm"

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

// ============ SECURITY: Authentication Guard ============

/**
 * Verify the user is authenticated before performing mutating actions.
 * Returns an error response if not authenticated.
 */
async function requireAuthAction(): Promise<{ authorized: true } | { authorized: false; error: string }> {
  const session = await getSession()
  if (!session.valid) {
    return { authorized: false, error: "Unauthorized" }
  }
  return { authorized: true }
}

// ============ SECURITY: Audit Logging ============

/**
 * Log a destructive or sensitive action for audit purposes.
 * Non-blocking - errors are logged but don't fail the operation.
 */
async function logAuditAction(
  action: string,
  resourceType: string,
  resourceId: string | null,
  resourceName: string | null,
  details?: string
): Promise<void> {
  try {
    const ip = await getClientIP()
    const userAgent = await getUserAgent()

    await db.insert(auditLogs).values({
      action,
      resourceType,
      resourceId,
      resourceName,
      details,
      ipAddress: ip,
      userAgent,
    })
  } catch (error) {
    // Don't fail the operation if audit logging fails
    console.error("Failed to log audit action:", error)
  }
}

// File type definitions with magic bytes for binary validation
// Text-based files don't need magic bytes - we trust the extension
const FILE_TYPES: Record<string, { mimeType: string; magicBytes?: number[][] }> = {
  // Archives (with magic bytes validation)
  zip: { mimeType: "application/zip", magicBytes: [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06], [0x50, 0x4b, 0x07, 0x08]] },
  tar: { mimeType: "application/x-tar" },
  gz: { mimeType: "application/gzip", magicBytes: [[0x1f, 0x8b]] },
  "7z": { mimeType: "application/x-7z-compressed", magicBytes: [[0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]] },

  // Documents
  pdf: { mimeType: "application/pdf", magicBytes: [[0x25, 0x50, 0x44, 0x46]] },
  doc: { mimeType: "application/msword" },
  docx: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  txt: { mimeType: "text/plain" },
  md: { mimeType: "text/markdown" },
  mdx: { mimeType: "text/mdx" },
  license: { mimeType: "text/plain" },

  // Images (with magic bytes validation for binary formats)
  png: { mimeType: "image/png", magicBytes: [[0x89, 0x50, 0x4e, 0x47]] },
  jpg: { mimeType: "image/jpeg", magicBytes: [[0xff, 0xd8, 0xff]] },
  jpeg: { mimeType: "image/jpeg", magicBytes: [[0xff, 0xd8, 0xff]] },
  gif: { mimeType: "image/gif", magicBytes: [[0x47, 0x49, 0x46, 0x38]] },
  svg: { mimeType: "image/svg+xml" },
  heif: { mimeType: "image/heif" },
  heic: { mimeType: "image/heic" },
  webp: { mimeType: "image/webp", magicBytes: [[0x52, 0x49, 0x46, 0x46]] },
  ico: { mimeType: "image/x-icon" },

  // Data files
  json: { mimeType: "application/json" },
  xml: { mimeType: "text/xml" },
  csv: { mimeType: "text/csv" },
  yaml: { mimeType: "text/yaml" },
  yml: { mimeType: "text/yaml" },
  toml: { mimeType: "text/toml" },
  sql: { mimeType: "application/sql" },

  // JavaScript/TypeScript
  js: { mimeType: "text/javascript" },
  jsx: { mimeType: "text/javascript" },
  ts: { mimeType: "text/typescript" },
  tsx: { mimeType: "text/typescript" },
  mjs: { mimeType: "text/javascript" },
  cjs: { mimeType: "text/javascript" },

  // Styles
  css: { mimeType: "text/css" },
  scss: { mimeType: "text/scss" },
  sass: { mimeType: "text/sass" },
  less: { mimeType: "text/less" },

  // Other code
  html: { mimeType: "text/html" },
  htm: { mimeType: "text/html" },
  vue: { mimeType: "text/vue" },
  svelte: { mimeType: "text/svelte" },

  // Config files
  lock: { mimeType: "text/plain" },
  env: { mimeType: "text/plain" },
  gitignore: { mimeType: "text/plain" },
  npmrc: { mimeType: "text/plain" },
  nvmrc: { mimeType: "text/plain" },

  // Shell scripts
  sh: { mimeType: "text/x-shellscript" },
  bash: { mimeType: "text/x-shellscript" },
  zsh: { mimeType: "text/x-shellscript" },

  // Makefiles (filename with no extension: Makefile, makefile, GNUmakefile)
  makefile: { mimeType: "text/x-makefile" },
  gnumakefile: { mimeType: "text/x-makefile" },
  // Makefile fragments with extension
  mk: { mimeType: "text/x-makefile" },
  mak: { mimeType: "text/x-makefile" },
}

function detectFileType(bytes: Uint8Array, filename: string): { valid: boolean; mimeType: string } {
  const ext = filename.split(".").pop()?.toLowerCase() || ""
  const typeInfo = FILE_TYPES[ext]

  if (!typeInfo) {
    return { valid: false, mimeType: "application/octet-stream" }
  }

  // If magic bytes are defined, validate them
  if (typeInfo.magicBytes) {
    const isValid = typeInfo.magicBytes.some(magic =>
      magic.every((byte, i) => bytes[i] === byte)
    )
    return { valid: isValid, mimeType: typeInfo.mimeType }
  }

  // SECURITY: Validate SVG content to prevent XSS attacks
  if (ext === "svg") {
    if (!isSafeSVG(bytes)) {
      return { valid: false, mimeType: typeInfo.mimeType }
    }
  }

  // For text-based files, just trust the extension
  return { valid: true, mimeType: typeInfo.mimeType }
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") + "-" + nanoid(6)
}

// ============ SECURITY: Path Sanitization ============

/**
 * Sanitize file paths to prevent path traversal attacks.
 * Removes "..", ".", and invalid characters from path segments.
 */
function sanitizePath(path: string): string {
  return path
    .split(/[\/\\]/) // Handle both forward and backslashes
    .filter(part => part && part !== "." && part !== "..")
    .map(part => part.replace(/[<>:"|?*\x00-\x1f]/g, "")) // Remove invalid chars
    .filter(part => part.length > 0) // Remove empty segments after sanitization
    .join("/")
}

// ============ SECURITY: SVG Content Validation ============

/**
 * Check if SVG content contains potentially dangerous elements.
 * Blocks script tags, javascript: URIs, and event handlers.
 */
function isSafeSVG(content: Uint8Array): boolean {
  try {
    const text = new TextDecoder().decode(content)
    // Check for dangerous patterns: script tags, javascript: URIs, event handlers
    const dangerousPatterns = /<script/i
    const javascriptUri = /javascript\s*:/i
    const eventHandlers = /\s+on\w+\s*=/i
    const dataUri = /data\s*:\s*text\/html/i

    return !dangerousPatterns.test(text) &&
      !javascriptUri.test(text) &&
      !eventHandlers.test(text) &&
      !dataUri.test(text)
  } catch {
    // If we can't decode, reject the file
    return false
  }
}

export async function logoutAction(): Promise<void> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    redirect("/login")
  }
  await clearSession()
  redirect("/login")
}

// ============ CATEGORY ACTIONS ============

export type Category = {
  id: string
  name: string
  color: string
  isDefault: boolean
  projectCount: number
  createdAt: Date
}

export async function getCategoriesAction(): Promise<{
  success: boolean
  categories?: Category[]
  error?: string
}> {
  try {
    const result = await db
      .select({
        id: categories.id,
        name: categories.name,
        color: categories.color,
        isDefault: categories.isDefault,
        createdAt: categories.createdAt,
        projectCount: count(projects.id),
      })
      .from(categories)
      .leftJoin(projects, eq(projects.categoryId, categories.id))
      .groupBy(categories.id)
      .orderBy(categories.name)

    return {
      success: true,
      categories: result.map(c => ({
        id: c.id,
        name: c.name,
        color: c.color,
        isDefault: c.isDefault,
        projectCount: c.projectCount,
        createdAt: c.createdAt!,
      }))
    }
  } catch (error) {
    console.error("Get categories error:", error)
    return { success: false, error: "Failed to fetch categories" }
  }
}

export async function createCategoryAction(
  name: string,
  color: string
): Promise<{ success: boolean; error?: string; categoryId?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  if (!name || name.trim().length === 0) {
    return { success: false, error: "Category name is required" }
  }

  try {
    const result = await db
      .insert(categories)
      .values({ name: name.trim(), color })
      .returning({ id: categories.id })

    revalidatePath("/dashboard")
    return { success: true, categoryId: result[0].id }
  } catch (error: unknown) {
    console.error("Create category error:", error)
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return { success: false, error: "A category with this name already exists" }
    }
    return { success: false, error: "Failed to create category" }
  }
}

export async function updateCategoryAction(
  categoryId: string,
  name: string,
  color: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  if (!name || name.trim().length === 0) {
    return { success: false, error: "Category name is required" }
  }

  try {
    await db
      .update(categories)
      .set({ name: name.trim(), color, updatedAt: new Date() })
      .where(eq(categories.id, categoryId))

    revalidatePath("/dashboard")
    return { success: true }
  } catch (error: unknown) {
    console.error("Update category error:", error)
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return { success: false, error: "A category with this name already exists" }
    }
    return { success: false, error: "Failed to update category" }
  }
}

export async function deleteCategoryAction(
  categoryId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  try {
    // Get category name for audit log
    const category = await db
      .select({ name: categories.name })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1)

    await db.delete(categories).where(eq(categories.id, categoryId))

    // SECURITY: Audit log for destructive action
    await logAuditAction("delete", "category", categoryId, category[0]?.name || null)

    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("Delete category error:", error)
    return { success: false, error: "Failed to delete category" }
  }
}

export async function setDefaultCategoryAction(
  categoryId: string | null
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  try {
    // First, unset any existing default
    await db
      .update(categories)
      .set({ isDefault: false })
      .where(eq(categories.isDefault, true))

    // Set the new default if provided
    if (categoryId) {
      await db
        .update(categories)
        .set({ isDefault: true })
        .where(eq(categories.id, categoryId))
    }

    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("Set default category error:", error)
    return { success: false, error: "Failed to set default category" }
  }
}

export async function assignProjectCategoryAction(
  projectId: string,
  categoryId: string | null
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  try {
    await db
      .update(projects)
      .set({ categoryId, updatedAt: new Date() })
      .where(eq(projects.id, projectId))

    revalidatePath("/dashboard")
    revalidatePath(`/dashboard/projects/${projectId}`)
    return { success: true }
  } catch (error) {
    console.error("Assign project category error:", error)
    return { success: false, error: "Failed to assign category" }
  }
}

// ============ PROJECT ACTIONS ============

export type CreateProjectShareSettings = {
  shareEnabled?: boolean | null
  sharePasswordRequired?: boolean | null
  shareExpiryDays?: number | null
  shareDownloadLimitPerIp?: number | null
  shareDownloadLimitWindowMinutes?: number | null
}

export async function createProjectAction(
  name: string,
  description?: string,
  categoryId?: string,
  url?: string,
  shareSettings?: CreateProjectShareSettings
): Promise<{ success: boolean; error?: string; projectId?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  if (!name || name.trim().length === 0) {
    return { success: false, error: "Project name is required" }
  }

  // Validate URL format if provided
  if (url && url.trim()) {
    try {
      new URL(url.trim())
    } catch {
      return { success: false, error: "Invalid URL format" }
    }
  }

  try {
    const slug = generateSlug(name)

    // If no category provided, try to get the default category
    let finalCategoryId = categoryId || null
    if (!finalCategoryId) {
      const defaultCategory = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.isDefault, true))
        .limit(1)

      if (defaultCategory.length > 0) {
        finalCategoryId = defaultCategory[0].id
      }
    }

    const result = await db
      .insert(projects)
      .values({
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        categoryId: finalCategoryId,
        deployedUrl: url?.trim() || null,
        // Optional share settings
        shareEnabled: shareSettings?.shareEnabled ?? null,
        sharePasswordRequired: shareSettings?.sharePasswordRequired ?? null,
        shareExpiryDays: shareSettings?.shareExpiryDays ?? null,
        shareDownloadLimitPerIp: shareSettings?.shareDownloadLimitPerIp ?? null,
        shareDownloadLimitWindowMinutes: shareSettings?.shareDownloadLimitWindowMinutes ?? null,
      })
      .returning({ id: projects.id })

    revalidatePath("/dashboard")
    return { success: true, projectId: result[0].id }
  } catch (error) {
    console.error("Create project error:", error)
    return { success: false, error: "Failed to create project" }
  }
}

export async function updateProjectAction(
  projectId: string,
  name: string,
  description?: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  if (!name || name.trim().length === 0) {
    return { success: false, error: "Project name is required" }
  }

  try {
    await db
      .update(projects)
      .set({
        name: name.trim(),
        description: description?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))

    revalidatePath("/dashboard")
    revalidatePath(`/dashboard/projects/${projectId}`)
    return { success: true }
  } catch (error) {
    console.error("Update project error:", error)
    return { success: false, error: "Failed to update project" }
  }
}

export async function updateProjectDeployedUrlAction(
  projectId: string,
  deployedUrl: string | null
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  try {
    // Validate URL format if provided
    if (deployedUrl && deployedUrl.trim()) {
      try {
        new URL(deployedUrl.trim())
      } catch {
        return { success: false, error: "Invalid URL format" }
      }
    }

    await db
      .update(projects)
      .set({
        deployedUrl: deployedUrl?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))

    revalidatePath("/dashboard")
    revalidatePath(`/dashboard/projects/${projectId}`)
    return { success: true }
  } catch (error) {
    console.error("Update deployed URL error:", error)
    return { success: false, error: "Failed to update deployed URL" }
  }
}

export async function deleteProjectAction(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  try {
    // Get project name for audit log
    const project = await db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)

    // Get all files in this project to delete from blob storage
    const projectFiles = await db
      .select({ blobUrl: files.blobUrl })
      .from(files)
      .where(eq(files.projectId, projectId))

    // Delete all blobs
    for (const file of projectFiles) {
      try {
        await del(file.blobUrl)
      } catch (e) {
        console.error("Failed to delete blob:", e)
      }
    }

    // Delete project (cascades to folders and files due to ON DELETE CASCADE)
    await db.delete(projects).where(eq(projects.id, projectId))

    // SECURITY: Audit log for destructive action
    await logAuditAction(
      "delete",
      "project",
      projectId,
      project[0]?.name || null,
      JSON.stringify({ fileCount: projectFiles.length })
    )

    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("Delete project error:", error)
    return { success: false, error: "Failed to delete project" }
  }
}

export type Project = {
  id: string
  name: string
  slug: string
  description: string | null
  deployedUrl: string | null
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
  fileCount: number
  totalSize: number
  createdAt: Date
}

export async function getProjectsAction(): Promise<{
  success: boolean
  projects?: Project[]
  error?: string
}> {
  try {
    const result = await db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        description: projects.description,
        deployedUrl: projects.deployedUrl,
        categoryId: projects.categoryId,
        createdAt: projects.createdAt,
        categoryName: categories.name,
        categoryColor: categories.color,
        fileCount: count(files.id),
        totalSize: sum(files.fileSize),
      })
      .from(projects)
      .leftJoin(files, eq(files.projectId, projects.id))
      .leftJoin(categories, eq(categories.id, projects.categoryId))
      .groupBy(projects.id, categories.name, categories.color)
      .orderBy(desc(projects.createdAt))

    return {
      success: true,
      projects: result.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        deployedUrl: p.deployedUrl,
        categoryId: p.categoryId,
        categoryName: p.categoryName,
        categoryColor: p.categoryColor,
        fileCount: p.fileCount,
        totalSize: Number(p.totalSize ?? 0),
        createdAt: p.createdAt!,
      }))
    }
  } catch (error) {
    console.error("Get projects error:", error)
    return { success: false, error: "Failed to fetch projects" }
  }
}

// ============ FOLDER ACTIONS ============

export async function createFolderAction(
  projectId: string,
  name: string,
  parentId?: string
): Promise<{ success: boolean; error?: string; folderId?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  if (!name || name.trim().length === 0) {
    return { success: false, error: "Folder name is required" }
  }

  try {
    const result = await db
      .insert(folders)
      .values({
        projectId,
        parentId: parentId || null,
        name: name.trim(),
      })
      .returning({ id: folders.id })

    revalidatePath(`/dashboard/projects/${projectId}`)
    return { success: true, folderId: result[0].id }
  } catch (error) {
    console.error("Create folder error:", error)
    return { success: false, error: "Failed to create folder" }
  }
}

export async function renameFolderAction(
  folderId: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  if (!name || name.trim().length === 0) {
    return { success: false, error: "Folder name is required" }
  }

  try {
    const result = await db
      .update(folders)
      .set({ name: name.trim(), updatedAt: new Date() })
      .where(eq(folders.id, folderId))
      .returning({ projectId: folders.projectId })

    if (result.length > 0) {
      revalidatePath(`/dashboard/projects/${result[0].projectId}`)
    }
    return { success: true }
  } catch (error) {
    console.error("Rename folder error:", error)
    return { success: false, error: "Failed to rename folder" }
  }
}

export async function deleteFolderAction(
  folderId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  try {
    // Get project ID and folder name
    const folder = await db
      .select({ projectId: folders.projectId, name: folders.name })
      .from(folders)
      .where(eq(folders.id, folderId))
      .limit(1)

    if (folder.length === 0) {
      return { success: false, error: "Folder not found" }
    }

    const projectId = folder[0].projectId
    const folderName = folder[0].name

    // Get all files in this folder tree using raw SQL for recursive CTE
    const filesInTree = await sql`
      WITH RECURSIVE folder_tree AS (
        SELECT id FROM folders WHERE id = ${folderId}
        UNION ALL
        SELECT f.id FROM folders f INNER JOIN folder_tree ft ON f.parent_id = ft.id
      )
      SELECT blob_url FROM files WHERE folder_id IN (SELECT id FROM folder_tree)
    `

    // Delete all blobs
    for (const file of filesInTree) {
      try {
        await del(file.blob_url as string)
      } catch (e) {
        console.error("Failed to delete blob:", e)
      }
    }

    // Delete folder (cascades to subfolders and sets folder_id to null on files)
    await db.delete(folders).where(eq(folders.id, folderId))

    // SECURITY: Audit log for destructive action
    await logAuditAction(
      "delete",
      "folder",
      folderId,
      folderName,
      JSON.stringify({ projectId, fileCount: filesInTree.length })
    )

    revalidatePath(`/dashboard/projects/${projectId}`)
    return { success: true }
  } catch (error) {
    console.error("Delete folder error:", error)
    return { success: false, error: "Failed to delete folder" }
  }
}

export async function getFoldersAction(
  projectId: string,
  parentId?: string
): Promise<{
  success: boolean
  folders?: Array<{
    id: string
    name: string
    parentId: string | null
    fileCount: number
    createdAt: Date
  }>
  error?: string
}> {
  try {
    const whereClause = parentId
      ? and(eq(folders.projectId, projectId), eq(folders.parentId, parentId))
      : and(eq(folders.projectId, projectId), isNull(folders.parentId))

    const result = await db
      .select({
        id: folders.id,
        name: folders.name,
        parentId: folders.parentId,
        createdAt: folders.createdAt,
        fileCount: count(files.id),
      })
      .from(folders)
      .leftJoin(files, eq(files.folderId, folders.id))
      .where(whereClause)
      .groupBy(folders.id)
      .orderBy(folders.name)

    return {
      success: true,
      folders: result.map(f => ({
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        fileCount: f.fileCount,
        createdAt: f.createdAt!,
      }))
    }
  } catch (error) {
    console.error("Get folders error:", error)
    return { success: false, error: "Failed to fetch folders" }
  }
}

// Create folders from a path (e.g. "src/components/ui") and return the leaf folder ID
export async function getOrCreateFolderPathAction(
  projectId: string,
  folderPath: string,
  baseFolderId?: string | null
): Promise<{ success: boolean; folderId?: string; error?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  if (!folderPath || folderPath.trim().length === 0) {
    return { success: true, folderId: baseFolderId || undefined }
  }

  try {
    const pathParts = folderPath.split("/").filter(Boolean)

    if (pathParts.length === 0) {
      return { success: true, folderId: baseFolderId || undefined }
    }

    // Get all existing folders for this project
    const existingFolders = await db
      .select({ id: folders.id, name: folders.name, parentId: folders.parentId })
      .from(folders)
      .where(eq(folders.projectId, projectId))

    // Build a map of existing folders by parent_id and name
    const folderMap = new Map<string, string>()
    for (const f of existingFolders) {
      const key = `${f.parentId || "root"}:${f.name}`
      folderMap.set(key, f.id)
    }

    // Walk through the path and collect folders to create
    let currentParentId: string | null = baseFolderId || null
    const foldersToCreate: Array<{ name: string; parentId: string | null; tempIndex: number }> = []

    for (let i = 0; i < pathParts.length; i++) {
      const folderName = pathParts[i]
      const key = `${currentParentId || "root"}:${folderName}`

      if (folderMap.has(key)) {
        currentParentId = folderMap.get(key)!
      } else {
        // Need to create this folder and all remaining ones
        foldersToCreate.push({ name: folderName, parentId: currentParentId, tempIndex: i })
        currentParentId = null // Will be set after creation

        // Add remaining folders to create list
        for (let j = i + 1; j < pathParts.length; j++) {
          foldersToCreate.push({ name: pathParts[j], parentId: null, tempIndex: j })
        }
        break
      }
    }

    // If no folders to create, return the existing folder ID
    if (foldersToCreate.length === 0) {
      return { success: true, folderId: currentParentId || undefined }
    }

    // Create all missing folders in sequence
    let lastCreatedId: string | null = null

    for (const folder of foldersToCreate) {
      const parentId: string | null = folder.tempIndex === foldersToCreate[0].tempIndex
        ? folder.parentId
        : lastCreatedId

      // Try to insert, handle potential race condition
      try {
        const result: { id: string }[] = await db
          .insert(folders)
          .values({ projectId, parentId, name: folder.name })
          .returning({ id: folders.id })

        if (result.length > 0) {
          lastCreatedId = result[0].id
        }
      } catch {
        // Folder may have been created by concurrent request, fetch it
        const whereClause = parentId
          ? and(eq(folders.projectId, projectId), eq(folders.name, folder.name), eq(folders.parentId, parentId))
          : and(eq(folders.projectId, projectId), eq(folders.name, folder.name), isNull(folders.parentId))

        const existing: { id: string }[] = await db
          .select({ id: folders.id })
          .from(folders)
          .where(whereClause)
          .limit(1)

        if (existing.length > 0) {
          lastCreatedId = existing[0].id
        }
      }
    }

    return { success: true, folderId: lastCreatedId || undefined }
  } catch (error) {
    console.error("Get or create folder path error:", error)
    return { success: false, error: "Failed to create folder structure" }
  }
}

export async function uploadFileAction(
  formData: FormData
): Promise<{ success: boolean; error?: string; publicId?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  const file = formData.get("file") as File
  const title = formData.get("title") as string
  const description = formData.get("description") as string
  const expiresAt = formData.get("expiresAt") as string
  const sharePassword = (formData.get("sharePassword") as string)?.trim() || null
  const projectId = formData.get("projectId") as string
  const folderId = formData.get("folderId") as string
  const relativePath = formData.get("relativePath") as string

  if (!file || file.size === 0) {
    return { success: false, error: "No file provided" }
  }

  if (!title || title.trim().length === 0) {
    return { success: false, error: "Title is required" }
  }

  if (!projectId) {
    return { success: false, error: "Project is required" }
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: "File size exceeds 10MB limit" }
  }

  // Validate file type
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const { valid, mimeType } = detectFileType(bytes, file.name)

  if (!valid) {
    return {
      success: false,
      error: `Unsupported file type: "${file.name}". Supported formats include: images, documents, code files, configs, Makefile, and archives.`,
    }
  }

  try {
    // Determine the target folder ID
    let targetFolderId: string | null = folderId || null

    // If relativePath is provided, extract folder path and create folders
    // SECURITY: Sanitize path to prevent path traversal attacks
    if (relativePath && relativePath.includes("/")) {
      const sanitizedRelativePath = sanitizePath(relativePath)
      const pathParts = sanitizedRelativePath.split("/")
      pathParts.pop() // Remove filename, keep only folder path
      const folderPath = pathParts.join("/")

      if (folderPath) {
        const folderResult = await getOrCreateFolderPathAction(
          projectId,
          folderPath,
          folderId || null
        )
        if (folderResult.success && folderResult.folderId) {
          targetFolderId = folderResult.folderId
        }
      }
    }

    // Upload to Vercel Blob with random suffix to avoid conflicts
    const blob = await put(file.name, file, {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: true,
    })

    // Generate unique public ID
    const publicId = nanoid(21)

    // Optional share password: hash with salt (PBKDF2) – never store plain text
    const sharePasswordFields =
      sharePassword != null && sharePassword.length > 0
        ? (() => {
            const { hash, salt } = hashSharePassword(sharePassword)
            return { sharePasswordHash: hash, sharePasswordSalt: salt }
          })()
        : { sharePasswordHash: null, sharePasswordSalt: null }

    // Save to database
    await db.insert(files).values({
      publicId,
      title: title.trim(),
      description: description?.trim() || null,
      originalFilename: file.name,
      blobUrl: blob.url,
      fileSize: file.size,
      mimeType,
      projectId,
      folderId: targetFolderId,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      ...sharePasswordFields,
    })

    revalidatePath("/dashboard")
    revalidatePath(`/dashboard/projects/${projectId}`)
    return { success: true, publicId }
  } catch (err) {
    console.error("Upload error:", err)
    const message = err instanceof Error ? err.message : "Failed to upload file"
    return { success: false, error: message }
  }
}

export async function moveFileAction(
  fileId: string,
  folderId: string | null
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  try {
    const result = await db
      .update(files)
      .set({ folderId, updatedAt: new Date() })
      .where(eq(files.id, fileId))
      .returning({ projectId: files.projectId })

    if (result.length > 0 && result[0].projectId) {
      revalidatePath(`/dashboard/projects/${result[0].projectId}`)
    }
    return { success: true }
  } catch (error) {
    console.error("Move file error:", error)
    return { success: false, error: "Failed to move file" }
  }
}

// Move multiple files at once
export async function moveFilesAction(
  fileIds: string[],
  folderId: string | null
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  try {
    if (fileIds.length === 0) {
      return { success: false, error: "No files to move" }
    }

    // Use raw SQL for array operations
    const result = await sql`
      UPDATE files SET folder_id = ${folderId}, updated_at = NOW()
      WHERE id = ANY(${fileIds})
      RETURNING project_id
    `

    if (result.length > 0) {
      revalidatePath(`/dashboard/projects/${result[0].project_id}`)
    }
    return { success: true }
  } catch (error) {
    console.error("Move files error:", error)
    return { success: false, error: "Failed to move files" }
  }
}

// Move folder to a new parent (or root if null)
export async function moveFolderAction(
  folderId: string,
  newParentId: string | null
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  try {
    // Prevent moving a folder into itself or its own descendants
    if (newParentId) {
      const checkQuery = await sql`
        WITH RECURSIVE folder_tree AS (
          SELECT id, parent_id FROM folders WHERE id = ${newParentId}
          UNION ALL
          SELECT f.id, f.parent_id 
          FROM folders f 
          JOIN folder_tree ft ON f.id = ft.parent_id
        )
        SELECT 1 FROM folder_tree WHERE id = ${folderId}
      `
      if (checkQuery.length > 0) {
        return { success: false, error: "Cannot move a folder into its own subfolder" }
      }
    }

    const result = await db
      .update(folders)
      .set({ parentId: newParentId })
      .where(eq(folders.id, folderId))
      .returning({ projectId: folders.projectId })

    if (result.length > 0) {
      revalidatePath(`/dashboard/projects/${result[0].projectId}`)
    }
    return { success: true }
  } catch (error) {
    console.error("Move folder error:", error)
    return { success: false, error: "Failed to move folder" }
  }
}

export async function getFilesAction(
  projectId: string,
  folderId?: string
): Promise<{
  success: boolean
  files?: Array<{
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
  }>
  error?: string
}> {
  try {
    const whereClause = folderId
      ? and(eq(files.projectId, projectId), eq(files.folderId, folderId))
      : and(eq(files.projectId, projectId), isNull(files.folderId))

    const result = await db
      .select({
        id: files.id,
        publicId: files.publicId,
        title: files.title,
        description: files.description,
        originalFilename: files.originalFilename,
        fileSize: files.fileSize,
        mimeType: files.mimeType,
        downloadCount: files.downloadCount,
        createdAt: files.createdAt,
        expiresAt: files.expiresAt,
      })
      .from(files)
      .where(whereClause)
      .orderBy(desc(files.createdAt))

    return {
      success: true,
      files: result.map(f => ({
        id: f.id,
        publicId: f.publicId,
        title: f.title,
        description: f.description,
        originalFilename: f.originalFilename,
        fileSize: f.fileSize,
        mimeType: f.mimeType ?? "application/octet-stream",
        downloadCount: f.downloadCount ?? 0,
        createdAt: f.createdAt!,
        expiresAt: f.expiresAt,
      }))
    }
  } catch (error) {
    console.error("Get files error:", error)
    return { success: false, error: "Failed to fetch files" }
  }
}

// Get all files and folders for a project (for file tree view)
export async function getProjectTreeAction(
  projectId: string
): Promise<{
  success: boolean
  folders?: Array<{
    id: string
    name: string
    parentId: string | null
  }>
  files?: Array<{
    id: string
    publicId: string
    title: string
    originalFilename: string
    folderId: string | null
    mimeType: string
    fileSize: number
    blobUrl: string
  }>
  error?: string
}> {
  try {
    // Fetch folders and files separately using Drizzle
    const folderResults = await db
      .select({
        id: folders.id,
        name: folders.name,
        parentId: folders.parentId,
      })
      .from(folders)
      .where(eq(folders.projectId, projectId))
      .orderBy(folders.name)

    const fileResults = await db
      .select({
        id: files.id,
        publicId: files.publicId,
        title: files.title,
        originalFilename: files.originalFilename,
        folderId: files.folderId,
        mimeType: files.mimeType,
        fileSize: files.fileSize,
        blobUrl: files.blobUrl,
      })
      .from(files)
      .where(eq(files.projectId, projectId))
      .orderBy(files.originalFilename)

    return {
      success: true,
      folders: folderResults,
      files: fileResults.map(f => ({
        id: f.id,
        publicId: f.publicId,
        title: f.title,
        originalFilename: f.originalFilename,
        folderId: f.folderId,
        mimeType: f.mimeType ?? "application/octet-stream",
        fileSize: f.fileSize,
        blobUrl: f.blobUrl,
      })),
    }
  } catch (error) {
    console.error("Get project tree error:", error)
    return { success: false, error: "Failed to fetch project tree" }
  }
}

// Get file content for preview
export async function getFileContentAction(
  fileId: string
): Promise<{
  success: boolean
  content?: string
  mimeType?: string
  filename?: string
  blobUrl?: string
  error?: string
}> {
  try {
    const result = await db
      .select({
        blobUrl: files.blobUrl,
        mimeType: files.mimeType,
        originalFilename: files.originalFilename,
      })
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1)

    if (result.length === 0) {
      return { success: false, error: "File not found" }
    }

    const file = result[0]
    const blobUrl = file.blobUrl
    const mimeType = file.mimeType ?? "application/octet-stream"
    const filename = file.originalFilename

    // For text-based files, fetch and return content
    const textMimeTypes = [
      "text/", "application/json", "application/javascript",
      "application/typescript", "application/xml"
    ]

    const isTextFile = textMimeTypes.some((t) => mimeType.startsWith(t)) ||
      mimeType.includes("xml") || mimeType.includes("json")

    if (isTextFile) {
      const response = await fetch(blobUrl)
      const content = await response.text()
      return { success: true, content, mimeType, filename, blobUrl }
    }

    // For binary files, just return the URL for display
    return { success: true, mimeType, filename, blobUrl }
  } catch (error) {
    console.error("Get file content error:", error)
    return { success: false, error: "Failed to fetch file content" }
  }
}

export async function deleteFileAction(
  fileId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  try {
    // Get the file details for audit log
    const result = await db
      .select({
        blobUrl: files.blobUrl,
        title: files.title,
        originalFilename: files.originalFilename,
        projectId: files.projectId
      })
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1)

    if (result.length === 0) {
      return { success: false, error: "File not found" }
    }

    const fileInfo = result[0]

    // Delete from Vercel Blob
    await del(fileInfo.blobUrl)

    // Delete download logs first (foreign key constraint)
    await db.delete(downloadLogs).where(eq(downloadLogs.fileId, fileId))

    // Delete from database
    await db.delete(files).where(eq(files.id, fileId))

    // SECURITY: Audit log for destructive action
    await logAuditAction(
      "delete",
      "file",
      fileId,
      fileInfo.title || fileInfo.originalFilename,
      JSON.stringify({ projectId: fileInfo.projectId, filename: fileInfo.originalFilename })
    )

    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("Delete error:", error)
    return { success: false, error: "Failed to delete file" }
  }
}

// ============ SHARE SETTINGS ACTIONS ============

export type GlobalShareSettings = {
  id: string
  sharingEnabled: boolean
  passwordRequired: boolean
  defaultExpiryDays: number | null
  downloadLimitPerIp: number | null
  downloadLimitWindowMinutes: number | null
}

export type ProjectShareSettings = {
  shareEnabled: boolean | null
  sharePasswordRequired: boolean | null
  shareExpiryDays: number | null
  shareDownloadLimitPerIp: number | null
  shareDownloadLimitWindowMinutes: number | null
}

export type FileShareSettings = {
  shareEnabled: boolean | null
  expiresAt: Date | null
  hasPassword: boolean
  downloadLimitPerIp: number | null
  downloadLimitWindowMinutes: number | null
}

export type EffectiveShareSettings = {
  sharingEnabled: boolean
  passwordRequired: boolean
  expiryDays: number | null
  downloadLimitPerIp: number | null
  downloadLimitWindowMinutes: number | null
}

/**
 * Get or create global share settings (single row).
 * Creates default settings if none exist.
 */
export async function getGlobalShareSettingsAction(): Promise<{
  success: boolean
  settings?: GlobalShareSettings
  error?: string
}> {
  try {
    let result = await db.select().from(shareSettings).limit(1)

    // Create default settings if none exist
    if (result.length === 0) {
      const inserted = await db
        .insert(shareSettings)
        .values({
          sharingEnabled: true,
          passwordRequired: false,
          defaultExpiryDays: null,
          downloadLimitPerIp: null,
          downloadLimitWindowMinutes: 60,
        })
        .returning()
      result = inserted
    }

    const settings = result[0]
    return {
      success: true,
      settings: {
        id: settings.id,
        sharingEnabled: settings.sharingEnabled,
        passwordRequired: settings.passwordRequired,
        defaultExpiryDays: settings.defaultExpiryDays,
        downloadLimitPerIp: settings.downloadLimitPerIp,
        downloadLimitWindowMinutes: settings.downloadLimitWindowMinutes,
      },
    }
  } catch (error) {
    console.error("Get global share settings error:", error)
    return { success: false, error: "Failed to fetch share settings" }
  }
}

/**
 * Update global share settings.
 * These are hard limits - project/file settings can only be more restrictive.
 */
export async function updateGlobalShareSettingsAction(
  settings: Partial<Omit<GlobalShareSettings, "id">>
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  try {
    // Get or create the settings row
    let existing = await db.select({ id: shareSettings.id }).from(shareSettings).limit(1)

    if (existing.length === 0) {
      await db.insert(shareSettings).values({
        sharingEnabled: settings.sharingEnabled ?? true,
        passwordRequired: settings.passwordRequired ?? false,
        defaultExpiryDays: settings.defaultExpiryDays ?? null,
        downloadLimitPerIp: settings.downloadLimitPerIp ?? null,
        downloadLimitWindowMinutes: settings.downloadLimitWindowMinutes ?? 60,
      })
    } else {
      await db
        .update(shareSettings)
        .set({
          ...settings,
          updatedAt: new Date(),
        })
        .where(eq(shareSettings.id, existing[0].id))
    }

    // SECURITY: Audit log for settings change
    await logAuditAction(
      "update",
      "share_settings",
      "global",
      "Global Share Settings",
      JSON.stringify(settings)
    )

    revalidatePath("/setup")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("Update global share settings error:", error)
    return { success: false, error: "Failed to update share settings" }
  }
}

/**
 * Get project share settings.
 */
export async function getProjectShareSettingsAction(
  projectId: string
): Promise<{
  success: boolean
  settings?: ProjectShareSettings
  error?: string
}> {
  try {
    const result = await db
      .select({
        shareEnabled: projects.shareEnabled,
        sharePasswordRequired: projects.sharePasswordRequired,
        shareExpiryDays: projects.shareExpiryDays,
        shareDownloadLimitPerIp: projects.shareDownloadLimitPerIp,
        shareDownloadLimitWindowMinutes: projects.shareDownloadLimitWindowMinutes,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)

    if (result.length === 0) {
      return { success: false, error: "Project not found" }
    }

    return { success: true, settings: result[0] }
  } catch (error) {
    console.error("Get project share settings error:", error)
    return { success: false, error: "Failed to fetch project share settings" }
  }
}

/**
 * Update project share settings.
 * null values mean "inherit from global".
 */
export async function updateProjectShareSettingsAction(
  projectId: string,
  settings: Partial<ProjectShareSettings>
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  try {
    await db
      .update(projects)
      .set({
        shareEnabled: settings.shareEnabled,
        sharePasswordRequired: settings.sharePasswordRequired,
        shareExpiryDays: settings.shareExpiryDays,
        shareDownloadLimitPerIp: settings.shareDownloadLimitPerIp,
        shareDownloadLimitWindowMinutes: settings.shareDownloadLimitWindowMinutes,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))

    // SECURITY: Audit log for settings change
    await logAuditAction(
      "update",
      "share_settings",
      projectId,
      "Project Share Settings",
      JSON.stringify(settings)
    )

    revalidatePath(`/dashboard/projects/${projectId}`)
    return { success: true }
  } catch (error) {
    console.error("Update project share settings error:", error)
    return { success: false, error: "Failed to update project share settings" }
  }
}

/**
 * Get file share settings.
 */
export async function getFileShareSettingsAction(
  fileId: string
): Promise<{
  success: boolean
  settings?: FileShareSettings
  publicId?: string
  error?: string
}> {
  try {
    const result = await db
      .select({
        publicId: files.publicId,
        shareEnabled: files.shareEnabled,
        expiresAt: files.expiresAt,
        sharePasswordHash: files.sharePasswordHash,
        downloadLimitPerIp: files.downloadLimitPerIp,
        downloadLimitWindowMinutes: files.downloadLimitWindowMinutes,
      })
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1)

    if (result.length === 0) {
      return { success: false, error: "File not found" }
    }

    const file = result[0]
    return {
      success: true,
      publicId: file.publicId,
      settings: {
        shareEnabled: file.shareEnabled,
        expiresAt: file.expiresAt,
        hasPassword: Boolean(file.sharePasswordHash),
        downloadLimitPerIp: file.downloadLimitPerIp,
        downloadLimitWindowMinutes: file.downloadLimitWindowMinutes,
      },
    }
  } catch (error) {
    console.error("Get file share settings error:", error)
    return { success: false, error: "Failed to fetch file share settings" }
  }
}

/**
 * Update file share settings.
 * null values mean "inherit from project/global".
 */
export async function updateFileShareSettingsAction(
  fileId: string,
  settings: {
    shareEnabled?: boolean | null
    expiresAt?: Date | null
    sharePassword?: string | null // Empty string = remove password, null = no change
    downloadLimitPerIp?: number | null
    downloadLimitWindowMinutes?: number | null
  }
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  try {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (settings.shareEnabled !== undefined) {
      updateData.shareEnabled = settings.shareEnabled
    }
    if (settings.expiresAt !== undefined) {
      updateData.expiresAt = settings.expiresAt
    }
    if (settings.downloadLimitPerIp !== undefined) {
      updateData.downloadLimitPerIp = settings.downloadLimitPerIp
    }
    if (settings.downloadLimitWindowMinutes !== undefined) {
      updateData.downloadLimitWindowMinutes = settings.downloadLimitWindowMinutes
    }

    // Handle password changes
    if (settings.sharePassword !== undefined) {
      if (settings.sharePassword === null || settings.sharePassword === "") {
        // Remove password
        updateData.sharePasswordHash = null
        updateData.sharePasswordSalt = null
      } else {
        // Set new password
        const { hash, salt } = hashSharePassword(settings.sharePassword)
        updateData.sharePasswordHash = hash
        updateData.sharePasswordSalt = salt
      }
    }

    const result = await db
      .update(files)
      .set(updateData)
      .where(eq(files.id, fileId))
      .returning({ projectId: files.projectId })

    if (result.length > 0 && result[0].projectId) {
      revalidatePath(`/dashboard/projects/${result[0].projectId}`)
    }

    // SECURITY: Audit log for settings change
    await logAuditAction(
      "update",
      "share_settings",
      fileId,
      "File Share Settings",
      JSON.stringify({ ...settings, sharePassword: settings.sharePassword ? "[REDACTED]" : settings.sharePassword })
    )

    return { success: true }
  } catch (error) {
    console.error("Update file share settings error:", error)
    return { success: false, error: "Failed to update file share settings" }
  }
}

/**
 * Regenerate the share link (publicId) for a file.
 * This invalidates the old share URL.
 */
export async function regenerateShareLinkAction(
  fileId: string
): Promise<{ success: boolean; publicId?: string; error?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  try {
    const newPublicId = nanoid(21)

    const result = await db
      .update(files)
      .set({
        publicId: newPublicId,
        updatedAt: new Date(),
      })
      .where(eq(files.id, fileId))
      .returning({ projectId: files.projectId, title: files.title })

    if (result.length === 0) {
      return { success: false, error: "File not found" }
    }

    if (result[0].projectId) {
      revalidatePath(`/dashboard/projects/${result[0].projectId}`)
    }

    // SECURITY: Audit log for link regeneration
    await logAuditAction(
      "regenerate_link",
      "file",
      fileId,
      result[0].title || null,
      JSON.stringify({ newPublicId })
    )

    return { success: true, publicId: newPublicId }
  } catch (error) {
    console.error("Regenerate share link error:", error)
    return { success: false, error: "Failed to regenerate share link" }
  }
}

/**
 * Regenerate share link with hardened security.
 * Downloads the file and re-uploads to create a completely new blob URL.
 * This invalidates BOTH the share URL and the underlying blob URL.
 * Use this when you need to completely revoke access to a file.
 */
export async function regenerateShareLinkHardenedAction(
  fileId: string
): Promise<{ success: boolean; publicId?: string; error?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  try {
    // Get current file info
    const fileResult = await db
      .select({
        id: files.id,
        blobUrl: files.blobUrl,
        originalFilename: files.originalFilename,
        mimeType: files.mimeType,
        fileSize: files.fileSize,
        projectId: files.projectId,
        title: files.title,
      })
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1)

    if (fileResult.length === 0) {
      return { success: false, error: "File not found" }
    }

    const file = fileResult[0]
    const oldBlobUrl = file.blobUrl

    // Check file size - serverless functions have timeout limits
    // For very large files, this operation may timeout
    if (file.fileSize > 50 * 1024 * 1024) {
      return { 
        success: false, 
        error: "File is too large for hardened regeneration (max 50MB). Use standard reset instead." 
      }
    }

    // Download the file from old blob URL
    const response = await fetch(oldBlobUrl)
    if (!response.ok) {
      return { success: false, error: "Failed to download file for re-upload" }
    }

    const fileBlob = await response.blob()

    // Upload to new blob location (gets new random URL)
    const newBlob = await put(file.originalFilename, fileBlob, {
      access: "public",
      contentType: file.mimeType || "application/octet-stream",
      addRandomSuffix: true,
    })

    // Generate new public ID
    const newPublicId = nanoid(21)

    // Update database with new blob URL and public ID
    await db
      .update(files)
      .set({
        blobUrl: newBlob.url,
        publicId: newPublicId,
        updatedAt: new Date(),
      })
      .where(eq(files.id, fileId))

    // Delete old blob (non-blocking, don't fail if this errors)
    try {
      await del(oldBlobUrl)
    } catch (deleteError) {
      console.error("Failed to delete old blob (non-critical):", deleteError)
    }

    if (file.projectId) {
      revalidatePath(`/dashboard/projects/${file.projectId}`)
    }

    // SECURITY: Audit log for hardened link regeneration
    await logAuditAction(
      "regenerate_link_hardened",
      "file",
      fileId,
      file.title || file.originalFilename,
      JSON.stringify({ 
        newPublicId, 
        oldBlobUrl: oldBlobUrl.substring(0, 50) + "...",
        newBlobUrl: newBlob.url.substring(0, 50) + "...",
      })
    )

    return { success: true, publicId: newPublicId }
  } catch (error) {
    console.error("Regenerate share link (hardened) error:", error)
    return { success: false, error: "Failed to regenerate share link. The file may be too large or the operation timed out." }
  }
}

/**
 * Regenerate share links for all files in a project.
 * This invalidates all existing share URLs for the project.
 */
export async function regenerateAllProjectLinksAction(
  projectId: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  const auth = await requireAuthAction()
  if (!auth.authorized) {
    return { success: false, error: auth.error }
  }

  try {
    // Get all files in the project
    const projectFiles = await db
      .select({ id: files.id, title: files.title })
      .from(files)
      .where(eq(files.projectId, projectId))

    if (projectFiles.length === 0) {
      return { success: true, count: 0 }
    }

    // Regenerate each file's publicId
    let regeneratedCount = 0
    for (const file of projectFiles) {
      const newPublicId = nanoid(21)
      await db
        .update(files)
        .set({ publicId: newPublicId, updatedAt: new Date() })
        .where(eq(files.id, file.id))
      regeneratedCount++
    }

    // Get project name for audit log
    const project = await db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)

    // SECURITY: Audit log for bulk link regeneration
    await logAuditAction(
      "regenerate_all_links",
      "project",
      projectId,
      project[0]?.name || null,
      JSON.stringify({ fileCount: regeneratedCount })
    )

    revalidatePath(`/dashboard/projects/${projectId}`)
    return { success: true, count: regeneratedCount }
  } catch (error) {
    console.error("Regenerate all project links error:", error)
    return { success: false, error: "Failed to regenerate project links" }
  }
}

/**
 * Compute effective share settings for a file.
 * Resolution order: global → project → file (most restrictive wins for limits).
 * For boolean settings, inheritance is: file overrides project, project overrides global.
 * But global is the hard limit - if global disables sharing, it's disabled everywhere.
 */
export async function getEffectiveShareSettingsAction(
  fileId: string
): Promise<{
  success: boolean
  settings?: EffectiveShareSettings
  error?: string
}> {
  try {
    // Get file with project info
    const fileResult = await db
      .select({
        projectId: files.projectId,
        shareEnabled: files.shareEnabled,
        expiresAt: files.expiresAt,
        sharePasswordHash: files.sharePasswordHash,
        downloadLimitPerIp: files.downloadLimitPerIp,
        downloadLimitWindowMinutes: files.downloadLimitWindowMinutes,
      })
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1)

    if (fileResult.length === 0) {
      return { success: false, error: "File not found" }
    }

    const file = fileResult[0]

    // Get global settings
    const globalResult = await getGlobalShareSettingsAction()
    if (!globalResult.success || !globalResult.settings) {
      return { success: false, error: "Failed to fetch global settings" }
    }
    const global = globalResult.settings

    // Get project settings if file belongs to a project
    let project: ProjectShareSettings | null = null
    if (file.projectId) {
      const projectResult = await getProjectShareSettingsAction(file.projectId)
      if (projectResult.success && projectResult.settings) {
        project = projectResult.settings
      }
    }

    // Resolve effective settings
    // Global is the hard limit - if global disables, it's disabled
    let sharingEnabled = global.sharingEnabled
    if (sharingEnabled && project?.shareEnabled === false) {
      sharingEnabled = false
    }
    if (sharingEnabled && file.shareEnabled === false) {
      sharingEnabled = false
    }

    // Password: required if any level requires it (most restrictive)
    let passwordRequired = global.passwordRequired
    if (project?.sharePasswordRequired === true) {
      passwordRequired = true
    }
    // File-level: has password if set, otherwise inherit requirement
    const hasFilePassword = Boolean(file.sharePasswordHash)
    if (!hasFilePassword && passwordRequired) {
      // Password is required but file doesn't have one set
      passwordRequired = true
    } else if (hasFilePassword) {
      passwordRequired = true
    }

    // Expiry: most restrictive (smallest) non-null value wins
    let expiryDays = global.defaultExpiryDays
    if (project?.shareExpiryDays !== null && project?.shareExpiryDays !== undefined) {
      if (expiryDays === null || project.shareExpiryDays < expiryDays) {
        expiryDays = project.shareExpiryDays
      }
    }
    // File expiresAt is already a specific date, handled separately in the route

    // Download limit: most restrictive (smallest) non-null value wins
    let downloadLimitPerIp = global.downloadLimitPerIp
    if (project?.shareDownloadLimitPerIp !== null && project?.shareDownloadLimitPerIp !== undefined) {
      if (downloadLimitPerIp === null || project.shareDownloadLimitPerIp < downloadLimitPerIp) {
        downloadLimitPerIp = project.shareDownloadLimitPerIp
      }
    }
    if (file.downloadLimitPerIp !== null) {
      if (downloadLimitPerIp === null || file.downloadLimitPerIp < downloadLimitPerIp) {
        downloadLimitPerIp = file.downloadLimitPerIp
      }
    }

    // Download window: use the most specific non-null value (file > project > global)
    let downloadLimitWindowMinutes = global.downloadLimitWindowMinutes
    if (project?.shareDownloadLimitWindowMinutes !== null && project?.shareDownloadLimitWindowMinutes !== undefined) {
      downloadLimitWindowMinutes = project.shareDownloadLimitWindowMinutes
    }
    if (file.downloadLimitWindowMinutes !== null) {
      downloadLimitWindowMinutes = file.downloadLimitWindowMinutes
    }

    return {
      success: true,
      settings: {
        sharingEnabled,
        passwordRequired,
        expiryDays,
        downloadLimitPerIp,
        downloadLimitWindowMinutes,
      },
    }
  } catch (error) {
    console.error("Get effective share settings error:", error)
    return { success: false, error: "Failed to compute effective settings" }
  }
}
