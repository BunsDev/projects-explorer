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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    categoryIdIdx: index("idx_projects_category_id").on(table.categoryId),
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
// Type Exports
// ============================================================
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
