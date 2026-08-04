# NWD Central Hub — Architecture Overview

This document covers the technical architecture of the NWD Central Hub: how authentication works, how roles are enforced, how the application is structured, and how the core proposal-to-project lifecycle is designed. It is written for contributors who are familiar with Next.js and Supabase but are new to this codebase.

Read this document after `docs/onboarding.md` and before writing any code that touches auth, routing, or the database.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Auth & Database | Supabase (PostgreSQL + Auth) |
| Email | Resend |
| Hosting | Vercel |
| Package Manager | npm (Node 20) |

---

## High-Level Structure

```
nwd-central-hub-prototype/
├── app/                  # Next.js App Router — pages and layouts
│   ├── admin/            # Admin dashboard
│   ├── login/            # Role-specific login and authenticated pages
│   │   ├── admin/        # Admin-only pages (user management)
│   │   ├── client/       # Client dashboard
│   │   └── contractor/   # Contractor dashboard
│   ├── proposals/        # Proposal listing and creation (client-facing)
│   ├── change-password/  # Forced password change on first login
│   ├── unauthorized/     # Role mismatch landing page
│   └── layout.tsx        # Root layout — wraps entire app in AuthProvider
├── components/
│   ├── AuthProvider.tsx  # Global client-side auth context
│   ├── RouteGuard.tsx    # Client-side role enforcement for page components
│   ├── Navbar.tsx        # Shared page header — logo, breadcrumbs, UserMenu (used on all pages)
│   ├── UserMenu.tsx      # Header user dropdown — name, Profile/Settings/Logout
│   └── BackButton.tsx    # Shared back navigation component
├── lib/
│   ├── supabase.ts       # Browser Supabase client (anon key)
│   └── supabase-admin.ts # Server-side Supabase client (service role key)
├── types/
│   └── auth.ts           # UserRole and UserProfile types
├── docs/                 # Project documentation
└── proxy.ts              # Next.js middleware — server-side auth gate
```

---

## Authentication Architecture

The platform uses **two layers of auth enforcement** that work together. Understanding both is essential before touching any routing or auth logic.

### Layer 1 — Server-Side Middleware (`proxy.ts`)

`proxy.ts` is the Next.js middleware file. It runs **at the edge on every request**, before any React component renders. It is the first line of defense.

On every non-public request it:
1. Reads the Supabase session from the request cookies using `createServerClient`
2. If no session exists → redirects to `/login`
3. If a session exists and the route requires a specific role → fetches the user's `role` from `profiles` and redirects to `/unauthorized` if it doesn't match
4. If an authenticated user hits `/login` → redirects them to their role-specific dashboard

**Route classifications in middleware:**

| Type | Routes | Behavior |
|---|---|---|
| Public | `/`, `/login`, `/unauthorized`, `/test-supabase` | Always accessible |
| Authenticated (any role) | `/proposals/*` | Requires session, no role check |
| Role-restricted | `/admin/*`, `/login/admin/*` | Requires `admin` role |
| Role-restricted | `/client/*`, `/login/client/*` | Requires `client` role |
| Role-restricted | `/contractor/*`, `/login/contractor/*` | Requires `contractor` role |

```typescript
// proxy.ts — role route definitions
const ROLE_ROUTES: { prefix: string; role: UserRole }[] = [
  { prefix: '/admin', role: 'admin' },
  { prefix: '/client', role: 'client' },
  { prefix: '/contractor', role: 'contractor' },
  { prefix: '/login/admin', role: 'admin' },
  { prefix: '/login/client', role: 'client' },
  { prefix: '/login/contractor', role: 'contractor' },
]
```

> **Note:** `proxy.ts` uses the anon key, not the service role key. It can only read data that RLS policies allow for authenticated users.

### Layer 2 — Client-Side Auth Context (`AuthProvider.tsx` + `RouteGuard.tsx`)

After the middleware passes a request, the React layer provides a second layer of enforcement for component-level access control.

**`AuthProvider.tsx`** wraps the entire application via `layout.tsx`. On mount it:
1. Calls `supabase.auth.getUser()` to get the current session
2. If a user exists, fetches their profile from the `profiles` table: `id`, `role`, `is_temporary_password`
3. Subscribes to `onAuthStateChange` so the context stays in sync with session changes (login, logout, token refresh)
4. Exposes `{ profile, loading }` via React context to all child components

