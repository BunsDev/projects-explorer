/** Category colors: bg + text chosen for WCAG AA contrast on light backgrounds (dark text on tinted bg). */
export const CATEGORY_COLORS = [
  { name: "blue", bg: "bg-blue-400/50 hover:bg-blue-400/70", text: "text-blue-900", border: "border-blue-200/20 hover:border-blue-200/40" },
  { name: "green", bg: "bg-green-400/50 hover:bg-green-400/70", text: "text-green-900", border: "border-green-200/20 hover:border-green-200/40" },
  { name: "purple", bg: "bg-purple-400/50 hover:bg-purple-400/70", text: "text-purple-900", border: "border-purple-200/20 hover:border-purple-200/40" },
  { name: "orange", bg: "bg-orange-400/50 hover:bg-orange-400/70", text: "text-orange-900", border: "border-orange-200/20 hover:border-orange-200/40" },
  { name: "red", bg: "bg-red-400/50 hover:bg-red-400/70", text: "text-red-900", border: "border-red-200/20 hover:border-red-200/40" },
  { name: "yellow", bg: "bg-amber-400/50 hover:bg-amber-400/70", text: "text-amber-900", border: "border-amber-200/20 hover:border-amber-200/40" },
  { name: "pink", bg: "bg-pink-400/50 hover:bg-pink-400/70", text: "text-pink-900", border: "border-pink-200/20 hover:border-pink-200/40" },
  { name: "gray", bg: "bg-gray-400/50 hover:bg-gray-400/70", text: "text-gray-900", border: "border-gray-200/20 hover:border-gray-200/40" },
] as const

export type CategoryColor = (typeof CATEGORY_COLORS)[number]

/* FILES */
export const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

export const UPLOAD_SUPPORTED_EXTENSIONS = [
  ".zip", ".tar", ".gz", ".7z",
  ".pdf", ".doc", ".docx", ".txt", ".md", ".mdx", ".license",
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".heif", ".heic", ".webp", ".ico",
  ".json", ".xml", ".csv", ".yaml", ".yml", ".toml", ".sql",
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  ".css", ".scss", ".sass", ".less",
  ".html", ".htm", ".vue", ".svelte",
  ".lock", ".env", ".gitignore", ".npmrc", ".nvmrc",
  ".sh", ".bash", ".zsh",
  ".sol", ".example", ".txt", ".excalidraw"
]

// Filenames without extension that are allowed (e.g. Makefile)
export const ALLOWED_FILENAMES_NO_EXT = ["Makefile", "makefile", "GNUmakefile"]

// Allowed dotfiles with their predefined titles
export const ALLOWED_DOTFILES: Record<string, string> = {
  ".env.example": "envExample",
  ".gitignore": "gitignore",
}

