"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Archive, LogOut, Plus, Settings } from "lucide-react"
import Link from "next/link"
import { logoutAction } from "@/app/dashboard/actions"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"
import { GlobalShareSettingsCard } from "@/components/share-settings"

interface DashboardHeaderProps {
  title?: string
}

export function DashboardHeader({ title }: DashboardHeaderProps) {
  const pathname = usePathname()
  const isUploadPage = pathname === "/dashboard/upload"
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <header className="glass-header rounded-b-2xl px-4 sm:px-6 py-1.5 sticky top-0 z-50 w-full mx-auto">

      <div className="mx-auto max-w-screen-2xl w-full h-10 flex items-center gap-3 text-base font-semibold justify-between">
        <div className="flex items-center gap-3">
          <Image src="/icon.svg" className="size-8 aspect-square object-contain" alt="Explorer" width={32} height={32} />
          <span className="text-base font-semibold line-clamp-1 max-w-[148px] sm:max-w-[184px] md:max-w-[336px]">{title ?? "Dashboard"}</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          
          {/* Global Settings Modal */}
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="hover:bg-accent/50" suppressHydrationWarning>
                <Settings className="size-4" />
                <span className="sr-only">Global Settings</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Global Settings</DialogTitle>
                <DialogDescription>
                  Configure global defaults for sharing and security.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <GlobalShareSettingsCard onSave={() => setSettingsOpen(false)} />
              </div>
            </DialogContent>
          </Dialog>

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
