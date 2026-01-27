import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Security Middleware
 * 
 * Adds security headers to all responses to protect against common attacks:
 * - XSS (Cross-Site Scripting)
 * - Clickjacking
 * - MIME sniffing
 * - Information disclosure
 */
export function middleware(request: NextRequest) {
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
    "camera=(), microphone=(), geolocation=(), browsing-topics=()"
  )

  // ============ Content Security Policy ============
  // Note: 'unsafe-inline' and 'unsafe-eval' are required for Next.js development
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

  // ============ Additional Security Headers ============

  // Prevent DNS prefetching to protect privacy
  response.headers.set("X-DNS-Prefetch-Control", "off")

  // Opt out of Google FLoC (Federated Learning of Cohorts)
  response.headers.set("Permissions-Policy", "interest-cohort=()")

  return response
}

// Apply middleware to all routes except static files
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (icons, images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
