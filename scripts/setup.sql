-- ============================================================
-- Projects Explorer - Complete Database Setup
-- ============================================================
-- This script creates all tables and indexes required for
-- Projects Explorer. Run this once when setting up a new
-- deployment.
--
-- Usage:
--   Option 1: psql $DATABASE_URL -f scripts/setup.sql
--   Option 2: Copy/paste into Neon SQL Editor
--
-- ============================================================

-- ============================================================
-- PART 1: Core Tables
-- ============================================================

-- Files table: stores metadata for uploaded files
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id VARCHAR(21) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  original_filename VARCHAR(255) NOT NULL,
  blob_url VARCHAR(1024) NOT NULL,
  file_size BIGINT NOT NULL,
  download_count INTEGER DEFAULT 0,
  mime_type VARCHAR(255) DEFAULT 'application/zip',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Download logs table: tracks anonymous downloads
CREATE TABLE IF NOT EXISTS download_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions table: stores admin session tokens
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- PART 2: Projects & Folders
-- ============================================================

-- Projects table: top-level organization
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  deployed_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Folders table: nested folder structure within projects
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add project/folder references to files table
ALTER TABLE files ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE files ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

-- ============================================================
-- PART 3: Categories
-- ============================================================

-- Categories table: color-coded project organization
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  color VARCHAR(20) NOT NULL DEFAULT 'gray',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add category reference to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- Function to ensure only one default category exists
CREATE OR REPLACE FUNCTION ensure_single_default_category()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    UPDATE categories SET is_default = FALSE WHERE id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for single default category
DROP TRIGGER IF EXISTS single_default_category_trigger ON categories;
CREATE TRIGGER single_default_category_trigger
  AFTER INSERT OR UPDATE OF is_default ON categories
  FOR EACH ROW
  WHEN (NEW.is_default = TRUE)
  EXECUTE FUNCTION ensure_single_default_category();

-- ============================================================
-- PART 4: Auth Logs (Security Auditing)
-- ============================================================

-- Auth logs table: tracks all login attempts
CREATE TABLE IF NOT EXISTS auth_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  failure_reason VARCHAR(50), -- 'invalid_password', 'rate_limited', 'ip_blocked', 'missing_password', 'bypass_invalid'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- PART 5: Audit Logs (Destructive Operation Tracking)
-- ============================================================

-- Audit logs table: tracks destructive operations for compliance/forensics
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(50) NOT NULL,           -- 'delete', etc.
  resource_type VARCHAR(50) NOT NULL,    -- 'project', 'file', 'folder', 'category'
  resource_id VARCHAR(100),              -- ID of the affected resource
  resource_name VARCHAR(255),            -- Human-readable name
  details TEXT,                          -- Additional JSON details
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- PART 6: Indexes for Performance
-- ============================================================

-- Files indexes
CREATE INDEX IF NOT EXISTS idx_files_public_id ON files(public_id);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id);
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);

-- Folders indexes
CREATE INDEX IF NOT EXISTS idx_folders_project_id ON folders(project_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_category_id ON projects(category_id);

-- Download logs indexes
CREATE INDEX IF NOT EXISTS idx_download_logs_file_id ON download_logs(file_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_downloaded_at ON download_logs(downloaded_at DESC);

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Auth logs indexes
CREATE INDEX IF NOT EXISTS idx_auth_logs_ip_created ON auth_logs(ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON auth_logs(created_at DESC);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================
-- Setup Complete!
-- ============================================================
-- Your database is now ready. Next steps:
-- 1. Set your environment variables (DATABASE_URL, ADMIN_PASSWORD, BLOB_READ_WRITE_TOKEN)
-- 2. Deploy to Vercel or run locally with `bun dev`
-- 3. Login at /login with your ADMIN_PASSWORD
-- ============================================================
