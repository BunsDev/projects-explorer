"use server"

import { verifyPassword, createSession, setSessionCookie } from "@/lib/auth"

export async function loginAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const password = formData.get("password") as string

  if (!password) {
    return { success: false, error: "Password is required" }
  }

  const isValid = await verifyPassword(password)

  if (!isValid) {
    return { success: false, error: "Invalid password" }
  }

  const token = await createSession()
  await setSessionCookie(token)

  return { success: true }
}
