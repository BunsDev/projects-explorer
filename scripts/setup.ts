#!/usr/bin/env tsx
/**
 * Database Setup Script
 * 
 * This script initializes the Neon PostgreSQL database with all required
 * tables, indexes, and triggers for Projects Explorer.
 * 
 * Usage:
 *   bun run setup
 *   # or
 *   npm run setup
 * 
 * Prerequisites:
 *   - DATABASE_URL environment variable must be set
 *   - Can be set in .env or exported in shell
 */

import { neon } from "@neondatabase/serverless"
import { readFileSync, existsSync } from "fs"
import { join } from "path"

// Load .env if it exists (for npm/node users - Bun does this automatically)
function loadEnvFile() {
  const envPath = join(process.cwd(), ".env")
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf-8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith("#")) continue
      
      const match = trimmed.match(/^([^=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        let value = match[2].trim()
        // Remove surrounding quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        // Only set if not already defined
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    }
  }
}

loadEnvFile()

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
}

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logStep(step: number, total: number, message: string) {
  console.log(`${colors.cyan}[${step}/${total}]${colors.reset} ${message}`)
}

function logSuccess(message: string) {
  console.log(`${colors.green}✓${colors.reset} ${message}`)
}

function logError(message: string) {
  console.log(`${colors.red}✗${colors.reset} ${message}`)
}

async function main() {
  console.log()
  log("━".repeat(60), "cyan")
  log("  Projects Explorer - Database Setup", "bright")
  log("━".repeat(60), "cyan")
  console.log()

  // Step 1: Check for DATABASE_URL
  logStep(1, 4, "Checking environment variables...")
  
  const databaseUrl = process.env.DATABASE_URL
  
  if (!databaseUrl) {
    logError("DATABASE_URL environment variable is not set")
    console.log()
    log("Please set DATABASE_URL in one of these ways:", "yellow")
    console.log("  1. Create a .env.local file with DATABASE_URL=your-connection-string")
    console.log("  2. Export it in your shell: export DATABASE_URL=your-connection-string")
    console.log()
    log("Get your connection string from: https://console.neon.tech", "dim")
    process.exit(1)
  }
  
  // Mask the password in the URL for display
  const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ":****@")
  logSuccess(`DATABASE_URL found: ${maskedUrl.substring(0, 50)}...`)
  console.log()

  // Step 2: Read SQL file
  logStep(2, 4, "Reading setup.sql...")
  
  const sqlPath = join(process.cwd(), "scripts", "setup.sql")
  let sqlContent: string
  
  try {
    sqlContent = readFileSync(sqlPath, "utf-8")
    logSuccess(`Read ${sqlContent.length} characters from setup.sql`)
  } catch (error) {
    logError(`Failed to read setup.sql at ${sqlPath}`)
    console.log()
    log("Make sure you're running this from the project root directory.", "yellow")
    process.exit(1)
  }
  console.log()

  // Step 3: Connect to database
  logStep(3, 4, "Connecting to Neon database...")
  
  const sql = neon(databaseUrl)
  
  try {
    // Test connection
    const result = await sql`SELECT version()`
    const version = result[0]?.version?.split(" ").slice(0, 2).join(" ") || "Unknown"
    logSuccess(`Connected to ${version}`)
  } catch (error) {
    logError("Failed to connect to database")
    console.log()
    if (error instanceof Error) {
      log(`Error: ${error.message}`, "red")
    }
    log("Check your DATABASE_URL and ensure your Neon project is active.", "yellow")
    process.exit(1)
  }
  console.log()

  // Step 4: Execute SQL statements
  logStep(4, 4, "Running database setup...")
  console.log()

  // Split SQL into individual statements (handling multi-line statements)
  // We need to be careful about:
  // - Comments (-- and /* */)
  // - Function bodies with $$ delimiters
  // - Regular statements ending with ;
  
  const statements = parseSqlStatements(sqlContent)
  const total = statements.length
  let successful = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim()
    if (!stmt) continue

    // Extract a readable name for the statement
    const stmtName = getStatementName(stmt)
    
    try {
      await sql.unsafe(stmt)
      successful++
      log(`  ${colors.green}✓${colors.reset} ${stmtName}`)
    } catch (error) {
      if (error instanceof Error) {
        // Some errors are expected (e.g., "already exists")
        if (error.message.includes("already exists")) {
          skipped++
          log(`  ${colors.yellow}○${colors.reset} ${stmtName} ${colors.dim}(already exists)${colors.reset}`)
        } else {
          failed++
          log(`  ${colors.red}✗${colors.reset} ${stmtName}`)
          log(`    ${colors.dim}${error.message}${colors.reset}`)
        }
      }
    }
  }

  console.log()
  log("━".repeat(60), "cyan")
  log("  Setup Complete!", "bright")
  log("━".repeat(60), "cyan")
  console.log()
  
  log(`  ${colors.green}${successful}${colors.reset} statements executed successfully`)
  if (skipped > 0) {
    log(`  ${colors.yellow}${skipped}${colors.reset} statements skipped (already exist)`)
  }
  if (failed > 0) {
    log(`  ${colors.red}${failed}${colors.reset} statements failed`)
  }
  
  console.log()
  log("Next steps:", "bright")
  console.log("  1. Set ADMIN_PASSWORD and BLOB_READ_WRITE_TOKEN in your .env")
  console.log("  2. Run the development server: bun dev")
  console.log("  3. Login at http://localhost:3000/login")
  console.log()

  if (failed > 0) {
    process.exit(1)
  }
}

