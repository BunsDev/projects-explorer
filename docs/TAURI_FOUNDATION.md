# Tauri desktop / tray foundation

This repo does not currently include a `src-tauri/` shell. Phase 2 intentionally ships a docs-first foundation instead of pretending a native shell exists.

## Recommended bootstrap

1. Add Tauri v2 with a `src-tauri/` directory.
2. Register tray/menu actions:
   - Open Projects Explorer
   - Trigger sync worker
   - Show queue summary
3. Point the desktop cache at `CLOUD_CACHE_DIR` or an app-specific path under the user data dir.
4. Move the in-process worker loop to a Tauri-managed background task.
5. Expose safe commands only: queue upload, queue restore, run worker, queue eviction.

## TODO markers for Phase 3

- [ ] Create `src-tauri/Cargo.toml` and `tauri.conf.json`
- [ ] Bridge tray/menu actions to the durable queue API
- [ ] Add OS-native notifications for failures and long-running sync jobs
- [ ] Swap cache path defaults to app-specific directories on macOS/Windows/Linux
