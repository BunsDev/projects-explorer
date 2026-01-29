import { requireAuth } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard-header"
import { UploadForm } from "@/components/upload-form"

export default async function UploadPage() {
  await requireAuth()

  return (
    <div className="min-h-screen bg-background max-w-screen-2xl w-full mx-auto">
      <DashboardHeader title="Upload Files" />
      <main className="mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-2xl w-full">
        <UploadForm />
      </main>
    </div>
  )
}
