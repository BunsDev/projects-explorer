import {
  pgTable,
  uuid,
  varchar,
  text,
  bigint,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

// ============================================================
// Share Settings Table (Global - single row)
// ============================================================
export const shareSettings = pgTable("share_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  sharingEnabled: boolean("sharing_enabled").notNull().default(true),
  passwordRequired: boolean("password_required").notNull().default(false),
  defaultExpiryDays: integer("default_expiry_days"), // null = no default expiry
  downloadLimitPerIp: integer("download_limit_per_ip"), // null = no limit
  downloadLimitWindowMinutes: integer("download_limit_window_minutes").default(60),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

// ============================================================
// Categories Table
// ============================================================
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    color: varchar("color", { length: 20 }).notNull().default("gray"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  }
)

export const categoriesRelations = relations(categories, ({ many }) => ({
  projects: many(projects),
}))

// ============================================================
// Projects Table
// ============================================================
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    description: text("description"),
    deployedUrl: text("deployed_url"),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    // Source type: "uploaded" for file uploads, "github" for GitHub repos
    sourceType: varchar("source_type", { length: 20 }).notNull().default("uploaded"),
    // GitHub repository fields (only used when sourceType = "github")
    githubOwner: varchar("github_owner", { length: 255 }),
    githubRepo: varchar("github_repo", { length: 255 }),
    githubBranch: varchar("github_branch", { length: 255 }).default("main"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    // Share settings overrides (null = use global default)
    shareEnabled: boolean("share_enabled"), // null = inherit from global
    sharePasswordRequired: boolean("share_password_required"), // null = inherit from global
    shareExpiryDays: integer("share_expiry_days"), // null = inherit from global
    shareDownloadLimitPerIp: integer("share_download_limit_per_ip"), // null = inherit from global
    shareDownloadLimitWindowMinutes: integer("share_download_limit_window_minutes"), // null = inherit from global
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    categoryIdIdx: index("idx_projects_category_id").on(table.categoryId),
    sourceTypeIdx: index("idx_projects_source_type").on(table.sourceType),
  })
)

export const projectsRelations = relations(projects, ({ one, many }) => ({
  category: one(categories, {
    fields: [projects.categoryId],
    references: [categories.id],
  }),
  folders: many(folders),
  files: many(files),
}))

// ============================================================
// Folders Table
// ============================================================
export const folders = pgTable(
  "folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    name: varchar("name", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    projectIdIdx: index("idx_folders_project_id").on(table.projectId),
    parentIdIdx: index("idx_folders_parent_id").on(table.parentId),
  })
)

export const foldersRelations = relations(folders, ({ one, many }) => ({
  project: one(projects, {
    fields: [folders.projectId],
    references: [projects.id],
  }),
  parent: one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
    relationName: "parentFolder",
  }),
  children: many(folders, { relationName: "parentFolder" }),
  files: many(files),
}))

// ============================================================
// Files Table
// ============================================================
export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicId: varchar("public_id", { length: 21 }).notNull().unique(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    originalFilename: varchar("original_filename", { length: 255 }).notNull(),
    blobUrl: varchar("blob_url", { length: 1024 }).notNull(),
    fileSize: bigint("file_size", { mode: "number" }).notNull(),
    mimeType: varchar("mime_type", { length: 255 }).default("application/zip"),
    downloadCount: integer("download_count").default(0),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    folderId: uuid("folder_id").references(() => folders.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    sharePasswordHash: varchar("share_password_hash", { length: 128 }),
    sharePasswordSalt: varchar("share_password_salt", { length: 64 }),
    // Share settings overrides (null = inherit from project/global)
    shareEnabled: boolean("share_enabled"), // null = inherit; false = disable sharing for this file
    downloadLimitPerIp: integer("download_limit_per_ip"), // null = inherit from project/global
    downloadLimitWindowMinutes: integer("download_limit_window_minutes"), // null = inherit from project/global
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    publicIdIdx: index("idx_files_public_id").on(table.publicId),
    createdAtIdx: index("idx_files_created_at").on(table.createdAt),
    projectIdIdx: index("idx_files_project_id").on(table.projectId),
    folderIdIdx: index("idx_files_folder_id").on(table.folderId),
  })
)

export const filesRelations = relations(files, ({ one, many }) => ({
  project: one(projects, {
    fields: [files.projectId],
    references: [projects.id],
  }),
  folder: one(folders, {
    fields: [files.folderId],
    references: [folders.id],
  }),
  downloadLogs: many(downloadLogs),
}))

// ============================================================
// Sessions Table
// ============================================================
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: varchar("token", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    tokenIdx: index("idx_sessions_token").on(table.token),
    expiresAtIdx: index("idx_sessions_expires_at").on(table.expiresAt),
  })
)

// ============================================================
// Download Logs Table
// ============================================================
export const downloadLogs = pgTable(
  "download_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    downloadedAt: timestamp("downloaded_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    fileIdIdx: index("idx_download_logs_file_id").on(table.fileId),
    downloadedAtIdx: index("idx_download_logs_downloaded_at").on(table.downloadedAt),
    ipAddressIdx: index("idx_download_logs_ip_address").on(table.ipAddress),
    fileIpTimeIdx: index("idx_download_logs_file_ip_time").on(
      table.fileId,
      table.ipAddress,
      table.downloadedAt
    ),
  })
)

