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
    <div className="min-h-screen bg-background flex flex-col mx-auto">
      <header className="border-b bg-card shrink-0">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <div className="flex h-14 sm:h-16 items-center justify-between w-full gap-3 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-2 min-w-0">
              <Archive className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
              <span className="text-base sm:text-lg font-semibold truncate">Projects Explorer</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Link href="/setup" className="flex-1 sm:flex-none">
                <Button variant="ghost" size="sm" className="w-full sm:w-auto">
                  <Rocket className="h-4 w-4 mr-1 shrink-0" />
                  <span className="truncate">Deploy Your Own</span>
                </Button>
              </Link>
              <Link href="/login" className="flex-1 sm:flex-none">
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  <Lock className="h-4 w-4 mr-1 shrink-0" />
                  Admin Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-2xl w-full text-center">
          <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl md:text-5xl text-balance">
            Simple, Secure File Sharing
          </h1>
          <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-7 sm:leading-8 text-muted-foreground text-pretty">
            Upload files securely and share them with anyone via a direct download link.
            No sign-up required for downloads.
          </p>

          <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 sm:grid-cols-2">
            <div className="flex flex-col items-center p-4 sm:p-6 bg-card rounded-xl border text-left sm:text-center">
              <Download className="h-8 w-8 sm:h-10 sm:w-10 text-primary mb-2 sm:mb-3 shrink-0" />
              <h3 className="font-semibold text-primary">Easy Downloads</h3>
              <p className="text-sm text-muted-foreground mt-1 sm:mt-2">
                Anyone with a link can download files instantly - no account needed
              </p>
            </div>
            <div className="flex flex-col items-center p-4 sm:p-6 bg-card rounded-xl border text-left sm:text-center">
              <Shield className="h-8 w-8 sm:h-10 sm:w-10 text-primary mb-2 sm:mb-3 shrink-0" />
              <h3 className="font-semibold text-primary">Secure Uploads</h3>
              <p className="text-sm text-muted-foreground mt-1 sm:mt-2">
                Only authenticated admins can upload new files to the system
              </p>
            </div>
          </div>

          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
            <Link href="/login" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto">
                <Lock className="h-4 w-4 mr-2 shrink-0" />
                Admin Login
              </Button>
            </Link>
            <Link href="/setup" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                <Rocket className="h-4 w-4 mr-2 shrink-0" />
                Deploy Your Own
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t bg-card py-4 sm:py-6 shrink-0">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl text-center text-xs sm:text-sm text-muted-foreground">
          <p>Projects Explorer - Secure file sharing made simple</p>
          <p className="mt-1 flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
            <a href="https://github.com/BunsDev/projects-explorer" className="text-primary hover:underline">
              Open source
            </a>
            <span className="hidden sm:inline"> · </span>
            <Link href="/setup" className="text-primary hover:underline">
              Self-host guide
            </Link>
          </p>
        </div>
      </footer>
    </div>
  )
}
