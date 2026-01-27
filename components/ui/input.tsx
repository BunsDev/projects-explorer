import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-border/50 h-11 w-full min-w-0 rounded-xl border bg-card/50 backdrop-blur-sm px-4 py-2 text-base shadow-sm transition-all duration-200 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'hover:border-border hover:bg-card/70',
        'focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[3px] focus-visible:bg-card/80',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        'dark:bg-input/20 dark:hover:bg-input/30 dark:focus-visible:bg-input/40',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