export const downloadLogsRelations = relations(downloadLogs, ({ one }) => ({
  file: one(files, {
    fields: [downloadLogs.fileId],
    references: [files.id],
  }),
}))

// ============================================================
// Auth Logs Table
// ============================================================
export const authLogs = pgTable(
  "auth_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ipAddress: varchar("ip_address", { length: 45 }).notNull(),
    userAgent: text("user_agent"),
    success: boolean("success").notNull(),
    failureReason: varchar("failure_reason", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    ipCreatedIdx: index("idx_auth_logs_ip_created").on(table.ipAddress, table.createdAt),
    createdAtIdx: index("idx_auth_logs_created_at").on(table.createdAt),
  })
)

// ============================================================
// Audit Logs Table (for tracking destructive operations)
// ============================================================
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    action: varchar("action", { length: 50 }).notNull(), // e.g., "delete_project", "delete_file"
    resourceType: varchar("resource_type", { length: 50 }).notNull(), // e.g., "project", "file", "folder"
    resourceId: varchar("resource_id", { length: 100 }), // ID of the affected resource
    resourceName: varchar("resource_name", { length: 255 }), // Name for human readability
    details: text("details"), // Additional JSON details if needed
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    actionIdx: index("idx_audit_logs_action").on(table.action),
    resourceTypeIdx: index("idx_audit_logs_resource_type").on(table.resourceType),
    createdAtIdx: index("idx_audit_logs_created_at").on(table.createdAt),
  })
)

// ============================================================
// Cloud Sync Queue Tables
// ============================================================
export const cloudSyncJobs = pgTable(
  "cloud_sync_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
    type: varchar("type", { length: 32 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("queued"),
    localPath: text("local_path"),
    remoteKey: text("remote_key").notNull(),
    sourceUrl: text("source_url"),
    checksumSha256: varchar("checksum_sha256", { length: 64 }),
    bytesTotal: bigint("bytes_total", { mode: "number" }),
    bytesTransferred: bigint("bytes_transferred", { mode: "number" }).notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    lastStartedAt: timestamp("last_started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    metadataJson: text("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    statusNextRetryIdx: index("idx_cloud_sync_jobs_status_next_retry").on(table.status, table.nextRetryAt),
    projectIdIdx: index("idx_cloud_sync_jobs_project_id").on(table.projectId),
    fileIdIdx: index("idx_cloud_sync_jobs_file_id").on(table.fileId),
    createdAtIdx: index("idx_cloud_sync_jobs_created_at").on(table.createdAt),
  })
)

export const cloudCacheEntries = pgTable(
  "cloud_cache_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
    localPath: text("local_path").notNull(),
    remoteKey: text("remote_key").notNull(),
    cacheState: varchar("cache_state", { length: 24 }).notNull().default("resident"),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull().default(0),
    checksumSha256: varchar("checksum_sha256", { length: 64 }),
    pinned: boolean("pinned").notNull().default(false),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }).defaultNow(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    fileIdIdx: index("idx_cloud_cache_entries_file_id").on(table.fileId),
    projectIdIdx: index("idx_cloud_cache_entries_project_id").on(table.projectId),
    cacheStateIdx: index("idx_cloud_cache_entries_cache_state").on(table.cacheState),
    lastAccessedIdx: index("idx_cloud_cache_entries_last_accessed_at").on(table.lastAccessedAt),
  })
)

export const cloudSyncJobsRelations = relations(cloudSyncJobs, ({ one }) => ({
  project: one(projects, {
    fields: [cloudSyncJobs.projectId],
    references: [projects.id],
  }),
  file: one(files, {
    fields: [cloudSyncJobs.fileId],
    references: [files.id],
  }),
}))

export const cloudCacheEntriesRelations = relations(cloudCacheEntries, ({ one }) => ({
  project: one(projects, {
    fields: [cloudCacheEntries.projectId],
    references: [projects.id],
  }),
  file: one(files, {
    fields: [cloudCacheEntries.fileId],
    references: [files.id],
  }),
}))


// ============================================================
// Type Exports
// ============================================================
export type ShareSetting = typeof shareSettings.$inferSelect
export type NewShareSetting = typeof shareSettings.$inferInsert

export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert

export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert

export type Folder = typeof folders.$inferSelect
export type NewFolder = typeof folders.$inferInsert

export type File = typeof files.$inferSelect
export type NewFile = typeof files.$inferInsert

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

export type DownloadLog = typeof downloadLogs.$inferSelect
export type NewDownloadLog = typeof downloadLogs.$inferInsert

export type AuthLog = typeof authLogs.$inferSelect
export type NewAuthLog = typeof authLogs.$inferInsert

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert

export type CloudSyncJob = typeof cloudSyncJobs.$inferSelect
export type NewCloudSyncJob = typeof cloudSyncJobs.$inferInsert

export type CloudCacheEntry = typeof cloudCacheEntries.$inferSelect
export type NewCloudCacheEntry = typeof cloudCacheEntries.$inferInsert
