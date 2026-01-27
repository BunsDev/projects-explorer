import { sql } from "@/lib/db"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await params

  try {
    // Look up the file by public ID
    const files = await sql`
      SELECT id, blob_url, original_filename, expires_at
      FROM files
      WHERE public_id = ${publicId}
      LIMIT 1
    `

    if (files.length === 0) {
      return new NextResponse("File not found", { status: 404 })
    }

    const file = files[0]

    // Check if file has expired
    if (file.expires_at && new Date(file.expires_at as string) < new Date()) {
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
    sql`
      INSERT INTO download_logs (file_id, ip_address, user_agent)
      VALUES (${file.id}, ${ipAddress}, ${userAgent})
    `.catch(() => {})

    sql`
      UPDATE files SET download_count = download_count + 1 WHERE id = ${file.id}
    `.catch(() => {})

    // Redirect to the Blob URL for download
    return NextResponse.redirect(file.blob_url as string)
  } catch (error) {
    console.error("Download error:", error)
    return new NextResponse("Internal server error", { status: 500 })
  }
}
