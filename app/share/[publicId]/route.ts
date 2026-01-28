import { db, files, downloadLogs } from "@/lib/db"
import { verifySharePassword } from "@/lib/share-password"
import { eq, sql } from "drizzle-orm"
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
  expiresAt: Date | null
  sharePasswordHash: string | null
  sharePasswordSalt: string | null
}

async function getFileByPublicId(publicId: string): Promise<FileRow | null> {
  const result = await db
    .select({
      id: files.id,
      blobUrl: files.blobUrl,
      originalFilename: files.originalFilename,
      expiresAt: files.expiresAt,
      sharePasswordHash: files.sharePasswordHash,
      sharePasswordSalt: files.sharePasswordSalt,
    })
    .from(files)
    .where(eq(files.publicId, publicId))
    .limit(1)
  return result.length > 0 ? (result[0] as FileRow) : null
}

/** Check both conditions: not expired (if set) and password (if set). Returns error message or null if allowed. */
function checkAccess(file: FileRow, passwordFromPost: string | null): string | null {
  if (file.expiresAt && new Date(file.expiresAt) < new Date()) {
    return null // Caller treats as not found (404)
  }
  const hasPassword = Boolean(file.sharePasswordHash && file.sharePasswordSalt)
  if (!hasPassword) return null // no password → allowed
  if (!passwordFromPost?.trim()) return "Password is required."
  const valid = verifySharePassword(
    passwordFromPost,
    file.sharePasswordHash!,
    file.sharePasswordSalt!
  )
  return valid ? null : "Incorrect password."
}

function logDownloadAndRedirect(file: FileRow): Promise<NextResponse> {
  return (async () => {
    const headersList = await headers()
    const ipAddress =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headersList.get("x-real-ip") ||
      "unknown"
    const userAgent = headersList.get("user-agent") || null
    db.insert(downloadLogs)
      .values({ fileId: file.id, ipAddress, userAgent })
      .catch(() => {})
    db.update(files)
      .set({ downloadCount: sql`${files.downloadCount} + 1` })
      .where(eq(files.id, file.id))
      .catch(() => {})
    return NextResponse.redirect(file.blobUrl)
  })()
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

    // Optional expiration: treat expired as not found (no info leak)
    if (file.expiresAt && new Date(file.expiresAt) < new Date()) {
      return new NextResponse("File not found", { status: 404 })
    }

    // Optional password: require it before showing anything
    const hasPassword = Boolean(file.sharePasswordHash && file.sharePasswordSalt)
    if (hasPassword) {
      return new NextResponse(passwordRequiredHtml(publicId), {
        status: 403,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    }

    return await logDownloadAndRedirect(file)
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

    // Optional expiration: treat as not found (no info leak)
    if (file.expiresAt && new Date(file.expiresAt) < new Date()) {
      return new NextResponse("File not found", { status: 404 })
    }

    const formData = await request.formData()
    const password = (formData.get("password") as string) ?? null

    const accessError = checkAccess(file, password)
    if (accessError === null && !(file.sharePasswordHash && file.sharePasswordSalt)) {
      // No password on file but we're in POST (shouldn't happen) – allow
      return logDownloadAndRedirect(file)
    }
    if (accessError !== null) {
      return new NextResponse(passwordRequiredHtml(publicId, accessError), {
        status: 403,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    }

    // Password correct – log and redirect
    return logDownloadAndRedirect(file)
  } catch (error) {
    console.error("Download error:", error)
    return new NextResponse("Internal server error", { status: 500 })
  }
}
