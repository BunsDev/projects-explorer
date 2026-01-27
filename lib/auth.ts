import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { db, sessions, authLogs } from "./db"
import { eq, and, gt, lt, sql } from "drizzle-orm"

const SESSION_COOKIE_NAME = "zip_admin_session"
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// Rate limiting defaults (can be overridden via env)
const DEFAULT_MAX_ATTEMPTS = 5
const DEFAULT_WINDOW_MINUTES = 15

// ============ IP UTILITIES ============

// Cache for public IP lookup (in-memory, per-process)
let cachedPublicIP: { ip: string; timestamp: number } | null = null
const PUBLIC_IP_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Check if an IP is a localhost/local address
 */
function isLocalIP(ip: string): boolean {
  return (
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip === "localhost" ||
    ip.startsWith("::ffff:127.") ||
    ip === "unknown"
  )
}

/**
 * Fetch public IP from external service (for local development)
 */
async function fetchPublicIP(): Promise<string | null> {
  // Check cache first
  if (cachedPublicIP && Date.now() - cachedPublicIP.timestamp < PUBLIC_IP_CACHE_TTL) {
    return cachedPublicIP.ip
  }
  
  try {
    const response = await fetch("https://api.ipify.org?format=json", {
      signal: AbortSignal.timeout(3000), // 3 second timeout
    })
    if (response.ok) {
      const data = await response.json()
      cachedPublicIP = { ip: data.ip, timestamp: Date.now() }
      return data.ip
    }
  } catch {
    // Ignore errors
  }
  return null
}

/**
 * Extract client IP from request headers
 * Priority: x-forwarded-for > x-real-ip > cf-connecting-ip
 * For local development, fetches public IP to match what user sees
 */
export async function getClientIP(): Promise<string> {
  const headersList = await headers()
  
  // x-forwarded-for can contain multiple IPs, take the first (original client)
  const forwardedFor = headersList.get("x-forwarded-for")
  if (forwardedFor) {
    const firstIP = forwardedFor.split(",")[0]?.trim()
    if (firstIP && !isLocalIP(firstIP)) return firstIP
  }
  
  // Fallback headers
  const realIP = headersList.get("x-real-ip")
  if (realIP && !isLocalIP(realIP)) return realIP
  
  const cfIP = headersList.get("cf-connecting-ip")
  if (cfIP && !isLocalIP(cfIP)) return cfIP
  
  // If we're running locally, try to get public IP for consistent behavior
  const publicIP = await fetchPublicIP()
  if (publicIP) return publicIP
  
  return "unknown"
}

/**
 * Get user agent from request headers
 */
export async function getUserAgent(): Promise<string | null> {
  const headersList = await headers()
  return headersList.get("user-agent")
}

/**
 * Convert IPv4 address to 32-bit number
 */
function ipv4ToNumber(ip: string): number | null {
  const parts = ip.split(".")
  if (parts.length !== 4) return null
  
  let result = 0
  for (const part of parts) {
    const num = parseInt(part, 10)
    if (isNaN(num) || num < 0 || num > 255) return null
    result = (result << 8) + num
  }
  
  return result >>> 0 // Convert to unsigned 32-bit
}

/**
 * Check if an IPv4 address is within a CIDR range
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/")
  if (!range || !bitsStr) return false
  
  const bits = parseInt(bitsStr, 10)
  if (isNaN(bits) || bits < 0 || bits > 32) return false
  
  const ipNum = ipv4ToNumber(ip)
  const rangeNum = ipv4ToNumber(range)
  
  if (ipNum === null || rangeNum === null) return false
  
  // Create mask: e.g., /24 = 0xFFFFFF00
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  
  return (ipNum & mask) === (rangeNum & mask)
}

/**
 * Check if an IP address is in the allowlist
 * Returns true if no allowlist is configured (allow all)
 */
export function isIPAllowed(ip: string): boolean {
  const allowedIPs = process.env.ALLOWED_IPS
  
  // If no allowlist configured, allow all IPs
  if (!allowedIPs || allowedIPs.trim() === "") {
    return true
  }
  
  const patterns = allowedIPs.split(",").map((p) => p.trim()).filter(Boolean)
  
  // If allowlist is empty after parsing, allow all
  if (patterns.length === 0) {
    return true
  }
  
  for (const pattern of patterns) {
    if (pattern.includes("/")) {
      // CIDR notation
      if (isIPInCIDR(ip, pattern)) return true
    } else {
      // Exact match
      if (ip === pattern) return true
    }
  }
  
  return false
}

