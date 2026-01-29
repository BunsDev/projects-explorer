"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Upload, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { GlobalShareSettingsCard } from "@/components/share-settings"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/upload", label: "Upload", icon: Upload },
]

export function DashboardBottomNav() {
  const pathname = usePathname()
  const [settingsOpen, setSettingsOpen] = useState(false)
  
  // Hydration fix: defer Dialog rendering until after mount
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
      aria-label="Main navigation"
    >
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-around px-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 px-3 text-xs font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className={cn("size-6 shrink-0", isActive && "stroke-[2.5px]")}
                strokeWidth={isActive ? 2.5 : 2}
                aria-hidden
              />
              <span className="truncate">{label}</span>
            </Link>
          )
        })}

        {/* Settings Modal Trigger */}
        {mounted ? (
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 px-3 text-xs font-medium transition-colors",
                  "text-muted-foreground hover:text-foreground"
                )}
              >
                <Settings
                  className="size-6 shrink-0"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="truncate">Settings</span>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
        ) : (
          <button
            type="button"
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 px-3 text-xs font-medium transition-colors",
              "text-muted-foreground hover:text-foreground"
            )}
          >
            <Settings
              className="size-6 shrink-0"
              strokeWidth={2}
              aria-hidden
            />
            <span className="truncate">Settings</span>
          </button>
        )}
      </div>
    </nav>
  )
}
