# Phase 3 notes

## What shipped

### Queue hardening
- Added admin actions for **pause / resume / cancel / retry** from dashboard server actions.
- Added queue event history stored in `metadataJson.history` for each job.
- Added richer job telemetry:
  - last progress messages
  - last run duration (`lastRunMs`)
  - recent activity history in the dashboard
  - paused/cancelled counts in queue summary

### Transfer engine
- Added **multipart upload** for large S3-compatible uploads via `@aws-sdk/lib-storage`.
- Small objects still use normal `PutObject`.
- Upload worker now:
  - computes checksum up front
  - skips upload when remote checksum already matches
  - verifies uploaded object checksum with a `head()` pass
- Download worker now verifies the downloaded file checksum against cloud metadata.
- Retry scheduling now uses capped exponential backoff with jitter and only retries likely transient failures.

### Cloud auth UX
- Settings screen now runs a real **connection + bucket + write/delete probe**.
- Failure messages are clearer when required env vars are missing.
- Dashboard still keeps secrets server-side only.

### Desktop / menubar prep
- Repo still has **no `src-tauri/` shell**.
- Added `lib/cloud/tray-state.ts` to expose a shared tray/menubar snapshot:
  - status label
  - paused/active state
  - pressure level
  - quick actions contract
- Dashboard now renders this snapshot so native tray wiring can consume the same state model later.

### Eviction / cache controls
- Worker now attempts **auto-eviction under critical disk pressure**.
- Project actions now support **Protect cache** / **Remove protection** by toggling `pinned` state on cache entries.
- Safe eviction still only targets non-pinned resident cache entries.

## Runbook

### Validate cloud setup
1. Open dashboard.
2. In **Cloud provider settings**, click **Test connection & verify bucket**.
3. Expect a message confirming:
   - endpoint reachable
   - bucket reachable
   - write/delete probe succeeded

### Queue operations
From project detail page, use:
- **Queue cloud upload**
- **Queue restore**
- **Run worker now**
- **Pause sync**
- **Resume sync**
- **Cancel queued**
- **Retry failed**

### Cache controls
From project detail page:
- **Protect cache** → marks current cache entries as pinned
- **Remove protection** → clears project-level pin state
- **Safe cache eviction** → queues eviction only for safe candidates

### Auto-evict behavior
- Worker checks disk pressure before processing normal jobs.
- When pressure is `critical`, it tries to evict cold, non-pinned resident cache entries.
- If the configured cache dir does not exist yet, disk checks fall back to `process.cwd()`.

## Limitations
- Multipart uploads are **large-file capable**, but not yet truly resumable across process restarts.
- No native tray yet; current tray state is a shared TS contract plus dashboard rendering.
- Pin/protect currently works at the **project cache-entry level**, not per individual file in the UI.
- Auto-eviction executes before queue processing, but does not yet persist a dedicated auto-evict job row for auditability.
- Queue history is stored in job metadata rather than a separate normalized run-history table.

## Suggested Phase 4 backlog
1. Add a real `src-tauri/` shell and wire tray actions to queue commands.
2. Persist multipart upload state for true cross-restart resume.
3. Move queue event history into a dedicated `cloud_sync_job_runs` / `cloud_sync_job_events` table.
4. Add per-file pinning and cache residency inspection in project/file UI.
5. Add background worker scheduling instead of manual “Run worker now”.
6. Add checksum-aware restore preview and partial/chunked download resume.
7. Add queue filters/search and project/global activity drill-down views.
