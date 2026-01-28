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

      <div className="mx-auto max-w-screen-2xl w-full h-10 flex items-center gap-3 text-base font-semibold justify-between">
        <div className="flex items-center gap-3">
          <Image src="/icon.svg" className="size-8 aspect-square object-contain" alt="Explorer" width={32} height={32} />
          <span className="text-base font-semibold line-clamp-1 max-w-[148px] sm:max-w-[184px] md:max-w-[336px]">{title ?? "Dashboard"}</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isUploadPage && <Link href="/dashboard/upload">
            <Button variant="glass" size="sm">
              <Plus className="size-4" />
              <span className="sr-only">Upload Files</span>
            </Button>
          </Link>}
          <form action={logoutAction}>
            <Button variant="ghost" size="sm" type="submit" className="hover:bg-accent/50">
              <LogOut className="size-4" />
              <span className="sr-only">Logout</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
