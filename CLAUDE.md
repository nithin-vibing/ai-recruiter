# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Recruiter is a SaaS app for AI-powered resume screening. Users create a project with a job description, get an AI-generated rubric, upload resumes as a ZIP, and review scored/ranked candidates. Built for recruiters and hiring managers.

## Commands

```bash
npm run dev      # Start Next.js dev server (http://localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
```

No test framework is configured.

## Architecture

**Stack:** Next.js 16 (App Router) + Supabase (Postgres, Auth, Storage) + n8n (AI workflows) + Tailwind v4 + shadcn/ui

### Three-Step Wizard Flow

1. **Create** (`/dashboard/project/create`) — User enters project name, role, job description → API proxies to n8n which generates a rubric and creates the project row in Supabase → Animated Labor Illusion progress steps shown during generation → User reviews/edits rubric → Project saved. Demo mode available via `?demo=1` query param (pre-fills with a sample Frontend Engineer JD).
2. **Upload & Screen** (`/dashboard/project/upload`) — User uploads **individual PDF files** (multi-select) or a **ZIP archive** of PDF/TXT resumes via a toggle in the upload card → `pdf-extractor.ts` converts PDFs to text client-side via pdf.js → Text ZIP sent to n8n for scoring → Original PDFs uploaded to Supabase Storage → Frontend polls candidates table every 3s until project status='complete' → Failed PDFs (corrupt or image-only) are reported via a toast warning listing filenames.
3. **Results** (`/dashboard/project/results`) — Master-detail view: sortable candidate list (left) + reasoning/PDF viewer/comments (right) → Status changes and comments persist to Supabase. Power-user features: **keyboard navigation** (J/K to move, S/H/R/P to set status, ? for cheat sheet), **side-by-side comparison** (select 2 candidates via checkboxes → full criteria comparison panel), **PDF evidence highlighting** (AI-cited quotes highlighted inline in extracted resume text).

### Data Flow

```
Browser → Next.js API Routes (/api/*) → n8n webhooks (AI scoring)
Browser → Supabase SDK (auth, CRUD, storage, realtime)
```

API routes at `app/api/generate-rubric/route.ts` and `app/api/screen-resume/route.ts` are thin proxies to n8n webhooks to avoid CORS. The n8n instance is at `ainkv.app.n8n.cloud`.

### State Management

- **AuthContext** (`lib/auth-context.tsx`) — Wraps dashboard, provides `user` from Supabase Auth. Subscribes to `onAuthStateChange`.
- **ProjectContext** (`lib/project-context.tsx`) — Multi-step wizard state (project details, rubric, candidates, screening progress). Persists `currentProjectId` to sessionStorage for page reloads.

### Auth Flow

Supabase Auth with Google OAuth + email/password. Middleware at `middleware.ts` protects `/dashboard/*` routes and redirects. OAuth callback at `/auth/callback`. `lib/supabase/middleware.ts` handles server-side session refresh.

### Database Tables (Supabase)

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `projects` | `id`, `user_id`, `project_name`, `role_name`, `status` (draft/screening/complete) | Created by n8n, claimed by frontend via `claimProject()` |
| `rubrics` | `project_id`, `criterion`, `description`, `max_score`, `weight`, `sort_order` | |
| `candidates` | `project_id`, `candidate_name`, `score`, `status` (pending/shortlisted/hold/rejected), `reasoning`, `user_comment`, `source_filename` | Written by n8n during screening |
| `usage` | `user_id`, `month` (YYYY-MM), `projects_created`, `resumes_screened` | Free tier tracking |

Storage bucket `resumes` stores original PDFs at `{projectId}/{filename}`.

### Free Tier Limits

Defined in `lib/api-client.ts` as `FREE_TIER_LIMITS`: 3 projects/month, 100 resumes/month. Enforced client-side before API calls. Usage auto-creates a row per user per month.

### Project Ownership Model

n8n creates projects with `user_id=null` (uses anon key). Frontend calls `claimProject(projectId, userId)` after rubric generation to set ownership. All dashboard queries filter by `user_id`.

### Key Files

| File | What Changed |
|------|-------------|
| `lib/pdf-extractor.ts` | `extractTextFromPdf` is now exported (used by results evidence highlighting). Added `convertPdfFilesToTextZip(files: File[], onProgress?)` for multi-file PDF upload — returns the same `{ textZip, fileCount, originalFiles, failedFiles }` shape as the ZIP variant. |
| `lib/api-client.ts` | `startScreening(projectId, input: File \| File[], onProgress?, onExtractionComplete?)` — accepts a ZIP `File` or an array of PDF `File[]`. `onExtractionComplete(failedFiles: string[])` is called when any files fail extraction. |
| `components/screens/upload-resumes.tsx` | `UploadMode = 'pdfs' \| 'zip'` toggle in the card header. PDF mode supports multi-file selection with deduplication and a scrollable file list (up to 8 shown). |
| `components/screens/create-project-form.tsx` | Accepts `initialValues` prop. `RubricGenerationProgress` component cycles through 4 animated steps during AI generation (Labor Illusion). |
| `app/dashboard/project/create/page.tsx` | Wrapped in Suspense (required by `useSearchParams`). `?demo=1` enables demo mode with a pre-filled sample JD. |
| `app/dashboard/page.tsx` | First-time empty state (dashed border panel with "Start screening" + "Try with sample JD" CTAs) shown when `stats.projects === 0`. |
| `app/login/page.tsx` | Testimonial block (5-star, quote, avatar) below the stats grid. |
| `components/screens/results-table.tsx` | Keyboard shortcuts, side-by-side comparison mode, PDF evidence text highlighting with `<mark>` tags, High Confidence badge. |

## Key Conventions

- **Path alias:** `@/*` maps to project root (e.g., `@/lib/utils`, `@/components/ui/button`)
- **shadcn/ui:** New York style, RSC-compatible. Add components via `npx shadcn@latest add <component>`
- **Fonts:** "Outfit" (display/headings via `font-display` class) + "DM Sans" (body via `font-sans` class)
- **Colors:** Electric blue (`--electric-blue: #1B6FEE`) is the primary accent. CSS variables defined in `app/globals.css`
- **Snake/camel mapping:** Supabase uses `snake_case` columns; frontend maps to `camelCase` in `fetchCandidates()`. Keep this consistent.
- **TypeScript:** Strict mode. Build has `ignoreBuildErrors: true` in next.config as a temporary workaround.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL     # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY # Supabase anonymous/public key
```

n8n webhook URLs are hardcoded in the API route files (not env vars).
