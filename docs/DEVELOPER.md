# NWD Central Hub — Developer Reference

This document is for contributors who are already set up and oriented. It covers user and role management, the deployed database schema, active development state, and what is coming next. Read `docs/onboarding.md` first, then `docs/architecture.md`, then this document.

---

## 1. Managing Users

There is no self-registration. All accounts are created by an admin.

### Creating a user via the admin UI

1. Log in as an admin
2. Navigate to `/login/admin/users`
3. Use the inline "Create User" form on that page (there is no separate `/create` route as of PR #66 — it's a form on the same table view)
4. Fill in name, email, and role, then submit — the server action (`create/actions.ts`) generates a 15-character temporary password, creates the `auth.users` row, inserts the `profiles` row atomically, and sends an onboarding email via Resend
5. The temporary password is displayed on screen immediately as a fallback if email does not arrive

The user will be forced to change their password on first login. `RouteGuard` detects `is_temporary_password: true` in the `profiles` row and redirects to `/change-password` before allowing access to any protected page.

### Creating a user directly in Supabase

Use the Supabase dashboard only for test accounts or recovery situations. Go to **Authentication → Users → Add User**. After creating the auth user you must also manually insert a row into the `profiles` table with the correct `id`, `email`, `name`, `role`, and `is_temporary_password` values. Skipping the profiles insert produces a NULL row and the user will not be able to log in correctly.

### Changing a role

**Option A — Table Editor:**
1. Supabase dashboard → Table Editor → `profiles`
2. Find the row by email
3. Update the `role` column and save

**Option B — SQL:**
```sql
UPDATE profiles
SET role = 'admin'  -- or 'client' / 'contractor'
WHERE id = 'USER_UUID';
```

Available roles: `admin`, `client`, `contractor`. Role controls dashboard routing and RLS policy access. See `docs/architecture.md` for the full routing table.

---

## 2. Database Schema

The deployed schema, updated through PR #79 (Core Project Workspace). `docs/database-schema.md` is the detailed reference including RLS policies and relationship diagrams. This section is the quick-reference version.

### `profiles`

Extends `auth.users`. Created atomically by the `createUser` server action.

```sql
id                      uuid         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
email                   text
name                    text
role                    text         CHECK (role IN ('admin', 'client', 'contractor'))
is_temporary_password   boolean
created_at              timestamp    DEFAULT now()
email_notifications     boolean      NOT NULL DEFAULT true
pronouns                text                                          -- #98
company                 text                                          -- #98
region                  text                                          -- #98
mini_profile_visibility jsonb        NOT NULL DEFAULT '{...}'::jsonb   -- #98, which fields show on the (unbuilt) mini profile card
```

Additive columns (`email_notifications`, and the `#98` block) each have a dedicated "… Migration" section in `docs/database-schema.md`. None need a grant/RLS change — `profiles` has a table-level `UPDATE` grant to `authenticated` and the `Users can update own profile` policy covers all columns of the own row.

### `proposals`

Project proposals submitted by clients. Status transitions are enforced in `lib/proposals.ts`.

```sql
id            uuid       PRIMARY KEY DEFAULT gen_random_uuid()
client_id     uuid       NOT NULL REFERENCES profiles(id)
title         text
description   text
budget        text
status        text       CHECK (status IN ('draft', 'submitted', 'approved', 'rejected'))
created_at    timestamptz DEFAULT now()
```

Status lifecycle: `draft` → `submitted` → `approved` | `rejected`. Approved and rejected are terminal. The `draft` status exists in the type system but is not currently written by any UI flow -- all client submissions go directly to `submitted`.

### `projects`

Created automatically when an admin approves a proposal via `approveProposal()` in `app/login/admin/proposals/actions.ts`.

```sql
id                  uuid       PRIMARY KEY DEFAULT gen_random_uuid()
proposal_id         uuid       NOT NULL REFERENCES proposals(id)
client_id           uuid       NOT NULL REFERENCES profiles(id)
title               text
description         text
budget              text
status              text       DEFAULT 'active'
github_project_url  text
created_at          timestamptz DEFAULT now()
```

Contractor linkage is handled via `contractor_projects` (see below). The shared workspace page lives at `/login/projects/[id]` (shipped in #55); `github_project_url` is optional and shows a "View Project Board" link when set.

### `proposal_requests`

Contractor self-service request-to-join flow, shipped in #40. Admin approval (`/login/admin/requests`) sets `status: 'approved'` and inserts the matching `contractor_projects` row.

```sql
id              uuid       PRIMARY KEY DEFAULT gen_random_uuid()
contractor_id   uuid       NOT NULL REFERENCES profiles(id)
project_id      uuid       NOT NULL REFERENCES projects(id)
status          text
created_at      timestamptz DEFAULT now()
```

Note: references `project_id`, not `proposal_id`. A project row is created at approval time, and contractors only see approved proposals, so a `project_id` always exists by the time a request is made. The contractor dashboard (#40) must join through `projects` to get proposal details for display.

### `contractor_projects`

Join table linking approved contractors to projects.

```sql
id              uuid       PRIMARY KEY DEFAULT gen_random_uuid()
contractor_id   uuid       NOT NULL REFERENCES profiles(id)
project_id      uuid       NOT NULL REFERENCES projects(id)
assigned_at     timestamptz
```

### `project_messages`

In-project messaging (#56). One thread per project, shared by the client, assigned contractor(s), and admin. RLS policies mirror the `is_project_client`/`is_project_contractor`/`get_my_role()` pattern below. Posting also notifies every other project member through `notifications` (below), added by #57. See `docs/database-schema.md` for the full migration and RLS table.

```sql
id          uuid        PRIMARY KEY DEFAULT gen_random_uuid()
project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE
sender_id   uuid        NOT NULL REFERENCES profiles(id)
content     text        NOT NULL
created_at  timestamptz DEFAULT now()
```

### `direct_messages`

Admin-to-user messaging (#57), with replies and a required title. An admin starts a conversation with a single client or contractor; the recipient replies from the shared `/notifications` page. Threading is flat -- a reply's `thread_id` always points at the conversation's root message, never at another reply. **Pure append-only content now** -- no `read_at` column; all read/pin/delete state lives on `notifications` instead (see below). See `docs/database-schema.md` for the full migration, RLS policies, and rationale.

```sql
id            uuid        PRIMARY KEY DEFAULT gen_random_uuid()
recipient_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
sender_id     uuid        NOT NULL REFERENCES profiles(id)
thread_id     uuid        REFERENCES direct_messages(id) ON DELETE CASCADE
title         text        NOT NULL DEFAULT 'Message'
content       text        NOT NULL
created_at    timestamptz NOT NULL DEFAULT now()
```

### `notifications`

The unified in-app feed (#57 follow-up) -- every DM, announcement, and system event (proposal/request/project-lifecycle, project-thread replies) lands here as one row per recipient. Categorized (`direct_message`/`announcement`/`system`), with `pinned_at`/`read_at` for the pin and read/unread controls on `/notifications`, and `link` for the "View" action on system-category rows. **Written exclusively by `SECURITY DEFINER` trigger functions** -- there is no `authenticated` INSERT grant, so client code can never forge a notification. Surfaced site-wide as an unread-count badge via `components/NotificationBell.tsx` in the Navbar.

```sql
id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid()
recipient_id       uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
sender_id          uuid        REFERENCES profiles(id)
category           text        NOT NULL CHECK (category IN ('direct_message', 'announcement', 'system'))
title              text        NOT NULL
body               text        NOT NULL
link               text
direct_message_id  uuid        REFERENCES direct_messages(id) ON DELETE CASCADE
thread_root_id     uuid
announcement_id    uuid        REFERENCES announcements(id) ON DELETE CASCADE
pinned_at          timestamptz
read_at            timestamptz
created_at         timestamptz NOT NULL DEFAULT now()
```

### `announcements`

Admin-authored, role-targeted broadcasts (#57 follow-up), composed on `/login/admin/announcements`. Not repliable. `target_roles` is any subset of `{admin, client, contractor}`; a trigger fans a copy out to `notifications` for every matching profile. Read receipts are exposed to admins via the `get_announcement_read_receipts()` RPC rather than broadening `notifications`' RLS.

```sql
id            uuid        PRIMARY KEY DEFAULT gen_random_uuid()
sender_id     uuid        NOT NULL REFERENCES profiles(id)
title         text        NOT NULL
body          text        NOT NULL
target_roles  text[]      NOT NULL
created_at    timestamptz NOT NULL DEFAULT now()
```

**Which table triggers which notification** -- see the "System-event triggers" table in `docs/database-schema.md` for the full proposal/request/project-lifecycle list; the short version is admins are notified on proposal submission and access requests, clients/contractors are notified on approvals/rejections/assignments, and every project member (except the actor) is notified on new project-thread messages and new contractors joining.

---

## 3. Proposal and Project Helpers (`lib/proposals.ts`)

These helpers are the source of truth for proposal status logic. Use them in any component that reads or displays proposal state -- do not hardcode status strings.

| Export | Purpose |
|---|---|
| `PROPOSAL_STATUSES` | Const map: `{ Draft, Submitted, Approved, Rejected }` |
| `ProposalStatus` | Union type derived from `PROPOSAL_STATUSES` |
| `Proposal` | Base proposal type: `id`, `title`, `description?`, `budget?`, `status`, `createdAt?` |
| `canAdminReviewProposal(proposal)` | `true` only if status is `submitted` -- gates Approve/Reject buttons |
| `canContractorViewProposal(proposal)` | `true` only if status is `approved` -- gates contractor browse view |
| `isFinalProposalStatus(status)` | `true` for `approved` or `rejected` |
| `getProposalStatusLabel(status)` | Capitalizes first letter for display |
| `getProposalStatusClass(status)` | Returns Tailwind badge classes per status |

---

## 4. TypeScript Types (`types/auth.ts`)

```typescript
export type UserRole = 'admin' | 'contractor' | 'client'

export type UserProfile = {
  id: string
  email: string
  name?: string
  role: UserRole
  is_temporary_password?: boolean
  created_at?: string
}
```

---

## 5. Supabase Clients

Two clients. Using the wrong one is a common mistake.

| Client | File | Key | Runs where | RLS |
|---|---|---|---|---|
| Browser client | `lib/supabase.ts` | anon | Browser | Enforced |
| Admin client | `lib/supabase-admin.ts` | service role | Server only | Bypassed |

Use `supabase` (browser client) in page components and `useEffect` fetches. Use `supabaseAdmin` in Server Actions (`'use server'` files) when the operation needs elevated access or must bypass RLS. Never import `supabase-admin` in a client component -- the service role key must never reach the browser.

---

## 6. RLS Helper Function

RLS policies on `proposals` and related tables call `public.get_my_role()` to evaluate the authenticated user's role. This function queries `profiles`:

```sql
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;
```

If this function ever throws `relation "public.users" does not exist`, the function body has been reset or re-created pointing at the old pre-rename table. Re-run the above to fix it. This is what caused the PostgREST error on the proposal review page prior to PR #54.

`direct_messages` replies (#57) use two more helpers of the same shape, needed because the INSERT check on a reply has to look up the *root* message's row -- a second row on the same table -- without re-triggering that table's own SELECT policy:

```sql
CREATE OR REPLACE FUNCTION public.is_direct_message_recipient(p_message_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.direct_messages
    WHERE id = p_message_id AND recipient_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.direct_message_sender(p_message_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sender_id FROM public.direct_messages WHERE id = p_message_id;
$$;
```

`project_messages` RLS (#56, re-implemented) mirrors `is_project_client()` with a contractor-side counterpart:

```sql
CREATE OR REPLACE FUNCTION public.is_project_contractor(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contractor_projects
    WHERE project_id = p_project_id AND contractor_id = auth.uid()
  );
$$;
```

The `notifications`/`announcements` system (#57 follow-up) also introduces a set of `SECURITY DEFINER` **trigger functions** (not just query helpers) that write into `notifications` on `INSERT`/`UPDATE` of `direct_messages`, `announcements`, `project_messages`, `proposals`, `proposal_requests`, `contractor_projects`, and `projects` — this is what lets those tables' RLS stay narrow (no `authenticated` INSERT grant on `notifications` at all) while still auto-populating the feed regardless of whether the triggering write came from a server action or the browser client. Full list and SQL: `docs/database-schema.md`'s "Notifications System Migration" section.

---

## 7. PostgREST Join Shape

When using PostgREST (Supabase JS client) to join a foreign table, the result comes back as an array even on many-to-one relationships. Normalize before use:

```typescript
const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
```

When the join is ambiguous (a table with multiple foreign keys to the same target), use the constraint name hint, not the column name:

```typescript
// Correct -- disambiguates when proposals has multiple FK references to profiles
profiles!proposals_client_id_fkey ( name, email )

// Also works for single FK cases
profiles!client_id ( name, email )
```

---

## 8. Current Build State

### What is working end-to-end (as of PR #79)

- Admin creates users via the inline form on `/login/admin/users` -- email invite + temp password flow complete
- Client logs in, submits a proposal via `/login/proposals/new` -- writes to Supabase
- Client views their own submitted proposals via `/login/proposals`
- Admin reviews submitted proposals via `/login/admin/proposals` -- fetches from Supabase with client name/email join
- Admin approves a proposal -- status set to `approved`, `projects` row created automatically
- Admin rejects a proposal -- status set to `rejected`, removed from review queue
- Contractors browse available projects and request to join; admin approves/rejects via `/login/admin/requests`, which inserts the `contractor_projects` row
- Client, contractor, and admin each have an Active Projects list, and every project links to a shared workspace page at `/login/projects/[id]`
- Client, contractor, and admin can each post and read messages in that project's shared thread (#56)

For anything not listed here, `docs/roadmap.md` is the current source of truth -- this list is a snapshot, not maintained line-by-line on every PR.


## 9. Environment Setup

```bash
npm install
npm run dev
```

`.env.local` requires:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

See `docs/onboarding.md` for the full setup walkthrough including Supabase access request and environment variable locations.

---

## 10. Running SQL Directly (`npm run db:exec`)

For applying migrations or ad hoc queries against the actual database without going through the Supabase SQL editor by hand. Uses `scripts/run-sql.mjs` (plain `pg` client, not the Supabase CLI — this project has no `supabase/` migrations directory; migration SQL still lives inline in `docs/database-schema.md` as before).

Requires `DATABASE_URL` in `.env.local` (Dashboard → Project Settings → Database → Connection string → URI). See `.env.example`. Never commit the real value.

```bash
npm run db:exec -- path/to/file.sql
npm run db:exec -- --query "select proname from pg_proc where proname = 'approve_contractor_request'"
```

This runs with a real Postgres connection, not the anon/service-role REST clients — it bypasses RLS and PostgREST entirely, same trust level as the Supabase SQL editor. Treat it accordingly.

---

## 11. Notes for Contributors

- Never disable RLS to fix a query bug. Adjust the policy or move the query to a server action using `supabaseAdmin`.
- When adding a protected route, update both `proxy.ts` (`ROLE_ROUTES` or `AUTHENTICATED_PREFIXES`) and wrap the page with `RouteGuard`. One layer without the other is incomplete.
- The `is_temporary_password` flag drives the forced password change flow. Any action that creates or resets a password must set this flag correctly in `profiles`.
- `contractor_projects`, `proposal_requests`, and `project_messages` have RLS enabled with policies applied. All new tables should follow the same pattern -- RLS on at creation, policies applied in the same migration, never left with zero policies.
- #55 (workspace page, `github_project_url`) and #56 (project thread messaging, `project_messages`) have both landed.

---

*Last updated: 2026-08-05*