```typescript
// AuthProvider fetches only these fields from profiles
supabase.from('profiles').select('id, role, is_temporary_password')
```

**`RouteGuard.tsx`** is a component wrapper used on individual pages. It reads from `AuthProvider` context and enforces three checks in order:

1. If `loading` → show spinner (prevents flash of unauthorized content)
2. If no `profile` → redirect to `/login`
3. If `profile.is_temporary_password` is true → redirect to `/change-password`
4. If `profile.role` is not in `allowedRoles` → redirect to `/unauthorized`

```typescript
// Usage — wrap any page component that requires role enforcement
export default function AdminPage() {
  return (
    <RouteGuard allowedRoles={['admin']}>
      <AdminContent />
    </RouteGuard>
  )
}
```

### Why Two Layers?

| Layer | Runs where | Enforces |
|---|---|---|
| `proxy.ts` (middleware) | Edge / server | Route-level access before any rendering |
| `RouteGuard` (client) | Browser | Component-level access, temp password redirect |

The middleware prevents unauthorized users from ever receiving page HTML. The `RouteGuard` handles cases the middleware cannot — specifically the `is_temporary_password` redirect, which requires a profile field the middleware does not check.

---

## The Full Authentication Flow

The sequence below describes what happens from the moment a user hits the app to the moment they see their dashboard.

```
User hits any URL
       │
       ▼
proxy.ts (middleware)
  ├── Public route? → pass through
  ├── No session? → redirect /login
  ├── Has session + role route? → check profiles.role
  │     ├── Role matches? → pass through
  │     └── Role mismatch? → redirect /unauthorized
  └── Has session + hits /login? → redirect to role dashboard
       │
       ▼
React renders — layout.tsx
  └── AuthProvider mounts
        ├── Calls supabase.auth.getUser()
        ├── Fetches profiles row (id, role, is_temporary_password)
        └── Provides { profile, loading } to context
              │
              ▼
        RouteGuard (on protected pages)
          ├── loading? → show spinner
          ├── no profile? → redirect /login
          ├── is_temporary_password? → redirect /change-password
          └── role not allowed? → redirect /unauthorized
                │
                ▼
          Page content renders
```

---

## The Two Supabase Clients

The codebase uses two separate Supabase clients for different contexts. Using the wrong one is a common mistake.

### `lib/supabase.ts` — Browser Client

```typescript
import { createBrowserClient } from '@supabase/ssr'
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

- Uses the **anon key**
- Runs in the **browser**
- Subject to **Row-Level Security (RLS)** policies
- Used in: `AuthProvider`, page components, client-side data fetching
- Cannot perform admin operations

### `lib/supabase-admin.ts` — Server Client

```typescript
import { createClient } from '@supabase/supabase-js'
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

- Uses the **service role key**
- Runs **server-side only** (Server Actions, API routes)
- **Bypasses RLS entirely**
- Used in: `actions.ts` (user creation), any server action that needs elevated access
- Never import this in a client component — the service role key must never reach the browser

---

## Role System

Roles are stored in the `profiles` table and enforced at both the middleware and component layers. There are three roles.

| Role | Dashboard route | Real-world person |
|---|---|---|
| `admin` | `/login/admin` | NWD staff, senior developers |
| `client` | `/login/client` | External organizations |
| `contractor` | `/login/contractor` | NWD graduate students |

Roles are assigned by an admin at user creation and cannot be changed by the user. An admin can update roles directly in the Supabase dashboard or via a future admin UI.

### TypeScript Types (`types/auth.ts`)

```typescript
export type UserRole = 'admin' | 'contractor' | 'client'

export type UserProfile = {
  id: string
  email: string
  role: UserRole
  is_temporary_password?: boolean
}
```

> **Known gap:** The `profiles` table includes a `name` column (set during user creation in `actions.ts`) but `UserProfile` does not include `name`. This will cause TypeScript friction when workspace and messaging features start displaying user names. Add `name?: string` to `UserProfile` before implementing those features.

---

## Admin User Creation Flow

Admins are the only users who can create accounts. There is no self-registration. The flow is:

