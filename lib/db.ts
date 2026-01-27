import { neon } from "@neondatabase/serverless"

export const sql = neon(process.env.DATABASE_URL!)

// File types
export interface DbFile {
  id: string
  public_id: string
  title: string
  description: string | null
  original_filename: string
  blob_url: string
  file_size: number
  download_count: number
  expires_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface DbSession {
  id: string
  token: string
  expires_at: Date
  created_at: Date
}

export interface DbDownloadLog {
  id: string
  file_id: string
  ip_address: string
  user_agent: string | null
  downloaded_at: Date
}
