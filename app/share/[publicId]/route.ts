import { db, files, downloadLogs, shareSettings, projects } from "@/lib/db"
import { verifySharePassword } from "@/lib/share-password"
import { eq, sql, and, gte, count } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

/** Build HTML for password-protected share: form that POSTs to same URL */
function passwordRequiredHtml(publicId: string, error?: string): string {
  const errorBlock = error
    ? `<p class="error" style="color: var(--destructive); font-size: 0.875rem; margin-bottom: 0.75rem;">${escapeHtml(error)}</p>`
    : ""
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Password required</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #fafafa; }
    .card { background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 1.5rem; max-width: 360px; width: 100%; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    h1 { margin: 0 0 0.5rem; font-size: 1.25rem; font-weight: 600; }
    p { margin: 0 0 1rem; color: #737373; font-size: 0.875rem; }
    label { display: block; margin-bottom: 0.25rem; font-size: 0.875rem; font-weight: 500; }
    input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #e5e5e5; border-radius: 6px; font-size: 1rem; }
    input:focus { outline: none; border-color: #0ea5e9; box-shadow: 0 0 0 2px rgba(14,165,233,0.2); }
    button { width: 100%; margin-top: 1rem; padding: 0.5rem 1rem; background: #0ea5e9; color: #fff; border: none; border-radius: 6px; font-size: 0.875rem; font-weight: 500; cursor: pointer; }
    button:hover { background: #0284c7; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Password required</h1>
    <p>This link is protected. Enter the password to continue.</p>
    ${errorBlock}
    <form method="post" action="/share/${escapeHtml(publicId)}">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required autocomplete="current-password" autofocus />
      <button type="submit">Continue</button>
    </form>
  </div>
</body>
</html>`
}

/** Build HTML for rate limit exceeded page */
function rateLimitExceededHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Download limit reached</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #fafafa; }
    .card { background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 1.5rem; max-width: 360px; width: 100%; box-shadow: 0 1px 3px rgba(0,0,0,0.06); text-align: center; }
    h1 { margin: 0 0 0.5rem; font-size: 1.25rem; font-weight: 600; color: #dc2626; }
    p { margin: 0; color: #737373; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Download limit reached</h1>
    <p>You have exceeded the download limit for this file. Please try again later.</p>
  </div>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

type FileRow = {
  id: string
  blobUrl: string
  originalFilename: string
  projectId: string | null
  expiresAt: Date | null
  sharePasswordHash: string | null
  sharePasswordSalt: string | null
  shareEnabled: boolean | null
  downloadLimitPerIp: number | null
  downloadLimitWindowMinutes: number | null
}

type GlobalSettings = {
  sharingEnabled: boolean
  passwordRequired: boolean
  defaultExpiryDays: number | null
  downloadLimitPerIp: number | null
  downloadLimitWindowMinutes: number | null
}

type ProjectSettings = {
  shareEnabled: boolean | null
  sharePasswordRequired: boolean | null
  shareExpiryDays: number | null
  shareDownloadLimitPerIp: number | null
  shareDownloadLimitWindowMinutes: number | null
}

type EffectiveSettings = {
  sharingEnabled: boolean
  passwordRequired: boolean
  downloadLimitPerIp: number | null
  downloadLimitWindowMinutes: number
}

async function getFileByPublicId(publicId: string): Promise<FileRow | null> {
  const result = await db
    .select({
      id: files.id,
      blobUrl: files.blobUrl,
      originalFilename: files.originalFilename,
      projectId: files.projectId,
      expiresAt: files.expiresAt,
      sharePasswordHash: files.sharePasswordHash,
      sharePasswordSalt: files.sharePasswordSalt,
      shareEnabled: files.shareEnabled,
      downloadLimitPerIp: files.downloadLimitPerIp,
      downloadLimitWindowMinutes: files.downloadLimitWindowMinutes,
    })
    .from(files)
    .where(eq(files.publicId, publicId))
    .limit(1)
  return result.length > 0 ? (result[0] as FileRow) : null
}

async function getGlobalSettings(): Promise<GlobalSettings> {
  const result = await db.select().from(shareSettings).limit(1)
  if (result.length === 0) {
    // Return defaults if no settings exist
    return {
      sharingEnabled: true,
      passwordRequired: false,
      defaultExpiryDays: null,
      downloadLimitPerIp: null,
      downloadLimitWindowMinutes: 60,
    }
  }
  return {
    sharingEnabled: result[0].sharingEnabled,
    passwordRequired: result[0].passwordRequired,
    defaultExpiryDays: result[0].defaultExpiryDays,
    downloadLimitPerIp: result[0].downloadLimitPerIp,
    downloadLimitWindowMinutes: result[0].downloadLimitWindowMinutes ?? 60,
  }
}

async function getProjectSettings(projectId: string): Promise<ProjectSettings | null> {
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
  return result.length > 0 ? result[0] : null
}

/**
 * Compute effective settings for a file.
 * Resolution: global is hard limit, project/file can only be more restrictive.
 */
function computeEffectiveSettings(
  global: GlobalSettings,
  project: ProjectSettings | null,
  file: FileRow
): EffectiveSettings {
  // Sharing enabled: global is the hard limit
  let sharingEnabled = global.sharingEnabled
  if (sharingEnabled && project?.shareEnabled === false) {
    sharingEnabled = false
  }
  if (sharingEnabled && file.shareEnabled === false) {
    sharingEnabled = false
  }

  // Password required: if any level requires it
  let passwordRequired = global.passwordRequired
  if (project?.sharePasswordRequired === true) {
    passwordRequired = true
  }
  // File-level: if password is set, it's effectively required
  if (file.sharePasswordHash) {
    passwordRequired = true
  }

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
  let downloadLimitWindowMinutes = global.downloadLimitWindowMinutes ?? 60
  if (project?.shareDownloadLimitWindowMinutes !== null && project?.shareDownloadLimitWindowMinutes !== undefined) {
    downloadLimitWindowMinutes = project.shareDownloadLimitWindowMinutes
  }
  if (file.downloadLimitWindowMinutes !== null) {
    downloadLimitWindowMinutes = file.downloadLimitWindowMinutes
  }

  return {
    sharingEnabled,
    passwordRequired,
    downloadLimitPerIp,
    downloadLimitWindowMinutes,
  }
}

/**
 * Check if the IP has exceeded the download limit for this file.
 */
async function checkDownloadLimit(
  fileId: string,
  ipAddress: string,
  limit: number,
  windowMinutes: number
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000)
  
  const result = await db
    .select({ count: count() })
    .from(downloadLogs)
    .where(
      and(
        eq(downloadLogs.fileId, fileId),
        eq(downloadLogs.ipAddress, ipAddress),
        gte(downloadLogs.downloadedAt, windowStart)
      )
    )

  const downloadCount = result[0]?.count ?? 0
  return downloadCount >= limit
}

async function logDownloadAndRedirect(file: FileRow, ipAddress: string): Promise<NextResponse> {
  const headersList = await headers()
  const userAgent = headersList.get("user-agent") || null
  
  // Log download (non-blocking)
  db.insert(downloadLogs)
    .values({ fileId: file.id, ipAddress, userAgent })
    .catch(() => {})
  
  // Increment download count (non-blocking)
  db.update(files)
    .set({ downloadCount: sql`${files.downloadCount} + 1` })
    .where(eq(files.id, file.id))
    .catch(() => {})
  
  return NextResponse.redirect(file.blobUrl)
}

async function getClientIp(): Promise<string> {
  const headersList = await headers()
  return (
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown"
  )
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await params

  try {
    const file = await getFileByPublicId(publicId)
    if (!file) {
      return new NextResponse("File not found", { status: 404 })
    }

    // Get effective settings
    const global = await getGlobalSettings()
    const project = file.projectId ? await getProjectSettings(file.projectId) : null
    const effective = computeEffectiveSettings(global, project, file)

    // Check if sharing is enabled
    if (!effective.sharingEnabled) {
      return new NextResponse("File not found", { status: 404 })
    }

    // Check expiration
    if (file.expiresAt && new Date(file.expiresAt) < new Date()) {
      return new NextResponse("File not found", { status: 404 })
    }

    // Get client IP for rate limiting
    const ipAddress = await getClientIp()

    // Check download limit
    if (effective.downloadLimitPerIp !== null) {
      const limitExceeded = await checkDownloadLimit(
        file.id,
        ipAddress,
        effective.downloadLimitPerIp,
        effective.downloadLimitWindowMinutes
      )
      if (limitExceeded) {
        return new NextResponse(rateLimitExceededHtml(), {
          status: 429,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
      }
    }

    // Check if password is required
    const hasPassword = Boolean(file.sharePasswordHash && file.sharePasswordSalt)
    if (hasPassword || effective.passwordRequired) {
      if (!hasPassword && effective.passwordRequired) {
        // Password is required by policy but file doesn't have one set
        // This shouldn't happen in a well-configured system, but handle it gracefully
        return new NextResponse("File not properly configured for sharing", { status: 403 })
      }
      return new NextResponse(passwordRequiredHtml(publicId), {
        status: 403,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    }

    return await logDownloadAndRedirect(file, ipAddress)
  } catch (error) {
    console.error("Download error:", error)
    return new NextResponse("Internal server error", { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await params

  try {
    const file = await getFileByPublicId(publicId)
    if (!file) {
      return new NextResponse("File not found", { status: 404 })
    }

    // Get effective settings
    const global = await getGlobalSettings()
    const project = file.projectId ? await getProjectSettings(file.projectId) : null
    const effective = computeEffectiveSettings(global, project, file)

    // Check if sharing is enabled
    if (!effective.sharingEnabled) {
      return new NextResponse("File not found", { status: 404 })
    }

    // Check expiration
    if (file.expiresAt && new Date(file.expiresAt) < new Date()) {
      return new NextResponse("File not found", { status: 404 })
    }

    // Get client IP for rate limiting
    const ipAddress = await getClientIp()

    // Check download limit
    if (effective.downloadLimitPerIp !== null) {
      const limitExceeded = await checkDownloadLimit(
        file.id,
        ipAddress,
        effective.downloadLimitPerIp,
        effective.downloadLimitWindowMinutes
      )
      if (limitExceeded) {
        return new NextResponse(rateLimitExceededHtml(), {
          status: 429,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
      }
    }

    // Verify password
    const formData = await request.formData()
    const password = (formData.get("password") as string) ?? null

    const hasPassword = Boolean(file.sharePasswordHash && file.sharePasswordSalt)
    
    if (!hasPassword && !effective.passwordRequired) {
      // No password required, allow download
      return await logDownloadAndRedirect(file, ipAddress)
    }

    if (!hasPassword && effective.passwordRequired) {
      // Password required by policy but not set on file
      return new NextResponse("File not properly configured for sharing", { status: 403 })
    }

    // Validate password
    if (!password?.trim()) {
      return new NextResponse(passwordRequiredHtml(publicId, "Password is required."), {
        status: 403,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    }

    const isValid = verifySharePassword(
      password,
      file.sharePasswordHash!,
      file.sharePasswordSalt!
    )

    if (!isValid) {
      return new NextResponse(passwordRequiredHtml(publicId, "Incorrect password."), {
        status: 403,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    }

    // Password correct – log and redirect
    return await logDownloadAndRedirect(file, ipAddress)
  } catch (error) {
    console.error("Download error:", error)
    return new NextResponse("Internal server error", { status: 500 })
  }
}
