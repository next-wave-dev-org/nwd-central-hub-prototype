# NWD Central Hub — Developer Reference

This document is for contributors who are already set up and oriented. It covers user and role management, the deployed database schema, active development state, and what is coming next. Read `docs/onboarding.md` first, then `docs/architecture.md`, then this document.

---

## 1. Managing Users

There is no self-registration. All accounts are created by an admin.

### Creating a user via the admin UI

1. Log in as an admin
2. Navigate to `/login/admin/users/create`
3. Fill in name, email, and role
4. Submit — the server action generates a 15-character temporary password, creates the `auth.users` row, inserts the `profiles` row atomically, and sends an onboarding email via Resend
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

The deployed schema as of PR #54. `docs/database-schema.md` is the detailed reference including RLS policies and relationship diagrams. This section is the quick-reference version.

### `profiles`

Extends `auth.users`. Created atomically by the `createUser` server action.

```sql
id                    uuid         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
email                 text
name                  text
role                  text         CHECK (role IN ('admin', 'client', 'contractor'))
is_temporary_password boolean
created_at            timestamp    DEFAULT now()
```

> `name` is set at creation but is not yet in the `UserProfile` TypeScript type. Add `name?: string` to `types/auth.ts` before implementing any feature that displays user names (workspace, messaging).

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
id            uuid       PRIMARY KEY DEFAULT gen_random_uuid()
proposal_id   uuid       NOT NULL REFERENCES proposals(id)
client_id     uuid       NOT NULL REFERENCES profiles(id)
title         text
description   text
budget        text
status        text       DEFAULT 'active'
created_at    timestamptz DEFAULT now()
```

Contractor linkage is handled via `contractor_projects` (see below). The workspace page (`/projects/[id]`) is pending #55.

### `proposal_requests`

Contractor self-service request-to-join flow. Pending #40.

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

In-project messaging. Not yet built -- pending #56.

```sql
id          uuid       PRIMARY KEY DEFAULT gen_random_uuid()
project_id  uuid       NOT NULL REFERENCES projects(id)
sender_id   uuid       NOT NULL REFERENCES profiles(id)
content     text       NOT NULL
created_at  timestamptz DEFAULT now()
```

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
  role: UserRole
  is_temporary_password?: boolean
}
```

> `name` is missing from `UserProfile`. The `profiles` table has a `name` column and `AuthProvider` does not select it. Before implementing #55 or #56, add `name?: string` to `UserProfile` and add `name` to the `select` call in `AuthProvider.tsx`.

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

### What is working end-to-end (as of PR #54)

- Admin creates users via `/login/admin/users/create` -- email invite + temp password flow complete
- Client logs in, submits a proposal via `/login/proposals/new` -- writes to Supabase
- Client views their own submitted proposals via `/login/proposals`
- Admin reviews submitted proposals via `/login/admin/proposals` -- fetches from Supabase with client name/email join
- Admin approves a proposal -- status set to `approved`, `projects` row created automatically
- Admin rejects a proposal -- status set to `rejected`, removed from review queue


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

## 10. Notes for Contributors

- Never disable RLS to fix a query bug. Adjust the policy or move the query to a server action using `supabaseAdmin`.
- When adding a protected route, update both `proxy.ts` (`ROLE_ROUTES` or `AUTHENTICATED_PREFIXES`) and wrap the page with `RouteGuard`. One layer without the other is incomplete.
- The `is_temporary_password` flag drives the forced password change flow. Any action that creates or resets a password must set this flag correctly in `profiles`.
- `contractor_projects` and `proposal_requests` have RLS enabled with policies applied. All new tables should follow the same pattern -- RLS on at creation, policies applied in the same migration, never left with zero policies.
- Do not build features that hard-depend on the current `projects` schema without coordinating with the team first. The schema will extend as #55 and #56 land.

---

*Last updated: [Update on commit]*