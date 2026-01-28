"use client"

import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="flex size-8 items-center justify-center rounded-full cursor-pointer text-primary hover:bg-muted transition-colors"
      aria-label="Toggle theme"
    >
      <span className="relative size-5">
        <Sun className="absolute inset-0 size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute inset-0 size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </span>
    </button>
  )
}