```
Admin fills out Create User form
  (name, email, role)
       │
       ▼
Server Action: createUser() in actions.ts
  ├── Generate cryptographically random 15-char temporary password
  ├── supabaseAdmin.auth.admin.createUser()
  │     (creates auth.users row, email_confirm: true)
  └── supabaseAdmin.from('profiles').insert()
        (creates profiles row with is_temporary_password: true)
        │
        ├── Success → Resend sends onboarding email with login link + temp password
        │             Admin UI displays temp password for manual sharing fallback
        │
        └── Failure → supabaseAdmin.auth.admin.deleteUser()
                      (rolls back auth user to prevent orphaned records)
```

On first login, `RouteGuard` detects `is_temporary_password: true` and forces a redirect to `/change-password`. After the password is updated, the `is_temporary_password` flag is set to `false` and normal routing resumes.

---

## OAuth Sign-In & Account Linking (Issue #84)

Google, GitHub, and LinkedIn (`linkedin_oidc`) are configured as OAuth providers directly in the Supabase Dashboard (**Authentication → Providers**) — the app never handles provider client IDs/secrets itself.

### Shared callback route

Both sign-in and account linking route through one Route Handler, **`app/auth/callback/route.ts`**. It exchanges the `code` query param for a session via `exchangeCodeForSession` (PKCE flow) and redirects to a `next` param (same-origin relative paths only, to prevent open redirects) — defaulting to `/`, which lets `proxy.ts` handle the role-based dashboard redirect. `proxy.ts` allowlists `/auth/callback` in `PUBLIC_ROUTES`; without that, middleware would bounce the callback to `/login` before the code exchange runs.

- **Sign-in** (`app/login/page.tsx`) calls `supabase.auth.signInWithOAuth({ provider })`.
- **Linking** (`app/settings/page.tsx`) calls `supabase.auth.linkIdentity({ provider })` while already authenticated, and `supabase.auth.unlinkIdentity(identity)` to remove one — guarded so a user can't unlink their last remaining identity. This requires **manual linking** enabled in Supabase Auth settings, or both calls return a 422.

### Automatic linking by verified email

This is not a Supabase dashboard toggle — it's built-in GoTrue behavior. If a user signs in via OAuth with an email that matches an existing account whose `auth.users.email_confirmed_at` is already set, the new identity is merged into that existing account automatically instead of creating a second, orphaned user. Admin-created accounts already qualify for this: `createUser()` in `app/login/admin/users/create/actions.ts` passes `email_confirm: true`, which stamps `email_confirmed_at` at creation — no separate confirmation-email flow is needed.

**Testing caveat:** this only works for accounts with a real, deliverable email address. The shared dev seed accounts (`admin@email.com`, `client@email.com`, `contractor@email.com`) are fabricated addresses with no real Google/GitHub/LinkedIn account behind them, so OAuth sign-in/linking can never be verified against them — that's inherent to how OAuth works, not a config gap. To exercise this flow, sign in or link with your own real account against a throwaway test profile rather than the shared seed accounts. Password login against the shared seed accounts is unaffected.

### Rejecting orphaned sign-ins

