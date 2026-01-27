# Projects Explorer

> **Self-hosted project storage and sharing platform** — Own your files, control your data, and share projects securely with direct download links.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FBunsDev%2Fprojects-explorer&env=DATABASE_URL,ADMIN_PASSWORD,BLOB_READ_WRITE_TOKEN&envDescription=Required%20environment%20variables%20for%20Projects%20Explorer&envLink=https%3A%2F%2Fgithub.com%2FBunsDev%2Fprojects-explorer%23environment-variables&project-name=projects-explorer&repository-name=projects-explorer)

## Quick Start

Want to deploy your own instance? Follow the **[Setup Guide →](https://your-domain.vercel.app/setup)** for step-by-step instructions, or use the one-click deploy button above.

**TL;DR:**
1. Create a [Neon](https://neon.tech) database → Run `scripts/setup.sql`
2. Create [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) storage → Copy token
3. Set environment variables → Deploy to Vercel

## Overview

Projects Explorer is a self-hosted file management system that lets you upload, organize, and share projects with anyone. Unlike third-party services, you own the storage infrastructure—meaning your files can't be taken away, deprecated, or rug-pulled.

### Key Features

- **🗂️ Project Organization** — Group files into projects with nested folder structures
- **🏷️ Category System** — Organize projects with customizable color-coded categories
- **📤 Multi-File Upload** — Drag-and-drop uploads with folder structure preservation
- **🔗 Public Sharing** — Generate shareable links for any file (no account required to download)
- **🔒 Admin Authentication** — Password-protected dashboard for uploads and management
- **📱 Responsive Design** — Works seamlessly on desktop and mobile devices
- **🌐 Deployed URL Tracking** — Link projects to their live deployments

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [Next.js 16](https://nextjs.org) | React framework with App Router |
| [React 19](https://react.dev) | UI library |
| [Neon](https://neon.tech) | Serverless PostgreSQL database |
| [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) | File storage |
| [Tailwind CSS 4](https://tailwindcss.com) | Styling |
| [shadcn/ui](https://ui.shadcn.com) | UI components |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Browser                          │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js App (Vercel)                       │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │   App Router  │  │ Server Actions│  │   API Routes  │       │
│  │   (pages)     │  │   (actions)   │  │   (share)     │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
└─────────────────────────────────────────────────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   Neon PostgreSQL       │     │     Vercel Blob         │
│   ┌─────────────────┐   │     │   ┌─────────────────┐   │
│   │ • projects      │   │     │   │ File Storage    │   │
│   │ • folders       │   │     │   │ (up to 10MB     │   │
│   │ • files         │   │     │   │  per file)      │   │
│   │ • categories    │   │     │   └─────────────────┘   │
│   │ • sessions      │   │     │                         │
│   │ • download_logs │   │     │                         │
│   └─────────────────┘   │     │                         │
└─────────────────────────┘     └─────────────────────────┘
```

### Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│                        Upload Flow                            │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Admin logs in with password                               │
│     └──▶ Session token stored in cookie + database           │
│                                                               │
│  2. Upload file via dashboard                                 │
│     └──▶ File validated (type, size ≤ 10MB)                  │
│         └──▶ Uploaded to Vercel Blob                         │
│             └──▶ Metadata stored in Neon (PostgreSQL)        │
│                                                               │
│  3. Share with public_id link                                 │
│     └──▶ /share/[publicId] → Direct file download            │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Prerequisites

Before deploying, ensure you have:

- [Node.js 18+](https://nodejs.org) or [Bun](https://bun.sh) installed
- A [Neon](https://neon.tech) account (free tier available)
- A [Vercel](https://vercel.com) account (free tier available)

## Environment Variables

Create a `.env.local` file in the project root (see `.env.example` for reference):

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `DATABASE_URL` | Neon PostgreSQL connection string | [Neon Console](https://console.neon.tech) → Project → Connection Details → Copy "Connection string" |
| `ADMIN_PASSWORD` | Password for admin dashboard login | Choose a strong password (min 12 characters recommended) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage token | [Vercel Dashboard](https://vercel.com) → Project → Storage → Create Blob Store → Copy token |

### Getting Your Environment Variables

#### 1. Neon Database (`DATABASE_URL`)

1. Go to [console.neon.tech](https://console.neon.tech)
2. Create a new project (or use existing)
3. Click **Connection Details** in the sidebar
4. Copy the **Connection string** (starts with `postgresql://`)

```
postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
```

> **💡 Tip:** Use the "Pooled connection" for production to handle more concurrent connections.

#### 2. Admin Password (`ADMIN_PASSWORD`)

Choose a secure password for your admin login. This is what you'll use to access the dashboard.

```bash
# Generate a secure password (macOS/Linux)
openssl rand -base64 32
```

#### 3. Vercel Blob Token (`BLOB_READ_WRITE_TOKEN`)

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project (or create one first)
3. Navigate to **Storage** tab
4. Click **Create Database** → Select **Blob**
5. Copy the `BLOB_READ_WRITE_TOKEN` from the environment variables

## Database Setup

After setting up your Neon database, run the single setup script to create all required tables:

```bash
# Option 1: Via command line
psql $DATABASE_URL -f scripts/setup.sql

# Option 2: Via Neon SQL Editor
# 1. Go to console.neon.tech
# 2. Select your project → SQL Editor
# 3. Copy/paste contents of scripts/setup.sql
# 4. Click "Run"
```

The setup script creates all tables, indexes, and triggers in one go:
- `projects`, `folders`, `files` — Core data structure
- `categories` — Color-coded organization
- `sessions`, `auth_logs`, `download_logs` — Security & analytics

### Database Schema

```
┌─────────────────┐       ┌─────────────────┐
│    projects     │       │   categories    │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │──┐    │ id (PK)         │
│ name            │  │    │ name            │
│ slug            │  │    │ color           │
│ description     │  │    │ is_default      │
│ deployed_url    │  │    └─────────────────┘
│ category_id (FK)│──┼──────────────▲
└─────────────────┘  │              │
        │            │              │
        ▼            │              │
┌─────────────────┐  │    ┌─────────────────┐
│     folders     │  │    │    sessions     │
├─────────────────┤  │    ├─────────────────┤
│ id (PK)         │  │    │ id (PK)         │
│ project_id (FK) │◀─┘    │ token           │
│ parent_id (FK)  │──┐    │ expires_at      │
│ name            │  │    └─────────────────┘
└─────────────────┘  │
        ▲            │
        │            │
        │            │
        ▼            │
┌─────────────────┐  │
│      files      │  │
├─────────────────┤  │
│ id (PK)         │  │
│ public_id       │  │
│ title           │  │
│ project_id (FK) │◀─┘
│ folder_id (FK)  │──┐
│ blob_url        │  │
│ file_size       │  │
│ mime_type       │  │
│ download_count  │  │
└─────────────────┘  │
        │            │
        ▼            │
┌─────────────────┐  │
│  download_logs  │  │
├─────────────────┤  │
│ id (PK)         │  │
│ file_id (FK)    │──┘
│ ip_address      │
│ user_agent      │
│ downloaded_at   │
└─────────────────┘
```

## Local Development

### Using npm

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Using Bun (recommended)

```bash
# Install dependencies
bun install

# Start development server
bun dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

### Development Tips

- **Hot Reload:** Next.js automatically reloads when you save files
- **Admin Login:** Go to `/login` and use your `ADMIN_PASSWORD`
- **Database GUI:** Use Neon's built-in SQL Editor or connect with any PostgreSQL client

## Deployment

### One-Click Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FBunsDev%2Fprojects-explorer&env=DATABASE_URL,ADMIN_PASSWORD,BLOB_READ_WRITE_TOKEN&envDescription=Required%20environment%20variables%20for%20Projects%20Explorer&envLink=https%3A%2F%2Fgithub.com%2FBunsDev%2Fprojects-explorer%23environment-variables&project-name=projects-explorer&repository-name=projects-explorer)

### Manual Deployment

1. **Fork or clone this repository**

```bash
git clone https://github.com/BunsDev/projects-explorer.git
cd projects-explorer
```

2. **Install Vercel CLI**

```bash
npm i -g vercel
```

3. **Deploy**

```bash
vercel
```

4. **Add environment variables**

```bash
# Add each variable
vercel env add DATABASE_URL
vercel env add ADMIN_PASSWORD
vercel env add BLOB_READ_WRITE_TOKEN
```

5. **Redeploy with environment variables**

```bash
vercel --prod
```

### Post-Deployment Checklist

- [ ] Run database migration scripts in Neon SQL Editor
- [ ] Test admin login at `your-domain.vercel.app/login`
- [ ] Upload a test file to verify Blob storage works
- [ ] Test public sharing link functionality
- [ ] (Optional) Add custom domain in Vercel settings

## Project Structure

```
projects-explorer/
├── app/                      # Next.js App Router
│   ├── dashboard/            # Admin dashboard
│   │   ├── actions.ts        # Server actions (CRUD operations)
│   │   ├── page.tsx          # Dashboard home
│   │   ├── projects/         # Project detail pages
│   │   └── upload/           # Upload page
│   ├── login/                # Authentication
│   ├── setup/                # Developer setup guide
│   ├── share/                # Public file sharing API
│   ├── globals.css           # Global styles
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Landing page
├── components/               # React components
│   ├── ui/                   # shadcn/ui components
│   ├── file-manager.tsx      # File management UI
│   ├── project-list.tsx      # Projects grid/list
│   └── ...                   # Other components
├── lib/                      # Utilities
│   ├── auth.ts               # Authentication helpers
│   ├── db.ts                 # Database connection
│   └── utils.ts              # General utilities
├── scripts/                  # Database scripts
│   └── setup.sql             # Complete database setup (run once)
├── public/                   # Static assets
└── .env.example              # Environment template
```

## Supported File Types

Projects Explorer supports a wide variety of file types:

| Category | Extensions |
|----------|------------|
| **Archives** | `.zip`, `.tar`, `.gz`, `.7z` |
| **Documents** | `.pdf`, `.doc`, `.docx`, `.txt`, `.md`, `.mdx` |
| **Images** | `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.ico`, `.heic`, `.heif` |
| **Code** | `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.vue`, `.svelte` |
| **Styles** | `.css`, `.scss`, `.sass`, `.less` |
| **Data** | `.json`, `.xml`, `.csv`, `.yaml`, `.yml`, `.toml`, `.sql` |
| **Config** | `.env`, `.gitignore`, `.npmrc`, `.nvmrc`, `.lock` |
| **Scripts** | `.sh`, `.bash`, `.zsh` |

Maximum file size: **10MB per file**

## Security

- **Password Authentication:** Simple but effective—no email/OAuth complexity
- **Session Management:** Secure tokens stored server-side with 7-day expiry
- **File Validation:** Magic byte verification for binary files prevents disguised uploads
- **HTTPS Only:** Secure cookies in production
- **No Client-Side Secrets:** All sensitive operations happen server-side

## Troubleshooting

### Common Issues

**"Database connection failed"**
- Verify your `DATABASE_URL` is correct and includes `?sslmode=require`
- Check if your Neon project is active (free tier projects pause after inactivity)

**"Upload failed"**
- Ensure `BLOB_READ_WRITE_TOKEN` is set correctly
- Check file size (must be ≤ 10MB)
- Verify file type is supported

**"Invalid password"**
- Double-check your `ADMIN_PASSWORD` environment variable
- Passwords are case-sensitive

**Build errors after deployment**
- Clear Vercel build cache: Project Settings → General → "Clear Build Cache"
- Ensure all environment variables are set for production

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/BunsDev">BunsDev</a>
</p>
