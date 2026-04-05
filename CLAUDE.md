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

1. **Create** (`/dashboard/project/create`) — User enters project name, role, job description → API proxies to n8n which generates a rubric and creates the project row in Supabase → User reviews/edits rubric → Project saved
2. **Upload & Screen** (`/dashboard/project/upload`) — User uploads ZIP of PDF/TXT resumes → `pdf-extractor.ts` converts PDFs to text client-side via pdf.js → Text ZIP sent to n8n for scoring → Original PDFs uploaded to Supabase Storage → Frontend polls candidates table every 3s until project status='complete'
3. **Results** (`/dashboard/project/results`) — Master-detail view: sortable candidate list (left) + reasoning/PDF viewer/comments (right) → Status changes and comments persist to Supabase

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
