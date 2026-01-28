import { requireAuth } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard-header"
import { UploadForm } from "@/components/upload-form"

export default async function UploadPage() {
  await requireAuth()

  return (
    <div className="min-h-screen bg-zinc-50">
      <DashboardHeader title="Upload Files" />
      <main className="mx-auto px-4 py-8 max-w-2xl">
        <UploadForm />
      </main>
    </div>
  )
}
