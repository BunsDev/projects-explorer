import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

// Create the neon SQL client for raw queries (if needed)
export const sql = neon(process.env.DATABASE_URL!)

// Create the Drizzle ORM instance with full schema
export const db = drizzle(sql, { schema })

// Re-export schema types for convenience
export * from "./schema"
