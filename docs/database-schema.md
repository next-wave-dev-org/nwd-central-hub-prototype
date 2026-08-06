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
| `project_messages` | ❌ Not built | In-project messaging — pending #56 |
| `direct_messages` | ✅ Complete | Admin-to-user direct messaging (#57) |

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

## Table: `project_messages` ❌ Not Built

Required for in-project messaging (#56). Does not exist yet.

**Planned schema:**

```sql
id          uuid       PRIMARY KEY DEFAULT gen_random_uuid()
project_id  uuid       NOT NULL REFERENCES projects(id)
sender_id   uuid       NOT NULL REFERENCES profiles(id)
content     text       NOT NULL
created_at  timestamp  DEFAULT now()
```

---

## Table: `direct_messages`

Admin-to-user direct messaging (#57). An admin starts a conversation with a single client or contractor; the recipient can reply back (flat, one-level threading — replies don't nest further), delete messages from their own inbox, and mark them read individually or in bulk. Deliberately separate from `project_messages` — not scoped to a project, not visible to any other user.

```sql
id            uuid        PRIMARY KEY DEFAULT gen_random_uuid()
recipient_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
sender_id     uuid        NOT NULL REFERENCES profiles(id)
thread_id     uuid        REFERENCES direct_messages(id) ON DELETE CASCADE
content       text        NOT NULL
read_at       timestamptz
created_at    timestamptz NOT NULL DEFAULT now()
```

**Notes:**
- A row with `thread_id IS NULL` is a **thread root** — a new conversation, currently only startable by an admin (enforced by the INSERT policy). A row with `thread_id` set is a **reply**, and always points at the root's `id`, never at another reply — so "which conversation is this" is always `thread_id ?? id`, a single lookup, with no arbitrary-depth tree to reconstruct.
- A reply's `recipient_id`/`sender_id` are the mirror of the message it's replying to (reply `recipient_id` = root's `sender_id`). There's no separate "participants" concept — a conversation is just the set of rows sharing a `thread_id ?? id`.
- `read_at` is `NULL` until the recipient opens it or uses "mark all as read," at which point the client sets it to `now()`. Same MVP trust-level note as before: no column-level restriction beyond the UPDATE policy's row-ownership check.
- Deleting a message removes the row entirely — recipient-only permission, and since a message is a single row shared by both parties, the sender's view of that message disappears too. No per-party soft-delete; acceptable simple behavior for MVP.
- Delivery is via polling refetch (`/notifications` page and the Navbar unread-count badge), same `project_messages` precedent and reasoning (avoids subscription/connection-cleanup machinery for MVP).

**Initial migration (apply by hand — see `docs/DEVELOPER.md` §10):**

```sql
CREATE TABLE public.direct_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_id    uuid NOT NULL REFERENCES public.profiles(id),
  content      text NOT NULL,
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.direct_messages (recipient_id, created_at);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Base table-level privilege — RLS policies alone are not enough. Needed
-- because this table was created via raw SQL rather than the dashboard,
-- which is what normally auto-grants this (same gotcha as project_messages).
GRANT SELECT, INSERT, UPDATE ON public.direct_messages TO authenticated;

-- Recipient marks their own message read.
CREATE POLICY "Recipients can mark their messages read"
ON public.direct_messages FOR UPDATE TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());
```

**Follow-up migration — replies, delete (apply by hand):**

```sql
ALTER TABLE public.direct_messages
  ADD COLUMN thread_id uuid REFERENCES public.direct_messages(id) ON DELETE CASCADE;

GRANT DELETE ON public.direct_messages TO authenticated;

DROP POLICY IF EXISTS "Recipients and admins can view direct messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Admins can send direct messages" ON public.direct_messages;

-- Mirrors get_my_role()/is_project_client() — SECURITY DEFINER lets the
-- INSERT check look up the root message's row without re-triggering this
-- table's own policies.
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

-- SELECT: you can see anything you sent or received (needed so your own
-- replies show up when you revisit later), plus admins see everything.
CREATE POLICY "Participants and admins can view direct messages"
ON public.direct_messages FOR SELECT TO authenticated
USING (recipient_id = auth.uid() OR sender_id = auth.uid() OR public.get_my_role() = 'admin');

-- INSERT: admins can start or reply to anything. Non-admins can only reply
-- (thread_id required) within a thread that was sent to them, and only back
-- to that thread's original sender.
CREATE POLICY "Admins send freely; recipients reply within their thread"
ON public.direct_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    public.get_my_role() = 'admin'
    OR (
      thread_id IS NOT NULL
      AND public.is_direct_message_recipient(thread_id)
      AND recipient_id = public.direct_message_sender(thread_id)
    )
  )
);

-- DELETE: recipient-only, own copy of the message.
CREATE POLICY "Recipients can delete their messages"
ON public.direct_messages FOR DELETE TO authenticated
USING (recipient_id = auth.uid());
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
            │               ├── project_messages (project_id → projects.id)  [not built]
            │               ├── proposal_requests (project_id → projects.id)  [not built]
            │               └── contractor_projects (project_id → projects.id)
            │
            ├── contractor_projects (contractor_id → profiles.id)
            │
            ├── proposal_requests (contractor_id → profiles.id)  [not built]
            │
            ├── project_messages (sender_id → profiles.id)  [not built]
            │
            └── direct_messages (sender_id → profiles.id, recipient_id → profiles.id)
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

### `contractor_projects`

| Operation | Who | Policy |
|---|---|---|
| SELECT | Admin | All rows |
| SELECT | Contractor | Own rows only |
| SELECT | Client | Contractors assigned to their projects — two policies: original (via `proposal_requests` approval) plus an additive one using `public.is_project_client()` (a `SECURITY DEFINER` helper, see "Two Creation Paths" above), added to also cover admin-initiated projects without recursing into the `projects` table's own contractor-visibility policy |
| INSERT | Admin | Via server action only |

### `direct_messages`

| Operation | Who | Policy |
|---|---|---|
| SELECT | Sender or recipient | Rows where you're either party |
| SELECT | Admin | All rows |
| INSERT | Admin | Any thread, own sends only (`sender_id = auth.uid()`) |
| INSERT | Non-admin | Reply-only: `thread_id` must reference a message sent to them, and `recipient_id` must be that thread's original sender |
| UPDATE | Recipient | Own rows only (used to set `read_at`) |
| DELETE | Recipient | Own rows only |

---

## Known Gaps

| Gap | Impact | Resolved by |
|---|---|---|
| `UserProfile` type missing `name` | TypeScript friction when workspace/messaging display user names | Add `name?: string` to `types/auth.ts` before #55/#56 |
| `proposal_requests` table not built | Contractor self-service join flow blocked | #40 |
| `project_messages` table not built | In-project messaging blocked | #56 |
| NULL rows in `profiles` | Orphaned auth records from out-of-flow user creation | Future cleanup migration (non-blocking) |
| `budget` has no numeric constraint | Freeform text — no validation beyond form `type="number"` | Post-MVP hardening |
| Terminal status not enforced at DB level | `approved`/`rejected` proposals can be updated via direct SQL | Post-MVP hardening (CHECK constraint or trigger) |

---

*Last updated: [Update on commit]*