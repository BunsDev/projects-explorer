import { Archive, Download, HardDrive } from "lucide-react"

interface StatsCardsProps {
  totalFiles: number
  totalSize: number
  totalDownloads: number
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function StatsCards({ totalFiles, totalSize, totalDownloads }: StatsCardsProps) {
  const stats = [
    {
      label: "Total Files",
      value: totalFiles.toString(),
      icon: Archive,
    },
    {
      label: "Storage Used",
      value: formatBytes(totalSize),
      icon: HardDrive,
    },
    {
      label: "Total Downloads",
      value: totalDownloads.toString(),
      icon: Download,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-3 mb-8">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="glass rounded-2xl p-6 hover-lift transition-smooth"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-muted-foreground">
              {stat.label}
            </span>
            <div className="rounded-xl stat-icon-bg p-2.5">
              <stat.icon className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
        </div>
      ))}
    </div>
  )
}