/**
 * Parse SQL content into individual statements, handling:
 * - Multi-line statements
 * - Comments (-- and block comments)
 * - Function bodies with $$ delimiters
 */
function parseSqlStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ""
  let inFunction = false
  let inBlockComment = false
  
  const lines = sql.split("\n")
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    // Skip empty lines and single-line comments when not in a statement
    if (!current && (trimmed === "" || trimmed.startsWith("--"))) {
      continue
    }
    
    // Handle block comments
    if (trimmed.startsWith("/*")) {
      inBlockComment = true
    }
    if (inBlockComment) {
      if (trimmed.endsWith("*/") || trimmed.includes("*/")) {
        inBlockComment = false
      }
      continue
    }
    
    // Detect function body start/end
    if (trimmed.includes("$$")) {
      inFunction = !inFunction
    }
    
    current += line + "\n"
    
    // Statement ends with ; and we're not inside a function body
    if (trimmed.endsWith(";") && !inFunction) {
      // Don't add if it's just a comment
      if (!current.trim().startsWith("--")) {
        statements.push(current.trim())
      }
      current = ""
    }
  }
  
  // Handle any remaining content
  if (current.trim() && !current.trim().startsWith("--")) {
    statements.push(current.trim())
  }
  
  return statements
}

/**
 * Extract a human-readable name from a SQL statement
 */
function getStatementName(stmt: string): string {
  const upper = stmt.toUpperCase()
  const lines = stmt.split("\n").filter(l => !l.trim().startsWith("--"))
  const firstLine = lines[0]?.trim() || stmt.substring(0, 50)
  
  if (upper.startsWith("CREATE TABLE")) {
    const match = stmt.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)/i)
    return `CREATE TABLE ${match?.[1] || "unknown"}`
  }
  if (upper.startsWith("CREATE INDEX")) {
    const match = stmt.match(/CREATE INDEX\s+(?:IF NOT EXISTS\s+)?(\w+)/i)
    return `CREATE INDEX ${match?.[1] || "unknown"}`
  }
  if (upper.startsWith("CREATE OR REPLACE FUNCTION")) {
    const match = stmt.match(/CREATE OR REPLACE FUNCTION\s+(\w+)/i)
    return `CREATE FUNCTION ${match?.[1] || "unknown"}`
  }
  if (upper.startsWith("CREATE TRIGGER") || upper.includes("CREATE TRIGGER")) {
    const match = stmt.match(/CREATE TRIGGER\s+(\w+)/i)
    return `CREATE TRIGGER ${match?.[1] || "unknown"}`
  }
  if (upper.startsWith("DROP TRIGGER")) {
    const match = stmt.match(/DROP TRIGGER\s+(?:IF EXISTS\s+)?(\w+)/i)
    return `DROP TRIGGER ${match?.[1] || "unknown"}`
  }
  if (upper.startsWith("ALTER TABLE")) {
    const match = stmt.match(/ALTER TABLE\s+(\w+)\s+ADD\s+(?:COLUMN\s+)?(?:IF NOT EXISTS\s+)?(\w+)/i)
    if (match) {
      return `ALTER TABLE ${match[1]} ADD ${match[2]}`
    }
    const tableMatch = stmt.match(/ALTER TABLE\s+(\w+)/i)
    return `ALTER TABLE ${tableMatch?.[1] || "unknown"}`
  }
  
  // Fallback: first 40 chars of first non-comment line
  return firstLine.substring(0, 40) + (firstLine.length > 40 ? "..." : "")
}

// Run the setup
main().catch((error) => {
  logError("Unexpected error during setup")
  console.error(error)
  process.exit(1)
})