// File type definitions with magic bytes for binary validation
// Text-based files don't need magic bytes - we trust the extension
export const FILE_TYPES: Record<string, { mimeType: string; magicBytes?: number[][] }> = {
  // Archives (with magic bytes validation)
  zip: { mimeType: "application/zip", magicBytes: [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06], [0x50, 0x4b, 0x07, 0x08]] },
  tar: { mimeType: "application/x-tar" },
  gz: { mimeType: "application/gzip", magicBytes: [[0x1f, 0x8b]] },
  "7z": { mimeType: "application/x-7z-compressed", magicBytes: [[0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]] },

  // Documents
  pdf: { mimeType: "application/pdf", magicBytes: [[0x25, 0x50, 0x44, 0x46]] },
  doc: { mimeType: "application/msword" },
  docx: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  txt: { mimeType: "text/plain" },
  md: { mimeType: "text/markdown" },
  mdx: { mimeType: "text/mdx" },
  license: { mimeType: "text/plain" },

  // Images (with magic bytes validation for binary formats)
  png: { mimeType: "image/png", magicBytes: [[0x89, 0x50, 0x4e, 0x47]] },
  jpg: { mimeType: "image/jpeg", magicBytes: [[0xff, 0xd8, 0xff]] },
  jpeg: { mimeType: "image/jpeg", magicBytes: [[0xff, 0xd8, 0xff]] },
  gif: { mimeType: "image/gif", magicBytes: [[0x47, 0x49, 0x46, 0x38]] },
  svg: { mimeType: "image/svg+xml" },
  heif: { mimeType: "image/heif" },
  heic: { mimeType: "image/heic" },
  webp: { mimeType: "image/webp", magicBytes: [[0x52, 0x49, 0x46, 0x46]] },
  ico: { mimeType: "image/x-icon" },

  // Data files
  json: { mimeType: "application/json" },
  xml: { mimeType: "text/xml" },
  csv: { mimeType: "text/csv" },
  yaml: { mimeType: "text/yaml" },
  yml: { mimeType: "text/yaml" },
  toml: { mimeType: "text/toml" },
  sql: { mimeType: "application/sql" },

  // JavaScript/TypeScript
  js: { mimeType: "text/javascript" },
  jsx: { mimeType: "text/javascript" },
  ts: { mimeType: "text/typescript" },
  tsx: { mimeType: "text/typescript" },
  mjs: { mimeType: "text/javascript" },
  cjs: { mimeType: "text/javascript" },

  // Styles
  css: { mimeType: "text/css" },
  scss: { mimeType: "text/scss" },
  sass: { mimeType: "text/sass" },
  less: { mimeType: "text/less" },

  // Other code
  html: { mimeType: "text/html" },
  htm: { mimeType: "text/html" },
  vue: { mimeType: "text/vue" },
  svelte: { mimeType: "text/svelte" },

  // Config files
  lock: { mimeType: "text/plain" },
  env: { mimeType: "text/plain" },
  gitignore: { mimeType: "text/plain" },
  npmrc: { mimeType: "text/plain" },
  nvmrc: { mimeType: "text/plain" },

  // Shell scripts
  sh: { mimeType: "text/x-shellscript" },
  bash: { mimeType: "text/x-shellscript" },
  zsh: { mimeType: "text/x-shellscript" },

  // Makefiles (filename with no extension: Makefile, makefile, GNUmakefile)
  makefile: { mimeType: "text/x-makefile" },
  gnumakefile: { mimeType: "text/x-makefile" },
  // Makefile fragments with extension
  mk: { mimeType: "text/x-makefile" },
  mak: { mimeType: "text/x-makefile" },
}

/* GITHUB SNAPSHOT EXTRACTION */

// Patterns to exclude when extracting GitHub snapshots
// Matches against the full path (e.g., "src/node_modules/foo" matches "node_modules")
export const SNAPSHOT_EXCLUDED_PATTERNS = [
  // Dependencies
  "node_modules/",
  "vendor/",
  ".pnpm/",
  
  // Build outputs
  "dist/",
  "build/",
  ".next/",
  "out/",
  ".nuxt/",
  ".output/",
  ".vercel/",
  ".netlify/",
  
  // Cache directories
  ".cache/",
  ".turbo/",
  ".parcel-cache/",
  
  // IDE/Editor directories
  ".idea/",
  ".vscode/",
  
  // OS files
  ".DS_Store",
  "Thumbs.db",
  
  // Lock files (optional - can be large)
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
]

// Allowed dotfiles that should NOT be excluded
export const SNAPSHOT_ALLOWED_DOTFILES = [
  ".env.example",
  ".gitignore",
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.json",
  ".prettierrc",
  ".prettierrc.js",
  ".prettierrc.json",
  ".editorconfig",
  ".npmrc",
  ".nvmrc",
]

// Max file size for individual files during extraction (10MB)
export const SNAPSHOT_MAX_FILE_SIZE = 10 * 1024 * 1024

// Max total files to extract (safety limit)
export const SNAPSHOT_MAX_TOTAL_FILES = 500

// Concurrent upload limit for Vercel Blob
export const SNAPSHOT_UPLOAD_CONCURRENCY = 5