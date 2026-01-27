"use server"

import { clearSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { put, del } from "@vercel/blob"
import { nanoid } from "nanoid"
import { revalidatePath } from "next/cache"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

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
  
  // For text-based files, just trust the extension
  return { valid: true, mimeType: typeInfo.mimeType }
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") + "-" + nanoid(6)
}

export async function logoutAction(): Promise<void> {
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
    const categories = await sql`
      SELECT 
        c.id,
        c.name,
        c.color,
        c.is_default,
        c.created_at,
        COUNT(p.id)::int as project_count
      FROM categories c
      LEFT JOIN projects p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name ASC
    `
    return {
      success: true,
      categories: categories.map(c => ({
        id: c.id as string,
        name: c.name as string,
        color: c.color as string,
        isDefault: c.is_default as boolean,
        projectCount: c.project_count as number,
        createdAt: c.created_at as Date,
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
  if (!name || name.trim().length === 0) {
    return { success: false, error: "Category name is required" }
  }

  try {
    const result = await sql`
      INSERT INTO categories (name, color)
      VALUES (${name.trim()}, ${color})
      RETURNING id
    `
    revalidatePath("/dashboard")
    return { success: true, categoryId: result[0].id as string }
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
  if (!name || name.trim().length === 0) {
    return { success: false, error: "Category name is required" }
  }

  try {
    await sql`
      UPDATE categories 
      SET name = ${name.trim()}, color = ${color}, updated_at = NOW()
      WHERE id = ${categoryId}
    `
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
  try {
    // Projects with this category will have category_id set to null (ON DELETE SET NULL)
    await sql`DELETE FROM categories WHERE id = ${categoryId}`
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
  try {
    // First, unset any existing default
    await sql`UPDATE categories SET is_default = false WHERE is_default = true`
    
    // Set the new default if provided
    if (categoryId) {
      await sql`UPDATE categories SET is_default = true WHERE id = ${categoryId}`
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
  try {
    await sql`
      UPDATE projects 
      SET category_id = ${categoryId}, updated_at = NOW()
      WHERE id = ${projectId}
    `
    revalidatePath("/dashboard")
    revalidatePath(`/dashboard/projects/${projectId}`)
    return { success: true }
  } catch (error) {
    console.error("Assign project category error:", error)
    return { success: false, error: "Failed to assign category" }
  }
}

// ============ PROJECT ACTIONS ============

export async function createProjectAction(
  name: string,
  description?: string,
  categoryId?: string,
  url?: string
): Promise<{ success: boolean; error?: string; projectId?: string }> {
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
      const defaultCategory = await sql`
        SELECT id FROM categories WHERE is_default = true LIMIT 1
      `
      if (defaultCategory.length > 0) {
        finalCategoryId = defaultCategory[0].id as string
      }
    }

    const result = await sql`
      INSERT INTO projects (name, slug, description, category_id, deployed_url)
      VALUES (${name.trim()}, ${slug}, ${description?.trim() || null}, ${finalCategoryId}, ${url?.trim() || null})
      RETURNING id
    `
    revalidatePath("/dashboard")
    return { success: true, projectId: result[0].id as string }
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
  if (!name || name.trim().length === 0) {
    return { success: false, error: "Project name is required" }
  }

  try {
    await sql`
      UPDATE projects 
      SET name = ${name.trim()}, description = ${description?.trim() || null}, updated_at = NOW()
      WHERE id = ${projectId}
    `
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
  try {
    // Validate URL format if provided
    if (deployedUrl && deployedUrl.trim()) {
      try {
        new URL(deployedUrl.trim())
      } catch {
        return { success: false, error: "Invalid URL format" }
      }
    }

    await sql`
      UPDATE projects 
      SET deployed_url = ${deployedUrl?.trim() || null}, updated_at = NOW()
      WHERE id = ${projectId}
    `
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
  try {
    // Get all files in this project to delete from blob storage
    const files = await sql`
      SELECT blob_url FROM files WHERE project_id = ${projectId}
    `
    
    // Delete all blobs
    for (const file of files) {
      try {
        await del(file.blob_url as string)
      } catch (e) {
        console.error("Failed to delete blob:", e)
      }
    }

    // Delete project (cascades to folders and files due to ON DELETE CASCADE)
    await sql`DELETE FROM projects WHERE id = ${projectId}`
    
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
    const projects = await sql`
      SELECT 
        p.id,
        p.name,
        p.slug,
        p.description,
        p.deployed_url,
        p.category_id,
        p.created_at,
        c.name as category_name,
        c.color as category_color,
        COUNT(f.id)::int as file_count,
        COALESCE(SUM(f.file_size), 0)::bigint as total_size
      FROM projects p
      LEFT JOIN files f ON f.project_id = p.id
      LEFT JOIN categories c ON c.id = p.category_id
      GROUP BY p.id, c.name, c.color
      ORDER BY p.created_at DESC
    `
    return {
      success: true,
      projects: projects.map(p => ({
        id: p.id as string,
        name: p.name as string,
        slug: p.slug as string,
        description: p.description as string | null,
        deployedUrl: p.deployed_url as string | null,
        categoryId: p.category_id as string | null,
        categoryName: p.category_name as string | null,
        categoryColor: p.category_color as string | null,
        fileCount: p.file_count as number,
        totalSize: Number(p.total_size),
        createdAt: p.created_at as Date,
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
  if (!name || name.trim().length === 0) {
    return { success: false, error: "Folder name is required" }
  }

  try {
    const result = await sql`
      INSERT INTO folders (project_id, parent_id, name)
      VALUES (${projectId}, ${parentId || null}, ${name.trim()})
      RETURNING id
    `
    revalidatePath(`/dashboard/projects/${projectId}`)
    return { success: true, folderId: result[0].id as string }
  } catch (error) {
    console.error("Create folder error:", error)
    return { success: false, error: "Failed to create folder" }
  }
}

export async function renameFolderAction(
  folderId: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  if (!name || name.trim().length === 0) {
    return { success: false, error: "Folder name is required" }
  }

  try {
    const result = await sql`
      UPDATE folders SET name = ${name.trim()}, updated_at = NOW()
      WHERE id = ${folderId}
      RETURNING project_id
    `
    if (result.length > 0) {
      revalidatePath(`/dashboard/projects/${result[0].project_id}`)
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
  try {
    // Get project ID and all files in this folder (and subfolders)
    const folder = await sql`SELECT project_id FROM folders WHERE id = ${folderId}`
    if (folder.length === 0) {
      return { success: false, error: "Folder not found" }
    }
    
    const projectId = folder[0].project_id as string

    // Get all files in this folder tree
    const files = await sql`
      WITH RECURSIVE folder_tree AS (
        SELECT id FROM folders WHERE id = ${folderId}
        UNION ALL
        SELECT f.id FROM folders f INNER JOIN folder_tree ft ON f.parent_id = ft.id
      )
      SELECT blob_url FROM files WHERE folder_id IN (SELECT id FROM folder_tree)
    `

    // Delete all blobs
    for (const file of files) {
      try {
        await del(file.blob_url as string)
      } catch (e) {
        console.error("Failed to delete blob:", e)
      }
    }

    // Delete folder (cascades to subfolders and sets folder_id to null on files)
    await sql`DELETE FROM folders WHERE id = ${folderId}`
    
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
    const folders = await sql`
      SELECT 
        f.id,
        f.name,
        f.parent_id,
        f.created_at,
        COUNT(fi.id)::int as file_count
      FROM folders f
      LEFT JOIN files fi ON fi.folder_id = f.id
      WHERE f.project_id = ${projectId} 
        AND ${parentId ? sql`f.parent_id = ${parentId}` : sql`f.parent_id IS NULL`}
      GROUP BY f.id
      ORDER BY f.name ASC
    `
    return {
      success: true,
      folders: folders.map(f => ({
        id: f.id as string,
        name: f.name as string,
        parentId: f.parent_id as string | null,
        fileCount: f.file_count as number,
        createdAt: f.created_at as Date,
      }))
    }
  } catch (error) {
    console.error("Get folders error:", error)
    return { success: false, error: "Failed to fetch folders" }
  }
}

// Create folders from a path (e.g. "src/components/ui") and return the leaf folder ID
// Uses a single query with recursive CTE to minimize database calls
export async function getOrCreateFolderPathAction(
  projectId: string,
  folderPath: string,
  baseFolderId?: string | null
): Promise<{ success: boolean; folderId?: string; error?: string }> {
  if (!folderPath || folderPath.trim().length === 0) {
    return { success: true, folderId: baseFolderId || undefined }
  }

  try {
    const pathParts = folderPath.split("/").filter(Boolean)
    
    if (pathParts.length === 0) {
      return { success: true, folderId: baseFolderId || undefined }
    }

    // First, get all existing folders for this project in a single query
    const existingFolders = await sql`
      SELECT id, name, parent_id
      FROM folders
      WHERE project_id = ${projectId}
    `

    // Build a map of existing folders by parent_id and name
    const folderMap = new Map<string, string>()
    for (const f of existingFolders) {
      const key = `${f.parent_id || "root"}:${f.name}`
      folderMap.set(key, f.id as string)
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

    // Create all missing folders in sequence (necessary due to parent dependencies)
    // But batch into a single transaction-like approach
    let lastCreatedId: string | null = null
    
    for (const folder of foldersToCreate) {
      const parentId = folder.tempIndex === foldersToCreate[0].tempIndex 
        ? folder.parentId 
        : lastCreatedId
      
      const result = await sql`
        INSERT INTO folders (project_id, parent_id, name)
        VALUES (${projectId}, ${parentId}, ${folder.name})
        ON CONFLICT DO NOTHING
        RETURNING id
      `
      
      if (result.length > 0) {
        lastCreatedId = result[0].id as string
      } else {
        // Folder was created by concurrent request, fetch it
        const existing = await sql`
          SELECT id FROM folders 
          WHERE project_id = ${projectId} 
            AND name = ${folder.name}
            AND ${parentId ? sql`parent_id = ${parentId}` : sql`parent_id IS NULL`}
          LIMIT 1
        `
        if (existing.length > 0) {
          lastCreatedId = existing[0].id as string
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
  const file = formData.get("file") as File
  const title = formData.get("title") as string
  const description = formData.get("description") as string
  const expiresAt = formData.get("expiresAt") as string
  const projectId = formData.get("projectId") as string
  const folderId = formData.get("folderId") as string
  const relativePath = formData.get("relativePath") as string // e.g. "src/components/Button.tsx"

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
    return { success: false, error: "Invalid or unsupported file type. Supported formats include: images, documents, code files, configs, and archives." }
  }

  try {
    // Determine the target folder ID
    let targetFolderId: string | null = folderId || null

    // If relativePath is provided, extract folder path and create folders
    if (relativePath && relativePath.includes("/")) {
      const pathParts = relativePath.split("/")
      pathParts.pop() // Remove filename, keep only folder path
      const folderPath = pathParts.join("/")
      
      if (folderPath) {
        const folderResult = await getOrCreateFolderPathAction(
          projectId,
          folderPath,
          folderId || null // Use selected folder as base if provided
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

    // Save to database
    await sql`
      INSERT INTO files (public_id, title, description, original_filename, blob_url, file_size, mime_type, project_id, folder_id, expires_at)
      VALUES (
        ${publicId},
        ${title.trim()},
        ${description?.trim() || null},
        ${file.name},
        ${blob.url},
        ${file.size},
        ${mimeType},
        ${projectId},
        ${targetFolderId},
        ${expiresAt || null}
      )
    `

    revalidatePath("/dashboard")
    revalidatePath(`/dashboard/projects/${projectId}`)
    return { success: true, publicId }
  } catch (error) {
    console.error("Upload error:", error)
    return { success: false, error: "Failed to upload file" }
  }
}

export async function moveFileAction(
  fileId: string,
  folderId: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await sql`
      UPDATE files SET folder_id = ${folderId}, updated_at = NOW()
      WHERE id = ${fileId}
      RETURNING project_id
    `
    if (result.length > 0) {
      revalidatePath(`/dashboard/projects/${result[0].project_id}`)
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
  try {
    if (fileIds.length === 0) {
      return { success: false, error: "No files to move" }
    }
    
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
  try {
    // Prevent moving a folder into itself or its own descendants
    if (newParentId) {
      // Check if newParentId is a descendant of folderId
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

    const result = await sql`
      UPDATE folders SET parent_id = ${newParentId}
      WHERE id = ${folderId}
      RETURNING project_id
    `
    if (result.length > 0) {
      revalidatePath(`/dashboard/projects/${result[0].project_id}`)
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
    const files = await sql`
      SELECT 
        id, public_id, title, description, original_filename, 
        file_size, mime_type, download_count, created_at, expires_at
      FROM files
      WHERE project_id = ${projectId}
        AND ${folderId ? sql`folder_id = ${folderId}` : sql`folder_id IS NULL`}
      ORDER BY created_at DESC
    `
    return {
      success: true,
      files: files.map(f => ({
        id: f.id as string,
        publicId: f.public_id as string,
        title: f.title as string,
        description: f.description as string | null,
        originalFilename: f.original_filename as string,
        fileSize: Number(f.file_size),
        mimeType: f.mime_type as string,
        downloadCount: f.download_count as number,
        createdAt: f.created_at as Date,
        expiresAt: f.expires_at as Date | null,
      }))
    }
  } catch (error) {
    console.error("Get files error:", error)
    return { success: false, error: "Failed to fetch files" }
  }
}

// Get all files and folders for a project (for file tree view)
// Uses a single combined query to avoid rate limiting
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
    // Combined query using UNION ALL to fetch both folders and files in one request
    const results = await sql`
      SELECT 
        'folder' as item_type,
        id,
        name,
        parent_id,
        NULL as public_id,
        NULL as title,
        NULL as original_filename,
        NULL as folder_id,
        NULL as mime_type,
        NULL as file_size,
        NULL as blob_url
      FROM folders
      WHERE project_id = ${projectId}
      UNION ALL
      SELECT 
        'file' as item_type,
        id,
        NULL as name,
        NULL as parent_id,
        public_id,
        title,
        original_filename,
        folder_id,
        mime_type,
        file_size::text,
        blob_url
      FROM files
      WHERE project_id = ${projectId}
      ORDER BY item_type DESC, name ASC NULLS LAST, original_filename ASC NULLS LAST
    `

    const folders: Array<{ id: string; name: string; parentId: string | null }> = []
    const files: Array<{
      id: string
      publicId: string
      title: string
      originalFilename: string
      folderId: string | null
      mimeType: string
      fileSize: number
      blobUrl: string
    }> = []

    for (const row of results) {
      if (row.item_type === "folder") {
        folders.push({
          id: row.id as string,
          name: row.name as string,
          parentId: row.parent_id as string | null,
        })
      } else {
        files.push({
          id: row.id as string,
          publicId: row.public_id as string,
          title: row.title as string,
          originalFilename: row.original_filename as string,
          folderId: row.folder_id as string | null,
          mimeType: row.mime_type as string,
          fileSize: Number(row.file_size),
          blobUrl: row.blob_url as string,
        })
      }
    }

    return { success: true, folders, files }
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
    const files = await sql`
      SELECT blob_url, mime_type, original_filename
      FROM files WHERE id = ${fileId}
    `

    if (files.length === 0) {
      return { success: false, error: "File not found" }
    }

    const file = files[0]
    const blobUrl = file.blob_url as string
    const mimeType = file.mime_type as string
    const filename = file.original_filename as string

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
  try {
    // Get the blob URL first
    const files = await sql`
      SELECT blob_url FROM files WHERE id = ${fileId}
    `

    if (files.length === 0) {
      return { success: false, error: "File not found" }
    }

    const blobUrl = files[0].blob_url as string

    // Delete from Vercel Blob
    await del(blobUrl)

    // Delete download logs first (foreign key constraint)
    await sql`DELETE FROM download_logs WHERE file_id = ${fileId}`

    // Delete from database
    await sql`DELETE FROM files WHERE id = ${fileId}`

    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("Delete error:", error)
    return { success: false, error: "Failed to delete file" }
  }
}
