import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { ProjectDetailClient } from "./project-detail-client"
import { getProjectTreeAction } from "@/app/dashboard/actions"

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  await requireAuth()

  const { projectId } = await params

  // Fetch project
  const projects = await sql`
    SELECT id, name, slug, description, deployed_url, created_at,
           source_type, github_owner, github_repo, github_branch, last_synced_at
    FROM projects WHERE id = ${projectId}
  `

  if (projects.length === 0) {
    redirect("/dashboard")
  }

  const project = projects[0]

  // Fetch all folders for this project
  const folders = await sql`
    SELECT 
      f.id,
      f.name,
      f.parent_id,
      f.created_at,
      COUNT(fi.id)::int as file_count
    FROM folders f
    LEFT JOIN files fi ON fi.folder_id = f.id
    WHERE f.project_id = ${projectId}
    GROUP BY f.id
    ORDER BY f.name ASC
  `

  // Fetch files at root level (no folder)
  const rootFiles = await sql`
    SELECT 
      id, public_id, title, description, original_filename,
      file_size, mime_type, download_count, created_at, expires_at
    FROM files
    WHERE project_id = ${projectId} AND folder_id IS NULL
    ORDER BY created_at DESC
  `

  // Fetch tree data for GitHub-style file browser
  const treeData = await getProjectTreeAction(projectId)

  return (
    <ProjectDetailClient
      project={{
        id: project.id as string,
        name: project.name as string,
        slug: project.slug as string,
        description: project.description as string | null,
        deployedUrl: project.deployed_url as string | null,
        createdAt: project.created_at as Date,
        sourceType: (project.source_type as string) || "uploaded",
        githubOwner: project.github_owner as string | null,
        githubRepo: project.github_repo as string | null,
        githubBranch: project.github_branch as string | null,
        lastSyncedAt: project.last_synced_at as Date | null,
      }}
      initialFolders={folders.map((f) => ({
        id: f.id as string,
        name: f.name as string,
        parentId: f.parent_id as string | null,
        fileCount: f.file_count as number,
        createdAt: f.created_at as Date,
      }))}
      initialFiles={rootFiles.map((f) => ({
        id: f.id as string,
        publicId: f.public_id as string,
        title: f.title as string,
        description: f.description as string | null,
        originalFilename: f.original_filename as string,
        fileSize: Number(f.file_size),
        mimeType: f.mime_type as string,
        downloadCount: f.download_count as number,
        createdAt: f.created_at as Date,
        expiresAt: f.expires_at as Date | null,
      }))}
      treeFolders={treeData.folders || []}
      treeFiles={treeData.files || []}
    />
  )
}
