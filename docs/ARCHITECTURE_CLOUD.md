# Cloud Storage MVP Architecture

## Goals

Build toward a desktop-first projects explorer that can:

1. upload and sync folders/projects from a local machine
2. keep a searchable local index without requiring every file to stay on disk
3. reduce disk pressure by evicting cold cache entries while preserving cloud-backed recoverability
4. evolve into a Tauri desktop app with tray / menubar status controls

## Recommended MVP shape

### 1) Local index + local cache

Use two separate concepts:

- **Local index**: durable metadata for every tracked object
  - project id
  - logical path
  - remote object key
  - sha256 checksum
  - size
  - mime type
  - last synced at
  - last accessed at
  - cache state (`resident`, `partial`, `evicted`, `dirty`)
- **Local cache**: actual bytes stored on disk for recently used files and active uploads/downloads

Why separate them:

- search/browse stays fast even if bytes are evicted
- disk pressure logic can safely remove bytes without losing metadata
- sync reconciliation only needs checksums + timestamps, not all content resident locally

Suggested local paths for desktop mode:

- `~/Library/Application Support/projects-explorer/index.db`
- `~/Library/Application Support/projects-explorer/cache/`
- `~/Library/Application Support/projects-explorer/queue/`

## 2) Cloud object storage abstraction

Start with **S3-compatible storage** behind a provider interface.

Why this is the right first step:

- works with AWS S3, Cloudflare R2, Backblaze B2 S3, MinIO, Wasabi, DigitalOcean Spaces
- avoids hard-coding to Vercel Blob for desktop sync flows
- gives a straightforward migration path to multipart upload later

Provider contract should support:

- `head(key)`
- `put({ key, body, checksumSha256, metadata })`
- `get(key)`
- `delete(key)`
- `list(prefix)`
- `getHealth()`

Object key convention:

- `{prefix}/{projectId}/{logicalPath}`
- include metadata for checksum, original filename, project id, uploader version

## 3) Metadata store choice and sync model

### Metadata store

For MVP:

- keep the existing Postgres app database for shared/project metadata already used by the web app
- add a **desktop-local metadata database** later for per-device sync queue + cache state
- for now, document `CLOUD_METADATA_DATABASE_URL` so the shared metadata layer can move to a dedicated DB if needed

Recommended evolution:

- **Server/shared metadata**: Postgres (canonical project + file records)
- **Desktop/device metadata**: SQLite in the Tauri app for queue state, cache residency, local scans, and offline work

### Sync model

Use a **queued, checksum-first, eventually consistent** model:

1. local scan discovers files/folders
2. compute sha256 checksum
3. enqueue upload/download task
4. compare with remote object metadata and shared metadata row
5. if checksums match, mark synced without transfer
6. if local is dirty or remote missing, perform transfer
7. update queue status + timestamps

Conflict policy for MVP:

- prefer **explicit conflict records** over automatic overwrite
- if the same logical path changes in two places, mark as conflict and require resolution UI in phase 2

## 4) Eviction strategy for low disk

The desktop cache should be disposable.

### Rules

Never evict:

- files marked pinned/offline
- items currently uploading/downloading
- dirty local changes not yet uploaded

Evict first:

- cold cached files with oldest `last_accessed_at`
- largest old files when critical pressure persists
- generated previews before canonical source files

### Pressure thresholds

Suggested defaults:

- **healthy**: > 15 GB free
- **warning**: <= 15 GB free
- **critical**: <= 5 GB free

### Behavior

- warning: propose eviction amount and show UI warning
- critical: auto-select eviction candidates from cache only
- after eviction: keep metadata/index entries so restore is instant from UX perspective

## 5) Desktop / tray path

This repo does not currently contain Tauri. So the correct MVP move is:

- build cloud/storage abstractions now in shared TypeScript
- expose status in the existing dashboard
- plan Tauri as the next shell that uses the same sync primitives

Tray / menubar targets for phase 2:

- show current sync state
- quick action: upload folder
- quick action: restore recent file/project
- quick action: pause/resume sync
- warning badge when disk pressure is critical

## Current scaffold added in this pass

- cloud provider interface
- initial S3-compatible provider
- sync queue skeleton with checksum support and task status tracking
- disk pressure helper + eviction candidate ranking
- dashboard cloud status panel
- project-level placeholder actions for upload/restore flows

## Config model

Environment variables live in `.env.example` and are intentionally provider-agnostic except for the initial S3-compatible driver.

Core variables:

- `CLOUD_S3_ENDPOINT`
- `CLOUD_S3_REGION`
- `CLOUD_S3_BUCKET`
- `CLOUD_S3_ACCESS_KEY_ID`
- `CLOUD_S3_SECRET_ACCESS_KEY`
- `CLOUD_S3_SESSION_TOKEN`
- `CLOUD_S3_FORCE_PATH_STYLE`
- `CLOUD_STORAGE_PREFIX`
- `CLOUD_METADATA_DATABASE_URL`
- `CLOUD_CACHE_DIR`
- `CLOUD_CACHE_MAX_BYTES`
- `CLOUD_WARNING_FREE_BYTES`
- `CLOUD_CRITICAL_FREE_BYTES`

## Phase 2 implementation targets

1. add real upload/download execution worker with persisted queue storage
2. add multipart upload support for large folders and resumable transfers
3. store cache/index state in device-local SQLite
4. wire native file picker + tray controls through Tauri
5. add auth UX for cloud providers and credential validation
6. implement actual eviction execution, not just recommendation
7. add remote metadata reconciliation and conflict resolution UI
