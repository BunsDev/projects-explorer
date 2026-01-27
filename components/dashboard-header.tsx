"use client"

import { Button } from "@/components/ui/button"
import { Archive, LogOut, Plus } from "lucide-react"
import Link from "next/link"
import { logoutAction } from "@/app/dashboard/actions"

export function DashboardHeader() {
  return (
    <header className="glass-header sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl stat-icon-bg p-2">
              <Archive className="h-5 w-5 text-primary" />
            </div>
            <span className="text-lg font-semibold gradient-text">ZIP Manager</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/upload">
              <Button size="sm" className="glow-hover">
                <Plus className="h-4 w-4 mr-1" />
                Upload
              </Button>
            </Link>
            <form action={logoutAction}>
              <Button variant="ghost" size="sm" type="submit" className="hover:bg-accent/50">
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </Button>
            </form>
          </div>
        </div>
      </div>
    </header>
  )
}
