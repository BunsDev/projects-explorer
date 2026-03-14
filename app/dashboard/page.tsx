import { requireAuth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { DashboardHeader } from "@/components/dashboard-header"
import { StatsCards } from "@/components/stats-cards"
import { ProjectList } from "@/components/project-list"
import { CloudStatusPanel } from "@/components/cloud-status-panel"
import { CloudSettingsCard } from "@/components/cloud-settings-card"
import { CloudActivityList } from "@/components/cloud-activity-list"
import { getCloudStorageConfig } from "@/lib/cloud/config"
import { getDiskPressureSnapshot } from "@/lib/cloud/server/disk-pressure"
import { S3CompatibleStorageProvider } from "@/lib/cloud/providers/s3-compatible-provider"
import { getQueueSummary, getRecentActivity } from "@/lib/cloud/queue-store"
import { getTraySyncSnapshot } from "@/lib/cloud/tray-state"

export default async function DashboardPage() {
  await requireAuth()

  const projects = await sql`
    SELECT 
      p.id,
      p.name,
      p.slug,
      p.description,
      p.deployed_url,
      p.category_id,
      p.created_at,
      c.name as category_name,
      c.color as category_color,
      COUNT(f.id)::int as file_count,
      COALESCE(SUM(f.file_size), 0)::bigint as total_size
    FROM projects p
    LEFT JOIN files f ON f.project_id = p.id
    LEFT JOIN categories c ON c.id = p.category_id
    GROUP BY p.id, c.name, c.color
    ORDER BY p.created_at DESC
  `

  const categories = await sql`
    SELECT 
      c.id,
      c.name,
      c.color,
      c.is_default,
      c.created_at,
      COUNT(p.id)::int as project_count
    FROM categories c
    LEFT JOIN projects p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name ASC
  `

  const stats = await sql`
    SELECT 
      COUNT(*)::int as total_files,
      COALESCE(SUM(file_size), 0)::bigint as total_size,
      COALESCE(SUM(download_count), 0)::int as total_downloads
    FROM files
  `

  const totalFiles = stats[0]?.total_files ?? 0
  const totalSize = Number(stats[0]?.total_size ?? 0)
  const totalDownloads = stats[0]?.total_downloads ?? 0

  const cloudConfig = getCloudStorageConfig()
  const cloudProvider = new S3CompatibleStorageProvider()
  const cloudHealth = await cloudProvider.getHealth()
  const diskSnapshot = await getDiskPressureSnapshot(
    process.cwd(),
    cloudConfig.warningFreeBytes,
    cloudConfig.criticalFreeBytes,
  )
  const summary = await getQueueSummary()
  const activity = await getRecentActivity()
  const tray = getTraySyncSnapshot({ provider: cloudHealth, summary, disk: diskSnapshot })

  return (
    <div className="min-h-screen max-w-screen-2xl w-full mx-auto px-4 sm:px-6 pb-4 sm:pb-8">
      <DashboardHeader title="Dashboard" />
      <main className="py-6 sm:py-8">
        <StatsCards
          totalFiles={totalFiles}
          totalSize={totalSize}
          totalDownloads={totalDownloads}
        />
        <div className="mt-8 grid gap-6 xl:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <CloudStatusPanel provider={cloudHealth} disk={diskSnapshot} summary={summary} tray={tray} />
            <CloudActivityList items={activity} />
          </div>
          <CloudSettingsCard provider={cloudHealth} />
        </div>
        <div className="mt-8">
          <ProjectList
            initialProjects={projects.map((p) => ({
              id: p.id as string,
              name: p.name as string,
              slug: p.slug as string,
              description: p.description as string | null,
              deployedUrl: p.deployed_url as string | null,
              categoryId: p.category_id as string | null,
              categoryName: p.category_name as string | null,
              categoryColor: p.category_color as string | null,
              fileCount: p.file_count as number,
              totalSize: Number(p.total_size),
              createdAt: p.created_at as Date,
            }))}
            initialCategories={categories.map((c) => ({
              id: c.id as string,
              name: c.name as string,
              color: c.color as string,
              isDefault: c.is_default as boolean,
              projectCount: c.project_count as number,
              createdAt: c.created_at as Date,
            }))}
          />
        </div>
      </main>
    </div>
  )
}
