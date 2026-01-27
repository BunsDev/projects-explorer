"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Archive,
  Check,
  ChevronRight,
  Copy,
  Database,
  ExternalLink,
  Github,
  Key,
  Rocket,
  Server,
  Shield,
} from "lucide-react"

export default function SetupPage() {
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({})

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedStates({ ...copiedStates, [key]: true })
    setTimeout(() => {
      setCopiedStates((prev) => ({ ...prev, [key]: false }))
    }, 2000)
  }

  const setupSql = `-- Run this in your Neon SQL Editor
-- Copy from: scripts/setup.sql

-- This creates all required tables:
-- • files, projects, folders, categories
-- • sessions, download_logs, auth_logs
-- • All indexes and triggers`

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Archive className="h-6 w-6" />
              <span className="text-lg font-semibold">Projects Explorer</span>
            </Link>
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/BunsDev/projects-explorer"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                <Github className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 max-w-4xl py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">
            <Rocket className="h-3 w-3 mr-1" />
            Developer Setup Guide
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 mb-4">
            Deploy Your Own Instance
          </h1>
          <p className="text-lg text-zinc-600 max-w-2xl mx-auto">
            Get your own Projects Explorer up and running in under 10 minutes.
            Follow these steps to deploy with Vercel and Neon.
          </p>
        </div>

        {/* Quick Deploy Button */}
        <Card className="mb-8 border-2 border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg">One-Click Deploy</h3>
                <p className="text-sm text-zinc-600">
                  The fastest way to get started — deploys to Vercel instantly
                </p>
              </div>
              <a
                href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FBunsDev%2Fprojects-explorer&env=DATABASE_URL,ADMIN_PASSWORD,BLOB_READ_WRITE_TOKEN&envDescription=Required%20environment%20variables%20for%20Projects%20Explorer&envLink=https%3A%2F%2Fgithub.com%2FBunsDev%2Fprojects-explorer%23environment-variables&project-name=projects-explorer&repository-name=projects-explorer"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" className="gap-2">
                  <Rocket className="h-4 w-4" />
                  Deploy with Vercel
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Steps */}
        <div className="space-y-6">
          {/* Step 1: Neon Database */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white text-sm font-medium">
                  1
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Create Neon Database
                  </CardTitle>
                  <CardDescription>Set up your PostgreSQL database (free tier available)</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-700">
                <li>
                  Go to{" "}
                  <a
                    href="https://console.neon.tech"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    console.neon.tech
                  </a>{" "}
                  and create an account
                </li>
                <li>Create a new project (any name works)</li>
                <li>Click <strong>Connection Details</strong> in the sidebar</li>
                <li>Copy the <strong>Connection string</strong> (starts with <code className="bg-zinc-100 px-1 rounded">postgresql://</code>)</li>
              </ol>

              <div className="bg-zinc-900 rounded-lg p-4 font-mono text-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-400 text-xs">Example connection string</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-zinc-400 hover:text-white"
                    onClick={() =>
                      copyToClipboard(
                        "postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require",
                        "db-url"
                      )
                    }
                  >
                    {copiedStates["db-url"] ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <code className="text-green-400 break-all">
                  postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
                </code>
              </div>

              <div className="flex items-start gap-2 text-sm bg-amber-50 text-amber-800 p-3 rounded-lg">
                <span className="text-amber-600">💡</span>
                <span>
                  Use the <strong>Pooled connection</strong> option for production deployments to handle more concurrent connections.
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Run Setup SQL */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white text-sm font-medium">
                  2
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Run Database Setup
                  </CardTitle>
                  <CardDescription>Create tables with a single SQL script</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-zinc-700">
                In the Neon console, go to <strong>SQL Editor</strong> and run the setup script:
              </p>

              <div className="bg-zinc-900 rounded-lg p-4 font-mono text-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-400 text-xs">scripts/setup.sql</span>
                  <a
                    href="https://github.com/BunsDev/projects-explorer/blob/main/scripts/setup.sql"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1"
                  >
                    View on GitHub <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <pre className="text-zinc-300 whitespace-pre-wrap">{setupSql}</pre>
              </div>

              <div className="text-sm text-zinc-600">
                <strong>Alternative:</strong> Run via command line:
              </div>
              <div className="bg-zinc-900 rounded-lg p-4 font-mono text-sm">
                <code className="text-green-400">psql $DATABASE_URL -f scripts/setup.sql</code>
              </div>
            </CardContent>
          </Card>

          {/* Step 3: Vercel Blob */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white text-sm font-medium">
                  3
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Archive className="h-5 w-5" />
                    Set Up Vercel Blob Storage
                  </CardTitle>
                  <CardDescription>For storing uploaded files (free tier: 5GB)</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-700">
                <li>
                  Go to your{" "}
                  <a
                    href="https://vercel.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Vercel Dashboard
                  </a>
                </li>
                <li>Select your project (or create one first via deploy)</li>
                <li>Navigate to the <strong>Storage</strong> tab</li>
                <li>Click <strong>Create Database</strong> → Select <strong>Blob</strong></li>
                <li>Copy the <code className="bg-zinc-100 px-1 rounded">BLOB_READ_WRITE_TOKEN</code> from environment variables</li>
              </ol>
            </CardContent>
          </Card>

          {/* Step 4: Admin Password */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white text-sm font-medium">
                  4
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Choose Admin Password
                  </CardTitle>
                  <CardDescription>Secure password for dashboard access</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-zinc-700">
                Create a strong password for your admin dashboard. This is what you&apos;ll use to login at <code className="bg-zinc-100 px-1 rounded">/login</code>.
              </p>

              <div className="bg-zinc-900 rounded-lg p-4 font-mono text-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-400 text-xs">Generate a secure password (macOS/Linux)</span>
                </div>
                <code className="text-green-400">openssl rand -base64 32</code>
              </div>

              <div className="flex items-start gap-2 text-sm bg-red-50 text-red-800 p-3 rounded-lg">
                <Shield className="h-4 w-4 mt-0.5 text-red-600" />
                <span>
                  Use at least 12 characters with a mix of uppercase, lowercase, numbers, and symbols.
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Step 5: Environment Variables */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white text-sm font-medium">
                  5
                </div>
                <div>
                  <CardTitle>Configure Environment Variables</CardTitle>
                  <CardDescription>Add these to Vercel or your .env.local file</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Variable</th>
                      <th className="text-left py-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="py-3">
                        <code className="bg-zinc-100 px-2 py-1 rounded text-xs">DATABASE_URL</code>
                      </td>
                      <td className="py-3 text-zinc-600">Neon PostgreSQL connection string</td>
                    </tr>
                    <tr>
                      <td className="py-3">
                        <code className="bg-zinc-100 px-2 py-1 rounded text-xs">ADMIN_PASSWORD</code>
                      </td>
                      <td className="py-3 text-zinc-600">Your chosen admin password</td>
                    </tr>
                    <tr>
                      <td className="py-3">
                        <code className="bg-zinc-100 px-2 py-1 rounded text-xs">BLOB_READ_WRITE_TOKEN</code>
                      </td>
                      <td className="py-3 text-zinc-600">Vercel Blob storage token</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-zinc-900 rounded-lg p-4 font-mono text-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-400 text-xs">.env.local example</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-zinc-400 hover:text-white"
                    onClick={() =>
                      copyToClipboard(
                        `DATABASE_URL="postgresql://..."
ADMIN_PASSWORD="your-secure-password"
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."`,
                        "env"
                      )
                    }
                  >
                    {copiedStates["env"] ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <pre className="text-zinc-300">
{`DATABASE_URL="postgresql://..."
ADMIN_PASSWORD="your-secure-password"
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."`}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Step 6: Deploy */}
          <Card className="border-green-200 bg-green-50/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white text-sm font-medium">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-green-900">Deploy & Test</CardTitle>
                  <CardDescription className="text-green-700">You&apos;re ready to go!</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Rocket className="h-4 w-4" />
                    Vercel Deploy
                  </h4>
                  <p className="text-sm text-zinc-600 mb-3">
                    Push to main branch or use one-click deploy
                  </p>
                  <a
                    href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FBunsDev%2Fprojects-explorer&env=DATABASE_URL,ADMIN_PASSWORD,BLOB_READ_WRITE_TOKEN"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      Deploy Now <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </a>
                </div>
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    Local Development
                  </h4>
                  <p className="text-sm text-zinc-600 mb-3">
                    Run locally with Bun or npm
                  </p>
                  <div className="bg-zinc-900 rounded p-2 font-mono text-xs text-green-400">
                    bun install && bun dev
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Post-Deploy Checklist</h4>
                <ul className="space-y-2 text-sm">
                  {[
                    "Database tables created with setup.sql",
                    "Login works at /login with your ADMIN_PASSWORD",
                    "File upload works in dashboard",
                    "Public sharing links work for downloads",
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-zinc-700">
                      <div className="h-5 w-5 rounded border flex items-center justify-center">
                        <ChevronRight className="h-3 w-3 text-zinc-400" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer CTA */}
        <div className="mt-12 text-center">
          <p className="text-zinc-600 mb-4">Need help? Check out the documentation or open an issue.</p>
          <div className="flex items-center justify-center gap-4">
            <a
              href="https://github.com/BunsDev/projects-explorer"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="gap-2">
                <Github className="h-4 w-4" />
                View on GitHub
              </Button>
            </a>
            <Link href="/login">
              <Button className="gap-2">
                Get Started
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white py-6 mt-12">
        <div className="container mx-auto px-4 max-w-4xl text-center text-sm text-zinc-500">
          Made with ❤️ by{" "}
          <a
            href="https://github.com/BunsDev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-700 hover:underline"
          >
            BunsDev
          </a>
        </div>
      </footer>
    </div>
  )
}
