# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev     # dev server (http://localhost:3000)
npm run build   # production build
npm run lint    # eslint (flat config, eslint-config-next)
```

There is no test suite. Requires `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (the last is server-only, used by `createAdminClient`).

Next.js is 16.x with React 19: `searchParams` is a `Promise` and must be awaited; `cookies()` is async. See the note in AGENTS.md about reading `node_modules/next/dist/docs/` first (e.g. `middleware.ts` is the old name of what the docs call `proxy`).

## What this is

"Care Companion": a Thai-language platform connecting **Customers** (elderly / people who can't travel alone) with **Companions** who accompany them on errands (hospital appointments, bank, government offices, shopping), managed by **Admins**. It is a university Assignment + Midterm: the student plays System Analyst, UX/UI designer and full-stack dev, and the app must be **deployed on Vercel and really usable**. Mandated stack: Next.js + Tailwind, Google login via Supabase Auth, Supabase PostgreSQL, Supabase Storage, Vercel.

**Hard business boundary: companions are NOT medical staff or caregivers.** Every request/registration/admin page carries a disclaimer to that effect; never add features or copy implying medical care.

`Context.md` is the source of truth for requirements, business rules (§5), security model (§6) and DB schema (§7); it also has a requirement-vs-implementation table (§2.2) — update it when a requirement is finished. `.cursorrules` / `gemini.md` set conventions.

**Business rules to preserve when editing:** Customers create requests, Companions only accept/progress them (Companions must not create requests); public pages (`/`, `/companions`) work without login and must not expose phone numbers; status changes follow `accepted → in_progress → completed` only. `/profile` (all roles) edits name/phone/avatar (uploaded to Storage bucket `companion-files` under `<user_id>/`) and, for companions, the companion fields + `is_available`; it never touches `role`.

## Conventions (from `.cursorrules`, `gemini.md`)

- All user-facing text is Thai; code comments are Thai and are required on every function, component, DB mutation and major logic block. Keep code simple and "student-level" (the author must explain it to an instructor) — no heavy abstractions.
- Server Components by default; `"use client"` only when state/effects/`useFormStatus` are needed. Mutations are Server Actions in a colocated `actions.ts`.
- Styling: Tailwind v4, teal/stone palette, large readable text (elderly users). Icons: `lucide-react`.
- Do not invent DB columns. **`Context.md` §4.3 is the schema of record** for `service_requests`: `task_type, origin, destination, appointment_date, duration_hours, notes, status` (`review.md` mentions `service_type/title/location` — that is stale).

## Architecture

**Auth & session (Supabase, Google OAuth only).**
- `middleware.ts` → `utils/supabase/middleware.ts#updateSession` refreshes the session cookie on every non-static request.
- `utils/supabase/server.ts` exports two clients: `createClient()` (anon key + user cookies, subject to RLS — use everywhere by default) and `createAdminClient()` (service-role, **bypasses RLS**, no cookies). Only `app/admin/actions.ts` and `app/become-companion/actions.ts` (setting `role: "companion"` after verifying the caller is a `customer`) use the admin client; keep it that way and always verify the caller's role first. `utils/supabase/client.ts` is the browser client.
- `app/auth/callback/route.ts` exchanges the OAuth code, then `ensureProfileExists` upserts the `public.profiles` row (role `customer`). It also guards against open redirects on `next`.

**Roles** live in `profiles.role` (`customer | companion | admin`), not in JWT metadata. Each page/action re-reads it from the DB and redirects on mismatch (there is no route-level guard beyond that). Role transitions: customer → companion via `/become-companion` (upserts `companion_profiles`, then updates role); admin changes any role via `/admin` (`updateUserRole`, which also seeds a default `companion_profiles` row). Companions are blocked from creating requests (`app/requests/new/actions.ts`).

**Request lifecycle** (`service_requests.status`): `pending → accepted → in_progress → completed`, or `cancelled`. Transitions are enforced in `app/my-requests/actions.ts`, not in the DB:
- `acceptServiceRequest`: must be `pending`, not own request, no time overlap with the companion's `accepted/in_progress` jobs; the update is conditional on `.eq("status","pending")` to avoid double-accept races.
- `updateRequestStatus`: only the assigned companion may go to `in_progress`/`completed`; customer or assigned companion may `cancelled` only from `pending/accepted`; update is conditional on the previous status. The "Reject" button for direct requests just cancels the whole request.
- A request with `companion_id` set at creation (from `/companions` → `/requests/new?companion_id=`) is a "direct request"; otherwise it is open to any companion.

**Action ↔ page feedback pattern.** Server Actions validate, then `redirect()` back with `?error=<code>` or `?success=<code>`; the page maps codes to Thai messages via `getErrorMessage`/`getSuccessMessage`. When adding a new error code, add the message in the page as well. Actions call `revalidatePath("/", "layout")` so the Navbar (which reads the role) refreshes.

**Pages:** `/` (role-aware landing), `/companions` (searchable list of `is_available` companions), `/requests/new`, `/my-requests` (tabs for companions: open / my-jobs / created-by-me; single list for customers), `/become-companion`, `/admin` (stats + role management + all requests). `components/SubmitButton.tsx` is the shared pending-state submit button (`useFormStatus`).

**Database is not in the repo.** Tables, RLS policies and the `companion-files` storage bucket live only in Supabase; there are no migrations. RLS is enabled on all tables, so a "silent" failed insert/update is usually a missing policy — `review.md` contains suggested policy SQL (written before some fixes; several bugs it lists have since been fixed in code).
