# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-01-30

### Added
- GitHub snapshot extraction with file filtering - extract individual files from repository zips
- Configurable snapshot extraction settings (excluded patterns, allowed dotfiles, size limits)
- New constants for snapshot extraction: `SNAPSHOT_EXCLUDED_PATTERNS`, `SNAPSHOT_ALLOWED_DOTFILES`, `SNAPSHOT_MAX_FILE_SIZE`, `SNAPSHOT_MAX_TOTAL_FILES`
- GitHub file links displayed in FilePreview component for quick navigation to source
- Project description display in project detail view for better context
- Dropdown menu for GitHub save options (save as zip or extract files)

### Changed
- `saveGitHubSnapshotAction` now supports an `extractFiles` parameter to save individual files instead of zips
- Refactor external URL links (deployed URL, GitHub repo) to use Next.js Link component for improved accessibility
- Update preview URL editing UI with clearer link handling

## [0.1.0] - 2026-01-30

### Added
- **GitHub Integration**: Connect and sync GitHub repositories
  - Parse GitHub URLs in multiple formats (full URL, shorthand owner/repo)
  - Fetch repository metadata, tree structure, and file contents
  - Download repositories as zip archives
  - Rate limit monitoring for GitHub API
- **Shiki Syntax Highlighting**: CodeBlock component for rendering highlighted code snippets
  - Language detection based on file extension
  - Theme support with dark mode integration
- **Folder Management**
  - Move folders to new destinations with drag-and-drop support
  - Prevent invalid moves (into subfolders or themselves)
  - Folder creation from selected files
- **File Management**
  - Move files and bulk move selected files to target folders
  - Dynamic folder and file counts based on current context
  - Navigate folders in FileGrid view
- **Share Settings**
  - Global and project-level share settings management
  - Password protection options
  - Download limits configuration
  - Secure link regeneration (re-uploads files, invalidates both share and blob URLs)
  - Standard link regeneration for quick URL refresh
- **UI Components**
  - GitHubRepoConnect component for repository connection
  - GitHubFileTree for browsing repository contents
  - Settings modal in dashboard header and bottom navigation
  - Collapsible share settings in project list
- **Stats Cards**: Dynamic statistics display with responsive layout
- **Dashboard Bottom Navigation**: Mobile-friendly navigation component
- **Breadcrumb Navigation**: Path-based navigation with improved styling

### Changed
- Centralized file type definitions and constants in `lib/constants.ts`
- Enhanced folder icon behavior with selection state feedback
- Improved button styles and color variables for visual consistency
- Hydration fixes for dialog components (deferred rendering)

### Fixed
- Server/client mismatch issues with deferred Tab rendering
- Hydration warnings on button components
- Dialog component hydration issues across multiple components

[Unreleased]: https://github.com/BunsDev/projects-explorer/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/BunsDev/projects-explorer/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/BunsDev/projects-explorer/releases/tag/v0.1.0
