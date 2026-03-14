import type { CloudProviderHealth, CloudQueueSummary, DiskPressureSnapshot, TraySyncSnapshot } from "@/lib/cloud/types"

export function getTraySyncSnapshot(input: {
  provider: CloudProviderHealth
  summary: CloudQueueSummary
  disk: DiskPressureSnapshot
}): TraySyncSnapshot {
  const activeCount = input.summary.queued + input.summary.running + input.summary.retrying
  const paused = input.summary.paused > 0
  const providerReady = input.provider.configured
  const label = paused
    ? `Sync paused • ${activeCount} queued`
    : activeCount > 0
      ? `Sync active • ${activeCount} job${activeCount === 1 ? "" : "s"}`
      : input.disk.pressureLevel === "critical"
        ? "Disk pressure critical"
        : providerReady
          ? "Cloud idle"
          : "Cloud setup needed"

  return {
    label,
    activeCount,
    paused,
    pressureLevel: input.disk.pressureLevel,
    providerReady,
    quickActions: [
      "open-app",
      paused ? "resume-sync" : "pause-sync",
      "run-worker",
    ],
  }
}
