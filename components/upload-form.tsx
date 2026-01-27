"use client"

import React from "react"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileArchive, X, AlertCircle, Check, Copy } from "lucide-react"
import { uploadFileAction } from "@/app/dashboard/actions"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    setError(null)
    setSuccess(null)

    if (!selectedFile) {
      setFile(null)
      return
    }

    if (!selectedFile.name.toLowerCase().endsWith(".zip")) {
      setError("Please select a ZIP file")
      setFile(null)
      return
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("File size exceeds 10MB limit")
      setFile(null)
      return
    }

    setFile(selectedFile)
  }

  const clearFile = () => {
    setFile(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSubmit = async (formData: FormData) => {
    if (!file) {
      setError("Please select a file")
      return
    }

    setUploading(true)
    setError(null)

    formData.set("file", file)

    const result = await uploadFileAction(formData)

    if (result.success && result.publicId) {
      const url = `${window.location.origin}/share/${result.publicId}`
      setSuccess(url)
      setFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } else {
      setError(result.error || "Upload failed")
    }

    setUploading(false)
  }

  const copyUrl = async () => {
    if (success) {
      await navigator.clipboard.writeText(success)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  if (success) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <Check className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle>Upload Successful</CardTitle>
          <CardDescription>Your file is ready to share</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-zinc-100 rounded-lg">
            <code className="flex-1 text-sm truncate">{success}</code>
            <Button variant="ghost" size="sm" onClick={copyUrl}>
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => {
                setSuccess(null)
                setCopied(false)
              }}
            >
              Upload Another
            </Button>
            <Button className="flex-1" onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload ZIP File</CardTitle>
        <CardDescription>
          Upload a ZIP file (max 10MB) to generate a shareable download link
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* File Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              file
                ? "border-zinc-400 bg-zinc-50"
                : "border-zinc-200 hover:border-zinc-300"
            }`}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileArchive className="h-8 w-8 text-zinc-500" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-zinc-500">{formatBytes(file.size)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFile}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="cursor-pointer block">
                <Upload className="h-8 w-8 mx-auto mb-3 text-zinc-400" />
                <p className="font-medium">Click to select a ZIP file</p>
                <p className="text-sm text-zinc-500 mt-1">Maximum file size: 10MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,application/zip"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              name="title"
              placeholder="Enter a title for this file"
              required
              disabled={uploading}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Optional description"
              rows={3}
              disabled={uploading}
            />
          </div>

          {/* Expiration */}
          <div className="space-y-2">
            <Label htmlFor="expiresAt">Expiration Date (Optional)</Label>
            <Input
              id="expiresAt"
              name="expiresAt"
              type="date"
              min={new Date().toISOString().split("T")[0]}
              disabled={uploading}
            />
            <p className="text-xs text-zinc-500">
              Leave empty for no expiration
            </p>
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => router.push("/dashboard")}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={uploading || !file}>
              {uploading ? "Uploading..." : "Upload File"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
