"use server"

import {
  verifyPassword,
  createSession,
  setSessionCookie,
  getClientIP,
  getUserAgent,
  isIPAllowed,
  isRateLimited,
  logAuthAttempt,
  verifyBypassToken,
} from "@/lib/auth"

export async function loginAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const password = formData.get("password") as string
  const bypassToken = formData.get("bypassToken") as string | null

  // Get client info for logging and security checks
  const ip = await getClientIP()
  const userAgent = await getUserAgent()

  // Check for emergency bypass token first
  const hasBypass = bypassToken && (await verifyBypassToken(bypassToken))

  // If bypass token was provided but invalid, log and reject
  if (bypassToken && !hasBypass) {
    await logAuthAttempt(ip, userAgent, false, "bypass_invalid")
    return { success: false, error: "Invalid bypass token" }
  }

  // Only enforce IP and rate limits if no valid bypass
  if (!hasBypass) {
    // Check IP allowlist
    if (!isIPAllowed(ip)) {
      await logAuthAttempt(ip, userAgent, false, "ip_blocked")
      return { success: false, error: "Access denied" }
    }

    // Check rate limiting
    if (await isRateLimited(ip)) {
      await logAuthAttempt(ip, userAgent, false, "rate_limited")
      return {
        success: false,
        error: "Too many failed attempts. Please try again later.",
      }
    }
  }

  // Validate password is provided
  if (!password) {
    await logAuthAttempt(ip, userAgent, false, "missing_password")
    return { success: false, error: "Password is required" }
  }

  // Verify password
  const isValid = await verifyPassword(password)

  if (!isValid) {
    await logAuthAttempt(ip, userAgent, false, "invalid_password")
    return { success: false, error: "Invalid password" }
  }

  // Success! Log and create session
  await logAuthAttempt(ip, userAgent, true)
  const token = await createSession()
  await setSessionCookie(token)

  return { success: true }
}
