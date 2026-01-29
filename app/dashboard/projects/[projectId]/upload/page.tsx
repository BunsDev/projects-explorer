import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { DashboardHeader } from "@/components/dashboard-header"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { ProjectUploadForm } from "@/components/project-upload-form"

export default async function ProjectUploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ folder?: string }>
}) {
  await requireAuth()

  const { projectId } = await params
  const { folder: folderId } = await searchParams

  // Fetch project
  const projects = await sql`
    SELECT id, name FROM projects WHERE id = ${projectId}
  `

  if (projects.length === 0) {
    redirect("/dashboard")
  }

  const project = projects[0]

  // Fetch folders for this project
  const folders = await sql`
    SELECT id, name, parent_id FROM folders WHERE project_id = ${projectId} ORDER BY name ASC
  `

  // Get folder name if uploading to a specific folder
  let folderName: string | null = null
  if (folderId) {
    const folder = folders.find((f) => f.id === folderId)
    folderName = folder?.name as string | null
  }

  const breadcrumbs = [
    { label: project.name as string, href: `/dashboard/projects/${projectId}` },
    { label: folderName ? `Upload to ${folderName}` : "Upload Files" },
  ]

  return (
    <div className="min-h-screen bg-background max-w-screen-2xl w-full mx-auto">
      <DashboardHeader title={project.name} />
      <main className="w-full px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-4 sm:mb-6">
          <BreadcrumbNav items={breadcrumbs} />
        </div>

        <div className="mx-auto max-w-2xl w-full">
          <div className="mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Upload Files</h1>
            <p className="text-muted-foreground">
              Upload files to {folderName ? `"${folderName}"` : `"${project.name as string}"`}
            </p>
          </div>

          <ProjectUploadForm
            projectId={projectId}
            folderId={folderId || null}
            folders={folders.map((f) => ({
              id: f.id as string,
              name: f.name as string,
              parentId: f.parent_id as string | null,
            }))}
          />
        </div>
      </main>
    </div>
  )
}
