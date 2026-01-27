"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Lock, AlertCircle, ChevronDown, ShieldAlert } from "lucide-react"
import { loginAction } from "./actions"

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showBypass, setShowBypass] = useState(false)
  const router = useRouter()

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    const result = await loginAction(formData)

    if (result.success) {
      router.push("/dashboard")
    } else {
      setError(result.error || "Login failed")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 dark:bg-zinc-100">
            <Lock className="h-6 w-6 text-white dark:text-zinc-900" />
          </div>
          <CardTitle className="text-2xl">Admin Access</CardTitle>
          <CardDescription>
            Enter your password to manage projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter admin password"
                required
                autoFocus
                disabled={loading}
              />
            </div>

            <Collapsible open={showBypass} onOpenChange={setShowBypass}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between text-muted-foreground hover:text-foreground"
                >
                  <span className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4" />
                    Emergency bypass
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${
                      showBypass ? "rotate-180" : ""
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="space-y-2">
                  <Label htmlFor="bypassToken" className="text-sm text-muted-foreground">
                    Bypass Token
                  </Label>
                  <Input
                    id="bypassToken"
                    name="bypassToken"
                    type="password"
                    placeholder="Enter emergency bypass token"
                    disabled={loading}
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use this if you&apos;re locked out due to IP restrictions or rate limiting.
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
