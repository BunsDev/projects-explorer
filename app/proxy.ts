import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Security Proxy (Next.js 16+)
 *
 * Adds security headers to all responses to protect against common attacks:
 * - XSS (Cross-Site Scripting)
 * - Clickjacking
 * - MIME sniffing
 * - Information disclosure
 *
 * Note: Authentication is handled in server actions/layouts, not here.
 * Proxy is only for routing operations and header modifications.
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next()

  // ============ Security Headers ============

  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff")

  // Prevent clickjacking attacks
  response.headers.set("X-Frame-Options", "DENY")

  // Enable XSS filter in older browsers
  response.headers.set("X-XSS-Protection", "1; mode=block")

  // Control referrer information
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  // Restrict browser features/APIs
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=()"
  )

  // Prevent DNS prefetching to protect privacy
  response.headers.set("X-DNS-Prefetch-Control", "off")

  // ============ Content Security Policy ============
  // Note: 'unsafe-inline' and 'unsafe-eval' are required for Next.js
  // Consider tightening these in production with nonce-based CSP

  const cspDirectives = [
    "default-src 'self'",
    // Scripts: self + inline (for Next.js) + eval (for dev hot reload)
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    // Styles: self + inline (for component libraries)
    "style-src 'self' 'unsafe-inline'",
    // Images: self + data URIs + blob + any HTTPS (for external images)
    "img-src 'self' data: blob: https:",
    // Fonts: self
    "font-src 'self'",
    // Connect: self + Vercel blob + IP lookup service
    "connect-src 'self' https://*.public.blob.vercel-storage.com https://api.ipify.org",
    // Frames: none (we don't use iframes)
    "frame-ancestors 'none'",
    // Forms: self only
    "form-action 'self'",
    // Base URI: self only (prevent base tag injection)
    "base-uri 'self'",
    // Object/embed: none (block Flash, Java, etc.)
    "object-src 'none'",
  ]

  response.headers.set("Content-Security-Policy", cspDirectives.join("; "))

  return response
}

// Apply to all routes except static files
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
