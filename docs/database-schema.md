# NWD Central Hub — Database Schema

This document describes the deployed database schema for the NWD Central Hub: tables, columns, relationships, and Row-Level Security policies. It is the source of truth for the current production database.

Read this alongside `docs/architecture.md`, which covers how these tables are queried and how RLS interacts with the two Supabase clients.

> **This document reflects the schema as of the merge of PR #54 ([#54] Admin Proposal Review Page & Lifecycle Automation).** Tables not yet built are marked with their blocking issue. `docs/database-setup.md` is superseded by this document and should be deleted.

---

## Tables Overview

| Table | Status | Description |
|---|---|---|
| `profiles` | ✅ Complete | Application users — extends `auth.users` |
| `proposals` | ✅ Complete | Project proposals submitted by clients |
| `projects` | ✅ Complete (as of PR #54) | Approved proposals promoted to projects |
| `contractor_projects` | ✅ Complete | Join table linking contractors to projects |
| `proposal_requests` | ❌ Not built | Contractor request-to-join flow — pending #40 |
| `project_messages` | ✅ Complete | In-project messaging tied to a project (#56) |

---

## Table: `profiles`

Stores application users. Every row corresponds to a row in `auth.users` and is created atomically alongside it by the `createUser` server action in `actions.ts`.

```sql
id                    uuid         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
email                 text
name                  text
role                  text         CHECK (role IN ('admin', 'client', 'contractor'))
is_temporary_password boolean
created_at            timestamp    DEFAULT now()
```

**Notes:**
- `id` is the Supabase auth UID — not generated independently. The `profiles` row is deleted automatically if the corresponding `auth.users` row is deleted.
- `role` is assigned by an admin at creation and is not user-editable.
- `is_temporary_password` is set to `true` on creation and to `false` after the user completes the forced password change flow. `RouteGuard` reads this field on every protected page load.
- `name` is set at creation but is not currently reflected in the `UserProfile` TypeScript type. Add `name?: string` to `types/auth.ts` before implementing workspace or messaging features that display user names.
- NULL rows in this table indicate orphaned auth records — users created outside the `createUser` action. These are inert but should be cleaned up via a future migration.

**Source of truth:** `app/login/admin/users/create/actions.ts`

---

## Table: `proposals`

Stores project proposals created and submitted by client users.

```sql
id            uuid       PRIMARY KEY DEFAULT gen_random_uuid()
client_id     uuid       NOT NULL REFERENCES profiles(id)
title         text
description   text
budget        text
status        text       CHECK (status IN ('draft', 'submitted', 'approved', 'rejected'))
created_at    timestamp  DEFAULT now()
```

**Status lifecycle:**

```
draft → submitted → approved
                 └→ rejected
```

| Status | Meaning |
|---|---|
| `draft` | Created by client, not yet submitted |
| `submitted` | Submitted for admin review |
| `approved` | Admin approved — triggers project creation |
| `rejected` | Admin rejected — terminal state |

`approved` and `rejected` are terminal states. A proposal cannot be moved out of either once set. This is enforced in the UI via `canAdminReviewProposal()` in `lib/proposals.ts`, which gates the Approve and Reject buttons to `submitted` proposals only. Database-level enforcement via CHECK constraint or trigger is a post-MVP hardening task.

**Notes:**
- `budget` is a freeform text field. It is required in the client submission form but has no numeric constraint at the database level.
- `client_id` references `profiles.id`, not `auth.users.id` directly.
- New proposals are created with `status: 'submitted'` by the client form (`proposals/new/page.tsx`). The `draft` status exists in the type system for future use (e.g., save-for-later before submission) but is not currently written by any UI flow.
- Status transition logic, display helpers, and badge CSS classes live in `lib/proposals.ts`.

**Source of truth:** `lib/proposals.ts`, `app/login/proposals/new/page.tsx`

---

## Table: `projects`

A project can be created one of two ways (see "Two Creation Paths" below):
- Automatically, when an admin approves a proposal. The `approveProposal` server action in `app/login/admin/proposals/actions.ts` updates the proposal status to `approved` and inserts the projects row atomically.
- Directly, when an admin uses "Create Project" without a prior proposal. The `createProjectDirect` server action in `app/login/admin/projects/new/actions.ts` inserts the row (and any contractor assignments) with no `proposals` row involved.

```sql
id                  uuid       PRIMARY KEY DEFAULT gen_random_uuid()
proposal_id         uuid       REFERENCES proposals(id)
client_id           uuid       REFERENCES profiles(id)
title               text
description         text
budget              text
status              text       DEFAULT 'active'
github_project_url  text
origin              text       NOT NULL DEFAULT 'client' CHECK (origin IN ('client', 'admin'))
created_at          timestamptz DEFAULT now()
```

**Notes:**
- `proposal_id` and `client_id` are nullable — an admin-initiated project has no source proposal, and can be created with no client for fully internal work.
- For client-initiated projects, `proposal_id`, `client_id`, `title`, `description`, and `budget` are copied from the source proposal at approval time.
- Contractor linkage is handled via `contractor_projects` (see below), not a column on this table, regardless of origin.
- `github_project_url` is optional; when set, a "View Project Board" link is shown in the workspace. Added in #55.
- `origin` records which path created the row — `'client'` (default, proposal-approved) or `'admin'` (direct creation). Existing rows default to `'client'` since every project prior to this field's introduction came through the proposal flow.

**Source of truth:** `app/login/admin/proposals/actions.ts`, `app/login/admin/projects/new/actions.ts`

### Two Creation Paths

```
Path A — Client-initiated (unchanged):
  Client submits proposal → admin reviews/approves → contractor requests → admin approves → project workspace

Path B — Admin-initiated:
  Admin creates project directly → assigns client (optional) → assigns contractor(s) (optional) → project workspace
```

Both paths produce an identical `projects` row and land in the same `/projects/[id]` workspace. `origin` is metadata for the admin UI (see the "Active Projects" badge) — it is not read by any RLS policy or access check. **Project membership remains the sole access gate**: a client sees a project because `client_id = auth.uid()`, a contractor because a `contractor_projects` row exists, regardless of how the project was created.

**Correction:** one RLS policy *did* need a change, found during testing. The `projects` SELECT policy for clients (`client_id = auth.uid()`) works unchanged for both paths. But the existing `contractor_projects` SELECT policy for clients ("contractors assigned to their projects") turned out to be implemented as a join through `proposal_requests`, not through `projects.client_id` directly — so a client could not see contractors on an admin-initiated project, since no `proposal_requests` row exists for that path. Confirmed via direct query with the service-role client: the `projects` row and `contractor_projects` row both existed correctly, and the contractor could see the assignment via their own "own rows only" policy, but the client's query for the same row returned nothing. Fixed by adding an additional (additive/permissive — does not remove the existing policy) client SELECT policy on `contractor_projects` keyed directly off project ownership, included in the migration below.

**Second correction:** the first version of that added policy used a raw subquery on `projects` (`project_id IN (SELECT id FROM projects WHERE client_id = auth.uid())`). Since the existing `projects` SELECT policy for contractors subqueries `contractor_projects` in the other direction (added in the 2026-07-15 fix — see `docs/DEVELOPER.md` §6), the two policies formed a cycle: evaluating either table's RLS re-triggered the other's, producing `infinite recursion detected in policy for relation "projects"` on effectively any authenticated query against either table. Fixed the same way this codebase already fixes this class of problem — a `STABLE SECURITY DEFINER` helper function (mirroring `public.get_my_role()`, documented in `docs/DEVELOPER.md` §6) whose inner query bypasses RLS, breaking the cycle. **If you already ran the raw-subquery version of this policy, drop and recreate it using the version below.**

**Third correction:** even with the `contractor_projects` policy fixed, the client still couldn't see the assigned contractor's *name/email* — the "Assigned Contractors" section on the workspace page rendered "Unknown", and the client's project list Team section silently dropped the row (`client/projects/page.tsx` does `if (!contractor) continue` when the embedded `profiles` join comes back `null`). Root cause: this document only ever documented `profiles` SELECT as "own row" + "admin all rows" (see the `profiles` RLS table below), but the "Team" feature demonstrably worked for Path A before this issue (2026-07-15 fix) — meaning an undocumented policy must already exist in the live DB letting a client read a contractor's profile, and per the same pattern as the last two corrections, it's scoped through `proposal_requests` and doesn't cover admin-initiated projects. Confirmed the underlying data and PostgREST join shape were correct via a service-role query (plain object, not array — no data or shape bug) before concluding this was RLS. Fixed with another additive, `SECURITY DEFINER`-backed policy on `profiles`, also in the migration below.

### Migration (apply by hand in the Supabase SQL editor)

```sql
-- Admin-initiated projects have no source proposal and may have no client yet
ALTER TABLE public.projects ALTER COLUMN proposal_id DROP NOT NULL;
ALTER TABLE public.projects ALTER COLUMN client_id DROP NOT NULL;

-- Track which path created the project
ALTER TABLE public.projects
  ADD COLUMN origin text NOT NULL DEFAULT 'client'
  CHECK (origin IN ('client', 'admin'));

-- Drop the broken raw-subquery version of this policy if you already created it —
-- harmless no-op if you haven't.
DROP POLICY IF EXISTS "Clients can view contractors on their own projects" ON public.contractor_projects;

-- SECURITY DEFINER breaks the RLS recursion: the inner SELECT on projects runs
-- as the function owner (bypasses RLS) instead of re-triggering the projects
-- table's own policies — mirrors the get_my_role() pattern in docs/DEVELOPER.md §6.
CREATE OR REPLACE FUNCTION public.is_project_client(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND client_id = auth.uid()
  );
$$;

-- Let clients see contractors assigned to their own projects regardless of
-- how the assignment was made (proposal-request approval, or direct admin
-- assignment on an admin-initiated project) — the prior policy only covered
-- the proposal_requests-approval path.
CREATE POLICY "Clients can view contractors on their own projects"
ON public.contractor_projects
FOR SELECT
TO authenticated
USING (public.is_project_client(project_id));

-- Let clients read the name/email of contractors assigned to their own
-- projects, regardless of how the assignment was made. SECURITY DEFINER
-- again to avoid recursing into contractor_projects'/projects' own policies.
CREATE OR REPLACE FUNCTION public.is_contractor_on_my_project(p_contractor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contractor_projects cp
    JOIN public.projects p ON p.id = cp.project_id
    WHERE cp.contractor_id = p_contractor_id
      AND p.client_id = auth.uid()
  );
$$;

CREATE POLICY "Clients can view contractor profiles on their projects"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_contractor_on_my_project(id));
```

---

## Table: `contractor_projects`

Join table linking approved contractors to projects. Populated when an admin approves a contractor's request in the #40 flow.

```sql
id              uuid       PRIMARY KEY DEFAULT gen_random_uuid()
contractor_id   uuid       NOT NULL REFERENCES profiles(id)
project_id      uuid       NOT NULL REFERENCES projects(id)
assigned_at     timestamptz
```

---

## Table: `proposal_requests` ❌ Not Built

Required for the contractor request-to-join flow (#40). Does not exist yet.

**Planned schema:**

```sql
id              uuid       PRIMARY KEY DEFAULT gen_random_uuid()
contractor_id   uuid       NOT NULL REFERENCES profiles(id)
project_id      uuid       NOT NULL REFERENCES projects(id)
status          text       CHECK (status IN ('pending', 'approved', 'rejected'))
created_at      timestamptz DEFAULT now()
```

**Note:** References `project_id`, not `proposal_id`. A project row exists by the time a contractor makes a request (project is created at proposal approval), so `project_id` is always available. The contractor dashboard (#40) must join through `projects` to get proposal details for display.

---

## Table: `project_messages`

In-project messaging (#56). One thread per project, shared by the client, assigned contractor(s), and admin.

**Overlap with PR #119:** #119 (the notifications/direct-messaging system, #57) independently re-implemented this same table plus a rewrite of `app/login/projects/[id]/page.tsx`, to attach a `notify_project_message_recipients` trigger. The two never merged in either direction, so they'll conflict — decided to land this branch (#118) first, since it already carries the reviewed workspace UI (Client card, markdown descriptions, layout, unassigned-contractor composer hide) that #119 doesn't have. When #119 is picked back up: drop its `CREATE TABLE public.project_messages` and its `app/login/projects/[id]/page.tsx` messaging changes (table and page will already exist from this branch), keep everything else (`notifications`, `announcements`, `direct_messages`), and re-point its `notify_project_message_recipients` trigger at the table created here — the trigger function itself only touches `project_id`/`sender_id`/`content`, so it needs no changes. Also drop #119's own `project_messages_content_length` CHECK — added here instead (below) so it exists regardless of merge order.

```sql
id          uuid        PRIMARY KEY DEFAULT gen_random_uuid()
project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE
sender_id   uuid        NOT NULL REFERENCES profiles(id)
content     text        NOT NULL CHECK (char_length(content) <= 5000)
created_at  timestamptz DEFAULT now()
```

**Notes:**
- `sender_id` references `profiles.id`, not `auth.users.id` directly — matches `proposals.client_id`, `contractor_projects.contractor_id`, etc.
- No `role` column. The sender's role is resolved by joining to `profiles.role` at read time, not captured at send time — if a user's role changes after posting, older messages reflect their *current* role, not the role they held when they sent the message. Decided this way because it matches the drafted schema exactly and role changes are rare; revisit if that assumption stops holding.
- No UPDATE/DELETE policies — messages are immutable (post + read only).
- Delivery to other participants is via polling refetch from the client (`app/login/projects/[id]/page.tsx`), not Supabase Realtime — this is the first messaging feature in the app, and polling avoids introducing subscription/connection-cleanup machinery for MVP.
- `content` is capped at 5000 characters (matches the limit #119 uses for `direct_messages`/`announcements` bodies, kept in sync here since either PR could land first) and enforced client-side too (`MESSAGE_MAX_LENGTH` in `app/login/projects/[id]/page.tsx`).

**Correction:** the first version of this migration omitted the table-level `GRANT`, and inserting failed with `permission denied for table project_messages` even though the INSERT policy was correct — RLS only applies after the base table-level privilege check passes. Every other table in this project was originally created through the Supabase dashboard, which auto-grants `authenticated`/`anon`/`service_role` on creation; this table was the first created via raw SQL (`db:exec`/SQL editor), which does not. Fixed by adding an explicit `GRANT` (included below). Any future table created the same way needs the same explicit grant.

**Migration (apply by hand — see `docs/DEVELOPER.md` §10):**

```sql
CREATE TABLE public.project_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES public.profiles(id),
  content     text NOT NULL CHECK (char_length(content) <= 5000),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;

-- Base table-level privilege — RLS policies alone are not enough. Needed
-- because this table was created via raw SQL rather than the dashboard,
-- which is what normally auto-grants this.
GRANT SELECT, INSERT ON public.project_messages TO authenticated;

-- Mirrors is_project_client(p_project_id) for the contractor side.
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

-- Client (is_project_client), contractor (is_project_contractor), admin
-- (get_my_role()) — the three membership mechanisms, each via its own
-- SECURITY DEFINER helper, no raw subqueries.
CREATE POLICY "Project members can view messages"
ON public.project_messages FOR SELECT TO authenticated
USING (
  public.is_project_client(project_id)
  OR public.is_project_contractor(project_id)
  OR public.get_my_role() = 'admin'
);

CREATE POLICY "Project members can post messages"
ON public.project_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    public.is_project_client(project_id)
    OR public.is_project_contractor(project_id)
    OR public.get_my_role() = 'admin'
  )
);

-- Mirrors is_contractor_on_my_project(p_contractor_id), roles swapped —
-- lets a contractor see their project's client (Client card + message
-- attribution).
CREATE OR REPLACE FUNCTION public.is_my_project_client(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.contractor_projects cp ON cp.project_id = p.id
    WHERE cp.contractor_id = auth.uid() AND p.client_id = p_client_id
  );
$$;

CREATE POLICY "Contractors can view client profiles on their assigned projects"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_my_project_client(id));

-- Lets any authenticated user see admin profiles (name/role), so an admin's
-- messages render correctly for client and contractor viewers. No helper
-- needed — same-row column check, no cross-table subquery, no recursion risk.
CREATE POLICY "Authenticated users can view admin profiles"
ON public.profiles FOR SELECT TO authenticated
USING (role = 'admin');

-- Found via #56 testing: a second contractor on the same project showed as
-- "Unknown" in both the message thread and the Assigned Contractors panel —
-- no prior policy let one contractor read another's profile, only
-- client<->contractor and admin<->all were covered. Mirrors the same
-- SECURITY DEFINER pattern, keyed off shared contractor_projects membership.
CREATE OR REPLACE FUNCTION public.is_co_contractor(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contractor_projects cp1
    JOIN public.contractor_projects cp2 ON cp2.project_id = cp1.project_id
    WHERE cp1.contractor_id = auth.uid() AND cp2.contractor_id = p_profile_id
  );
$$;

CREATE POLICY "Contractors can view co-contractor profiles on shared projects"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_co_contractor(id));
```

---

## Relationships

```
auth.users
    │
    └── profiles (id → auth.users.id)
            │
            ├── proposals (client_id → profiles.id)
            │       │
            │       └── projects (proposal_id → proposals.id)
            │               │
            │               ├── project_messages (project_id → projects.id)
            │               ├── proposal_requests (project_id → projects.id)  [not built]
            │               └── contractor_projects (project_id → projects.id)
            │
            ├── contractor_projects (contractor_id → profiles.id)
            │
            ├── proposal_requests (contractor_id → profiles.id)  [not built]
            │
            └── project_messages (sender_id → profiles.id)
```

---

## Row-Level Security (RLS)

RLS is enabled on all tables. The browser Supabase client (`lib/supabase.ts`, anon key) is always subject to these policies. The server admin client (`lib/supabase-admin.ts`, service role key) bypasses RLS entirely and must only be used in server actions.

**Never disable RLS on a table to fix a query bug.** If a query fails due to RLS, the correct fix is to adjust the policy or move the query to a server action using `supabaseAdmin`.

### `profiles`

| Operation | Who | Policy |
|---|---|---|
| SELECT | Authenticated user | Own row only (`auth.uid() = id`) |
| SELECT | Admin | All rows |
| SELECT | Client | Profiles of contractors assigned to their own projects — two policies: an undocumented pre-existing one (scoped through `proposal_requests` approval, per Path A) plus an additive one using `public.is_contractor_on_my_project()`, added to also cover admin-initiated projects (see "Two Creation Paths" under `projects` above) |
| SELECT | Contractor | Profile of the client on their assigned project(s), via `public.is_my_project_client()` (#56) |
| SELECT | Contractor | Profiles of co-contractors on shared projects, via `public.is_co_contractor()` (#56) |
| SELECT | Any authenticated user | Profiles with `role = 'admin'` (#56 — needed so admin senders are identified in the project message thread) |
| INSERT | Server action only | Via `supabaseAdmin` in `createUser` — not client-initiated |
| UPDATE | Authenticated user | Own row only |
| UPDATE | Admin | Any row |

### `proposals`

| Operation | Who | Policy |
|---|---|---|
| SELECT | Client | Own proposals only (`auth.uid() = client_id`) |
| SELECT | Admin | All proposals |
| SELECT | Contractor | Proposals with `status = 'approved'` only |
| INSERT | Client | Own proposals only (`auth.uid() = client_id`) |
| UPDATE | Admin | Status on any proposal |
| UPDATE | Client | Not permitted — status changes are admin-only |

### `projects`

| Operation | Who | Policy |
|---|---|---|
| SELECT | Client | Own projects only (`client_id = auth.uid()`) |
| SELECT | Admin | All projects |
| SELECT | Contractor | Projects where assigned (via `contractor_projects`) |
| INSERT | Admin | Via `supabaseAdmin`, in either the `approveProposal` or `createProjectDirect` server action |
| UPDATE | Admin | Any project |

### `proposal_requests` (not yet built)

Policies will be defined when the table is created in #40. Planned: admin full access, contractor insert own, contractor view own.

### `project_messages`

| Operation | Who | Policy |
|---|---|---|
| SELECT | Client | Own project only, via `public.is_project_client(project_id)` |
| SELECT | Contractor | Assigned project only, via `public.is_project_contractor(project_id)` |
| SELECT | Admin | All rows, via `public.get_my_role() = 'admin'` |
| INSERT | Client / Contractor / Admin | Same membership check as SELECT, plus `sender_id = auth.uid()` — cannot post as another user |
| UPDATE / DELETE | Nobody | No policies — messages are immutable |

### `contractor_projects`

| Operation | Who | Policy |
|---|---|---|
| SELECT | Admin | All rows |
| SELECT | Contractor | Own rows only |
| SELECT | Client | Contractors assigned to their projects — two policies: original (via `proposal_requests` approval) plus an additive one using `public.is_project_client()` (a `SECURITY DEFINER` helper, see "Two Creation Paths" above), added to also cover admin-initiated projects without recursing into the `projects` table's own contractor-visibility policy |
| INSERT | Admin | Via server action only |

---

## RPC Functions

### `approve_contractor_request(p_request_id uuid)`

Added to fix #93 — `approveRequest()` in `app/login/admin/requests/page.tsx` previously did two sequential client-side writes (update `proposal_requests.status` to `approved`, then insert into `contractor_projects`) with no transaction. If the insert failed after the update succeeded, the request was stuck "approved" with no matching `contractor_projects` row and the contractor never got access. This function combines both writes into a single Postgres function call, which runs as one transaction — either both writes commit or neither does.

`SECURITY DEFINER` (mirroring `get_my_role()` and the helpers documented under "Two Creation Paths" above) so it can write to both tables regardless of which RLS policies are in place; the role check is done explicitly in the function body instead.

**Migration (apply by hand in the Supabase SQL editor):**

```sql
CREATE OR REPLACE FUNCTION public.approve_contractor_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contractor_id uuid;
  v_project_id uuid;
BEGIN
  IF public.get_my_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins can approve requests';
  END IF;

  UPDATE public.proposal_requests
  SET status = 'approved'
  WHERE id = p_request_id AND status = 'pending'
  RETURNING contractor_id, project_id INTO v_contractor_id, v_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already actioned';
  END IF;

  INSERT INTO public.contractor_projects (contractor_id, project_id)
  VALUES (v_contractor_id, v_project_id)
  ON CONFLICT (contractor_id, project_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_contractor_request(uuid) TO authenticated;
```

Called from the client via `supabase.rpc('approve_contractor_request', { p_request_id })`. Any failure (not-pending request, non-admin caller) comes back as a normal PostgREST error and is surfaced through the existing error banner on the requests page — nothing swallowed.

---

## Known Gaps

| Gap | Impact | Resolved by |
|---|---|---|
| `proposal_requests` table not built | Contractor self-service join flow blocked | #40 |
| NULL rows in `profiles` | Orphaned auth records from out-of-flow user creation | Future cleanup migration (non-blocking) |
| `budget` has no numeric constraint | Freeform text — no validation beyond form `type="number"` | Post-MVP hardening |
| Terminal status not enforced at DB level | `approved`/`rejected` proposals can be updated via direct SQL | Post-MVP hardening (CHECK constraint or trigger) |

---

*Last updated: 2026-08-05*