Auto-linking depends on the provider returning a *verified* email that exactly matches an existing account. In practice this is unreliable for GitHub (accounts with "Keep my email addresses private" enabled don't expose a matchable email) and can also fail for LinkedIn if its email isn't marked verified. When that happens, `signInWithOAuth` doesn't fail — it succeeds and creates a **second, unrelated `auth.users` row** with no `profiles` row behind it, since only admin-created accounts get one.

`app/auth/callback/route.ts` checks for this after every code exchange: it looks up `profiles` by the resulting user id, and if none exists, it signs that session out, best-effort deletes the orphaned `auth.users` row via `supabaseAdmin.auth.admin.deleteUser()`, and redirects to `/login` with an explanatory error ("No account found for this email — sign in with your password first, then link this provider from Settings.") instead of letting the request fall through to `/unauthorized`. This check only runs for sign-in — a linking attempt from `/settings` always reuses the already-authenticated user's id, which is guaranteed to already have a `profiles` row.

### Production configuration dependency

`exchangeCodeForSession` and any Supabase-generated auth email (confirmation, magic link, password reset) redirect using Supabase's own **Site URL** and **Redirect URLs allow-list** (Authentication → URL Configuration), not `NEXT_PUBLIC_APP_URL` — that env var only controls links the app builds itself (e.g. the Resend onboarding email in `lib/email/sendWelcomeEmail.ts`). Site URL defaulted to `localhost` until 2026-07, which meant the production OAuth callback and any Supabase auth email would silently redirect to a dev URL. Now set to `https://portal.nextwavedev.org` with the production domain also added to the Redirect URLs allow-list. Separately, Supabase Authentication → SMTP Settings had no custom SMTP configured, so Supabase-generated auth emails were going through Supabase's own rate-limited built-in sender rather than Resend — now configured with Resend as custom SMTP. Full history in `docs/outside_work.md`.

---

## Proposal-to-Project Lifecycle

This is the core workflow the platform is built around. The current implementation is partially complete — the proposal submission and the admin approval exist as separate surfaces that are not yet fully connected end-to-end.

### Current State (as of this writing)

```
Client submits proposal
  └── Currently writes to localStorage (proposals/new/page.tsx)
      NOT to Supabase — this is a known gap being addressed in #51

Admin reviews proposals
  └── Reads from supabase.from('proposals') with status = 'pending'
      This surface is connected to Supabase correctly

Admin approves proposal
  └── Updates proposals.status to 'approved'
      Inserts a row into projects with { proposal_id }
      The projects table is currently a stub (proposal_id only)
```

### Known Gaps (active sprint work)

| Gap | Issue |
|---|---|
| Client proposal submission writes to localStorage instead of Supabase | #51 |
| Proposal status values in code (`pending`) don't match intended values (`submitted`) | #21 |
| `projects` table is a stub — no title, description, client_id, or contractor linkage | #54 |
| No contractor assignment at approval time | #54 |
| No project workspace page | #55 |
| No contractor request-to-join flow | #40 |
| No in-project messaging | #56 |

### Intended Flow (MVP target)

```
Client creates and submits proposal → status: submitted
         │
         ▼
Admin reviews pending proposals
  ├── Reject → status: rejected
  └── Approve → status: approved
                 │
                 ▼
              projects row created
              (title, description, client_id, contractor_id from approval)
                 │
                 ▼
              Contractor sees approved proposal
              Contractor requests access (#40)
                 │
                 ▼
              Admin approves contractor request
              contractor linked to project
                 │
                 ▼
              All three roles access /projects/[id] workspace
              In-project messaging available (#56)
```

---

## Row-Level Security (RLS)

Supabase RLS policies ensure users can only read and write data they are authorized to access. The browser client (`lib/supabase.ts`) is always subject to these policies.

RLS was implemented as part of issue #46 (closed). The specific policies applied to each table are documented in `docs/database-schema.md`.

**Key principle:** Never disable RLS on a table to fix a query bug. If a query fails due to RLS, the correct fix is either to adjust the policy or to use `supabaseAdmin` in a server action — not to expose data to all users.

---

## What Does Not Exist Yet

For contributors picking up new issues, the following parts of the intended architecture are not yet built. Do not assume they exist.

| Feature | Status | Issue |
|---|---|---|
| `/projects/[id]` dynamic workspace route | Not started | #55 |
| Active Projects views on role dashboards | Not started | #52 |
| `project_messages` table and chat UI | Not started | #56 |
| `proposal_requests` table and contractor join flow | Not started | #40 |
| Proposals folder restructured under auth flow | Not started | #51 |
| Admin proposal review page (dedicated) | Not started | #54 |

---

## Notes for Contributors

- Always confirm which Supabase client to use before writing a query. If the operation needs to run server-side or bypass RLS, use `supabaseAdmin` in a Server Action. If it runs in a component, use `supabase`.
- When adding new protected routes, update **both** `proxy.ts` (the `ROLE_ROUTES` or `AUTHENTICATED_PREFIXES` arrays) **and** wrap the page component with `RouteGuard`. One layer without the other is incomplete protection.
- The `is_temporary_password` flag is the mechanism behind the forced password change flow. Any operation that resets or creates a password should set this flag correctly in `profiles`.
- The `projects` table schema will evolve significantly as #54 and #55 land. Do not build features that depend on the current stub schema — coordinate with the team before writing migrations.

---

*Last updated: 2026-07-23*