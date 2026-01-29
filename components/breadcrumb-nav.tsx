"use client"

import Link from "next/link"
import { ChevronRight, Home } from "lucide-react"

type BreadcrumbItem = {
  label: string
  href?: string
}

export function BreadcrumbNav({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground min-w-0 flex-wrap">
      <Link
        href="/dashboard"
        className="flex items-center gap-1 hover:text-foreground transition-colors shrink-0"
        aria-label="Dashboard"
      >
        <Home className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </Link>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-1 min-w-0 max-w-full">
          <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground transition-colors max-w-[120px] sm:max-w-[180px] truncate block min-w-0">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium truncate block min-w-0">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  )
}
