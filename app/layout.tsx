import React from "react"
import type { Metadata } from 'next'

import { Analytics } from '@vercel/analytics/next'
import '../styles/globals.css'

import { Geist, Geist_Mono, Geist as Font_Geist, Geist_Mono as Font_Geist_Mono, Source_Serif_4 as Font_Source_Serif_4 } from 'next/font/google'

// Initialize fonts
const _geist = Font_Geist({ subsets: ['latin'], weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"] })
const _geistMono = Font_Geist_Mono({ subsets: ['latin'], weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"] })
const _sourceSerif_4 = Font_Source_Serif_4({ subsets: ['latin'], weight: ["200", "300", "400", "500", "600", "700", "800", "900"] })

export const metadata: Metadata = {
  title: 'Projects Explorer - Secure Project Sharing',
  description: 'Upload and share projects securely. Easy downloads for anyone with a link.',
  generator: 'projects-explorer',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${_geist.className} ${_geistMono.className} ${_sourceSerif_4.className} antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
