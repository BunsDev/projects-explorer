"use client"

import { Button } from "@/components/ui/button"
import { Archive, LogOut, Plus } from "lucide-react"
import Link from "next/link"
import { logoutAction } from "@/app/dashboard/actions"

export function DashboardHeader() {
  return (
    <header className="border-b bg-white">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="h-6 w-6" />
            <span className="text-lg font-semibold">ZIP Manager</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/upload">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Upload
              </Button>
            </Link>
            <form action={logoutAction}>
              <Button variant="ghost" size="sm" type="submit">
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
