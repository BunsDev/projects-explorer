import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-border/50 placeholder:text-muted-foreground flex field-sizing-content min-h-24 w-full rounded-xl border bg-card/50 backdrop-blur-sm px-4 py-3 text-base shadow-sm transition-all duration-200 outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
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

export { Textarea }
