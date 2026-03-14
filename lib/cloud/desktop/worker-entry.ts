import { getCloudWorkerRuntime } from "@/lib/cloud/runtime"

const runtime = getCloudWorkerRuntime()
runtime.start()
console.log(`[cloud-worker] started ${runtime.snapshot().runnerId}`)
