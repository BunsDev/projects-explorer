import { db, files, downloadLogs } from "@/lib/db"
import { eq, sql } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await params

  try {
    // Look up the file by public ID
    const result = await db
      .select({
        id: files.id,
        blobUrl: files.blobUrl,
        originalFilename: files.originalFilename,
        expiresAt: files.expiresAt,
      })
      .from(files)
      .where(eq(files.publicId, publicId))
      .limit(1)

    if (result.length === 0) {
      return new NextResponse("File not found", { status: 404 })
    }

    const file = result[0]

    // Check if file has expired
    if (file.expiresAt && new Date(file.expiresAt) < new Date()) {
      return new NextResponse("File not found", { status: 404 })
    }

    // Get client info for logging
    const headersList = await headers()
    const ipAddress =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headersList.get("x-real-ip") ||
      "unknown"
    const userAgent = headersList.get("user-agent") || null

    // Log the download and increment counter (non-blocking)
    db.insert(downloadLogs)
      .values({
        fileId: file.id,
        ipAddress,
        userAgent,
      })
      .catch(() => {})

    db.update(files)
      .set({ downloadCount: sql`${files.downloadCount} + 1` })
      .where(eq(files.id, file.id))
      .catch(() => {})

    // Redirect to the Blob URL for download
    return NextResponse.redirect(file.blobUrl)
  } catch (error) {
    console.error("Download error:", error)
    return new NextResponse("Internal server error", { status: 500 })
  }
}
