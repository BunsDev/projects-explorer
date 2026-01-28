"use client"

import { Button } from "@/components/ui/button"
import { Archive, LogOut, Plus } from "lucide-react"
import Link from "next/link"
import { logoutAction } from "@/app/dashboard/actions"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"

interface DashboardHeaderProps {
  title?: string
}

export function DashboardHeader({ title }: DashboardHeaderProps) {
  const pathname = usePathname()
  const isUploadPage = pathname === "/dashboard/upload"
  return (
    <header className="glass-header rounded-b-2xl px-4 sm:px-6 py-1.5 sticky top-0 z-50 w-full mx-auto">

      <div className="mx-auto max-w-screen-2xl w-full h-10 flex items-center gap-3 text-lg font-semibold justify-between">
        <div className="flex items-center gap-3">
          {/* <Image src="/icon.svg" className="size-9 aspect-square object-contain" alt="Explorer" width={36} height={36} /> */}
          <Link href="/" className="hover:underline text-primary">Home</Link> / <Link href="/dashboard" className="hover:underline text-foreground">{title ?? "Dashboard"}</Link>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {isUploadPage && <Link href="/dashboard/upload">
            <Button size="sm" className="glow-hover">
              <Plus className="h-4 w-4 mr-1" />
              Upload Files
            </Button>
          </Link>}
          <form action={logoutAction}>
            <Button variant="ghost" size="sm" type="submit" className="hover:bg-accent/50">
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
