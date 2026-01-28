import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Archive, Lock, Download, Shield, Rocket } from "lucide-react"
import Link from "next/link"

export default async function HomePage() {
  const session = await getSession()

  if (session.valid) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center flex-col mx-auto">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex h-16 items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Archive className="h-6 w-6" />
              <span className="text-lg font-semibold">Projects Explorer</span>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/setup">
                <Button variant="ghost" size="sm">
                  <Rocket className="h-4 w-4 mr-1" />
                  Deploy Your Own
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="sm">
                  <Lock className="h-4 w-4 mr-1" />
                  Admin Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl text-balance">
            Simple, Secure File Sharing
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground text-pretty">
            Upload files securely and share them with anyone via a direct download link.
            No sign-up required for downloads.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col items-center p-6 bg-card rounded-xl border">
              <Download className="h-10 w-10 text-primary mb-3" />
              <h3 className="font-semibold text-primary">Easy Downloads</h3>
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Anyone with a link can download files instantly - no account needed
              </p>
            </div>
            <div className="flex flex-col items-center p-6 bg-card rounded-xl border">
              <Shield className="h-10 w-10 text-primary mb-3" />
              <h3 className="font-semibold text-primary">Secure Uploads</h3>
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Only authenticated admins can upload new files to the system
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login">
              <Button size="lg">
                <Lock className="h-4 w-4 mr-2" />
                Admin Login
              </Button>
            </Link>
            <Link href="/setup">
              <Button size="lg" variant="outline">
                <Rocket className="h-4 w-4 mr-2" />
                Deploy Your Own
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t bg-white py-6">
        <div className="container mx-auto px-4 max-w-6xl text-center text-sm text-muted-foreground">
          <p>Projects Explorer - Secure file sharing made simple</p>
          <p className="mt-1">
            <a href="https://github.com/BunsDev/projects-explorer" className="text-primary hover:underline">
              Open source
            </a>
            {" · "}
            <Link href="/setup" className="text-primary hover:underline">
              Self-host guide
            </Link>
          </p>
        </div>
      </footer>
    </div>
  )
}
