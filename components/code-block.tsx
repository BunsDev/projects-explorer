'use client'

import { useEffect, useState } from 'react'
import { highlightCodeAction } from '@/app/dashboard/actions'
import { ScrollArea } from '@/components/ui/scroll-area'

interface CodeBlockProps {
  code: string
  filename: string
}

export function CodeBlock({ code, filename }: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    
    highlightCodeAction(code, filename).then(result => {
      if (!cancelled) {
        if (result.success && result.html) {
          setHtml(result.html)
        }
        setIsLoading(false)
      }
    })
    
    return () => {
      cancelled = true
    }
  }, [code, filename])

  // Show plain code while loading or if highlighting failed
  if (isLoading || !html) {
    return (
      <ScrollArea className="h-full">
        <pre className="bg-[#0d1117] p-4 text-sm text-[#c9d1d9] font-mono leading-relaxed">
          <code>{code}</code>
        </pre>
      </ScrollArea>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div
        className="shiki-code bg-[#0d1117] p-4 text-sm font-mono leading-relaxed overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </ScrollArea>
  )
}
