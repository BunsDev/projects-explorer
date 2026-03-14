import { statfs } from "node:fs/promises"
import type { DiskPressureSnapshot } from "@/lib/cloud/types"

export async function getDiskPressureSnapshot(targetPath: string, warningFreeBytes: number, criticalFreeBytes: number): Promise<DiskPressureSnapshot> {
  const stats = await statfs(targetPath)
  const freeBytes = stats.bavail * stats.bsize
  const totalBytes = stats.blocks * stats.bsize
  const usedBytes = totalBytes - freeBytes
  const freeRatio = totalBytes > 0 ? freeBytes / totalBytes : 0

  let pressureLevel: DiskPressureSnapshot["pressureLevel"] = "healthy"
  if (freeBytes <= criticalFreeBytes) {
    pressureLevel = "critical"
  } else if (freeBytes <= warningFreeBytes) {
    pressureLevel = "warning"
  }

  const targetFreeBytes = pressureLevel === "critical"
    ? warningFreeBytes
    : pressureLevel === "warning"
      ? Math.max(warningFreeBytes, Math.round(totalBytes * 0.15))
      : warningFreeBytes

  return {
    freeBytes,
    totalBytes,
    usedBytes,
    freeRatio,
    pressureLevel,
    suggestedEvictionBytes: Math.max(targetFreeBytes - freeBytes, 0),
  }
}

export function rankEvictionCandidates<T extends { lastAccessedAt: Date; pinned?: boolean; sizeBytes: number }>(
  items: T[],
  bytesNeeded: number,
): T[] {
  let accumulated = 0
  const sorted = [...items]
    .filter((item) => !item.pinned)
    .sort((a, b) => a.lastAccessedAt.getTime() - b.lastAccessedAt.getTime())

  const selected: T[] = []
  for (const item of sorted) {
    selected.push(item)
    accumulated += item.sizeBytes
    if (accumulated >= bytesNeeded) break
  }

  return selected
}
