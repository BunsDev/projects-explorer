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
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 mb-6 sm:mb-8">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="group relative overflow-hidden rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm p-4 sm:p-5 transition-[box-shadow,border-color] duration-200 hover:border-border/60 hover:shadow-sm min-w-0"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-semibold tabular-nums tracking-tight text-foreground truncate">
                {stat.value}
              </p>
            </div>
            <div className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/30">
              <stat.icon className="size-3.5 sm:size-4 text-muted-foreground" strokeWidth={1.5} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
