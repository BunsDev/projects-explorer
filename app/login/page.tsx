"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Lock, AlertCircle, ChevronDown, ShieldAlert, Eye, EyeOff, Wifi } from "lucide-react"
import { loginAction, getClientIPAction } from "./actions"

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showBypass, setShowBypass] = useState(false)
  const [clientIP, setClientIP] = useState<string | null>(null)
  const [showIP, setShowIP] = useState(false)
  const router = useRouter()

  useEffect(() => {
    getClientIPAction().then(setClientIP)
  }, [])

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
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-background px-4 py-6 sm:py-8">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Lock className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Admin Access</CardTitle>
          <CardDescription>
            Enter your password to manage projects
          </CardDescription>
          {clientIP && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Wifi className="h-3 w-3" />
              <span>Your IP:</span>
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
                {showIP ? clientIP : "••••••••••••"}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setShowIP(!showIP)}
                title={showIP ? "Hide IP" : "Show IP"}
              >
                {showIP ? (
                  <EyeOff className="h-3 w-3" />
                ) : (
                  <Eye className="h-3 w-3" />
                )}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
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
              <CollapsibleContent className="pt-2 pb-4">
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
                    <br />
                    <strong>Note:</strong> Password is not required when using bypass token.
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {!showBypass && (
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
            )}

            {showBypass && (
              <div className="space-y-2">
                <Label htmlFor="password" className="text-muted-foreground">
                  Password <span className="text-xs">(optional with bypass)</span>
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter admin password"
                  disabled={loading}
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