// ============ AUTH LOGGING ============

export type AuthFailureReason = 
  | "invalid_password" 
  | "rate_limited" 
  | "ip_blocked" 
  | "missing_password"
  | "bypass_invalid"

/**
 * Log an authentication attempt to the database
 */
export async function logAuthAttempt(
  ip: string,
  userAgent: string | null,
  success: boolean,
  failureReason?: AuthFailureReason
): Promise<void> {
  try {
    await db.insert(authLogs).values({
      ipAddress: ip,
      userAgent,
      success,
      failureReason: failureReason || null,
    })
  } catch (error) {
    // Don't fail the auth flow if logging fails
    console.error("Failed to log auth attempt:", error)
  }
}

// ============ RATE LIMITING ============

/**
 * Check if an IP address is rate limited due to too many failed attempts
 */
export async function isRateLimited(ip: string): Promise<boolean> {
  const maxAttempts = parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || "", 10) || DEFAULT_MAX_ATTEMPTS
  const windowMinutes = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || "", 10) || DEFAULT_WINDOW_MINUTES
  
  try {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000)
    
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(authLogs)
      .where(
        and(
          eq(authLogs.ipAddress, ip),
          eq(authLogs.success, false),
          gt(authLogs.createdAt, windowStart)
        )
      )
    
    return (result[0]?.count ?? 0) >= maxAttempts
  } catch (error) {
    console.error("Failed to check rate limit:", error)
    // On error, don't block (fail open for rate limiting)
    return false
  }
}

// ============ EMERGENCY BYPASS ============

/**
 * Verify the emergency bypass token
 * This allows login even when rate limited or IP blocked
 */
export async function verifyBypassToken(token: string): Promise<boolean> {
  const bypassToken = process.env.EMERGENCY_BYPASS_TOKEN
  
  // If no bypass token is configured, bypass is disabled
  if (!bypassToken || bypassToken.trim() === "") {
    return false
  }
  
  // Use timing-safe comparison
  return await timingSafeEqual(token, bypassToken)
}

/**
 * Cleanup old auth logs (older than 90 days)
 */
export async function cleanupOldAuthLogs(): Promise<void> {
  const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  await db.delete(authLogs).where(lt(authLogs.createdAt, cutoffDate))
}

// Timing-safe string comparison using Web Crypto API
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const aBytes = encoder.encode(a)
  const bBytes = encoder.encode(b)
  
  // Pad to same length to avoid timing leaks on length difference
  const maxLength = Math.max(aBytes.length, bBytes.length)
  const aPadded = new Uint8Array(maxLength)
  const bPadded = new Uint8Array(maxLength)
  aPadded.set(aBytes)
  bPadded.set(bBytes)
  
  // Use subtle crypto to create hashes for comparison
  const aHash = await crypto.subtle.digest("SHA-256", aPadded)
  const bHash = await crypto.subtle.digest("SHA-256", bPadded)
  
  const aArray = new Uint8Array(aHash)
  const bArray = new Uint8Array(bHash)
  
  // Constant-time comparison
  let result = aBytes.length === bBytes.length ? 0 : 1
  for (let i = 0; i < aArray.length; i++) {
    result |= aArray[i] ^ bArray[i]
  }
  
  return result === 0
}

export async function verifyPassword(password: string): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    console.error("ADMIN_PASSWORD environment variable is not set")
    return false
  }
  return await timingSafeEqual(password, adminPassword)
}

function generateRandomHex(bytes: number): string {
  const array = new Uint8Array(bytes)
  crypto.getRandomValues(array)
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function createSession(): Promise<string> {
  // UUID (36 chars) + hex (24 chars) = 60 chars, fits in varchar(64)
  const token = crypto.randomUUID() + generateRandomHex(12)
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  await db.insert(sessions).values({
    token,
    expiresAt,
  })

  return token
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  })
}

export async function getSession(): Promise<{ valid: boolean }> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token) {
    return { valid: false }
  }

  const result = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.token, token),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1)

  return { valid: result.length > 0 }
}

export async function requireAuth(): Promise<void> {
  const session = await getSession()
  if (!session.valid) {
    redirect("/login")
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token))
  }

  cookieStore.delete(SESSION_COOKIE_NAME)
}

export async function cleanupExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
}
