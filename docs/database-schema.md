# NWD Central Hub — Database Schema

This document describes the deployed database schema for the NWD Central Hub: tables, columns, relationships, and Row-Level Security policies. It is the source of truth for the current production database.

Read this alongside `docs/architecture.md`, which covers how these tables are queried and how RLS interacts with the two Supabase clients.

> **This document reflects the schema through the Notifications System migration (#57 follow-up).** Tables not yet built are marked with their blocking issue. `docs/database-setup.md` is superseded by this document and should be deleted.

---

## Tables Overview

| Table | Status | Description |
|---|---|---|
| `profiles` | ✅ Complete | Application users — extends `auth.users` |
| `proposals` | ✅ Complete | Project proposals submitted by clients |
| `projects` | ✅ Complete (as of PR #54) | Approved proposals promoted to projects |
| `contractor_projects` | ✅ Complete | Join table linking contractors to projects |
| `proposal_requests` | ✅ Complete | Contractor request-to-join flow (#40) — doc corrected, table was already live |
| `project_messages` | ✅ Complete | In-project messaging (#56, re-implemented) |
| `direct_messages` | ✅ Complete | Admin-to-user direct messaging (#57), with replies |
| `notifications` | ✅ Complete | Unified in-app notification feed — DMs, announcements, system events |
| `announcements` | ✅ Complete | Admin-authored, role-targeted broadcast messages |

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

## Table: `proposal_requests`

Contractor request-to-join flow (#40). **Correction:** this section previously read "❌ Not Built" — that was stale; the table has been live since #40 shipped (`app/login/contractor/page.tsx`'s `requestAccess`, `app/login/admin/requests/page.tsx`). Fixed here while adding the notification trigger below, since documenting a trigger on a table marked "does not exist" would be self-contradictory.

```sql
id              uuid       PRIMARY KEY DEFAULT gen_random_uuid()
contractor_id   uuid       NOT NULL REFERENCES profiles(id)
project_id      uuid       NOT NULL REFERENCES projects(id)
status          text       CHECK (status IN ('pending', 'approved', 'rejected'))
created_at      timestamptz DEFAULT now()
```

**Note:** References `project_id`, not `proposal_id`. A project row exists by the time a contractor makes a request (project is created at proposal approval), so `project_id` is always available. The contractor dashboard must join through `projects` to get proposal details for display.

As of the Notifications System migration (see below), INSERT notifies all admins, and `status` → `rejected` notifies the requesting contractor. `status` → `approved` is deliberately *not* separately notified here — it's covered by the `contractor_projects` INSERT trigger, which always fires immediately after approval in `approveRequest`.

---

## Table: `project_messages`

In-project messaging (#56), re-implemented directly on this branch rather than merged from the unmerged `56-project-thread-messaging` branch (that branch had diverged too far — 20 commits including unrelated OAuth/settings work — for a clean merge; this table/UI was authored fresh, using that branch's design as a reference only). One thread per project, shared by the client, assigned contractor(s), and any admin.

```sql
id          uuid        PRIMARY KEY DEFAULT gen_random_uuid()
project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE
sender_id   uuid        NOT NULL REFERENCES profiles(id)
content     text        NOT NULL
created_at  timestamptz NOT NULL DEFAULT now()
```

**Notes:**
- No `read_at`/title — this is a live shared thread on the project workspace page (`/login/projects/[id]`), not an inbox item; unlike `direct_messages`, nobody "owns" a read state on someone else's project chat.
- RLS reuses the existing `is_project_client()` helper (see "Two Creation Paths" under `projects` above) plus a new, analogous `is_project_contractor()` helper.
- INSERT notifies every *other* project member (client + all assigned contractors, excluding the sender) via the `notifications` table, with a link back to `/login/projects/<id>` — see the Notifications System migration below.
- Delivery to the thread itself is via polling (8s), same reasoning as every other messaging feature in this app (avoids subscription/connection-cleanup machinery for MVP).

Full migration SQL is in the **Notifications System Migration** section below (it depends on `notifications`, which is created first).

---

## Table: `direct_messages`

Admin-to-user direct messaging (#57). An admin starts a conversation with a single client or contractor; the recipient can reply back (flat, one-level threading — replies don't nest further), delete messages from their own inbox, and mark them read individually or in bulk. Deliberately separate from `project_messages` — not scoped to a project, not visible to any other user.

```sql
id            uuid        PRIMARY KEY DEFAULT gen_random_uuid()
recipient_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
sender_id     uuid        NOT NULL REFERENCES profiles(id)
thread_id     uuid        REFERENCES direct_messages(id) ON DELETE CASCADE
title         text        NOT NULL DEFAULT 'Message'
content       text        NOT NULL
created_at    timestamptz NOT NULL DEFAULT now()
```

**Notes:**
- A row with `thread_id IS NULL` is a **thread root** — a new conversation, currently only startable by an admin (enforced by the INSERT policy). A row with `thread_id` set is a **reply**, and always points at the root's `id`, never at another reply — so "which conversation is this" is always `thread_id ?? id`, a single lookup, with no arbitrary-depth tree to reconstruct.
- A reply's `recipient_id`/`sender_id` are the mirror of the message it's replying to (reply `recipient_id` = root's `sender_id`). There's no separate "participants" concept — a conversation is just the set of rows sharing a `thread_id ?? id`.
- `title` is required for a new thread (entered in `SendMessageModal`); a reply's title is computed client-side as `'Re: ' + rootTitle` rather than user-entered, keeping the reply UI to just a body field.
- **`read_at` was removed** (Notifications System migration below) — read/unread/pinned/deleted state all moved to the `notifications` table, one level up. `direct_messages` is now pure append-only content: the client only ever `INSERT`s into it; everything it needs to *display* (title, body, sender, thread root) is denormalized onto the recipient's `notifications` row by a trigger at insert time, so the client never has to `SELECT` this table directly.
- Delivery is via polling refetch on `/notifications` and the Navbar unread-count badge (which both read `notifications`, not this table), same reasoning as `project_messages` (avoids subscription/connection-cleanup machinery for MVP).

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

**This UPDATE policy and the DELETE policy above are both superseded by the Notifications System migration below**, which drops them (read/pin/delete state moves to `notifications`) — apply that migration too, in order; don't stop here.

---

## Table: `notifications`

The single unified in-app feed for every notification-worthy event in the app: direct messages (and replies), admin announcements, and system events (proposal/request/project lifecycle). Introduced alongside the reply/announcement/system-event work described in the migration below.

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

**Notes:**
- **No `authenticated` INSERT grant at all.** Every row is written by a `SECURITY DEFINER` trigger function (see the migration below), which runs with the function owner's privileges regardless of the acting user's own grants — the same mechanism this codebase already uses to sidestep RLS recursion (`is_project_client()`, `get_my_role()`, etc.), applied here to close off "can a client forge a notification to another user" entirely, rather than trying to write an RLS policy that allows it safely.
- `sender_id` is the acting user where one exists (message sender, the client who submitted a proposal, the contractor who requested/joined) and `NULL` for events with no natural single actor.
- `link` is what the "View" control in the notifications UI navigates to — populated for `system` category rows; `direct_message` rows link back to `/notifications` itself (no page for an individual DM); `announcement` rows have no link (the full body is already shown inline, and it isn't repliable/navigable to anything).
- `direct_message_id`/`thread_root_id` are populated only for `category = 'direct_message'` — `thread_root_id` lets Reply be built entirely from this row (`recipient_id` for the reply = this row's `sender_id`, `thread_id` for the reply = this row's `thread_root_id`) without a second query against `direct_messages`.
- `announcement_id` is populated only for `category = 'announcement'`, and is how the admin read-receipt view (`get_announcement_read_receipts()`, below) groups the fan-out rows back together.
- `pinned_at`/`read_at` are both nullable timestamps set by the client (`now()` to set, `NULL` to clear) — used for the pin toggle and mark read/unread respectively. Pinned items sort first in the UI.
- Deleting a notification only removes that recipient's feed entry — it does not touch the underlying `direct_messages`/`announcements` row, so thread history and other recipients' copies of an announcement are unaffected.

---

## Table: `announcements`

Admin-authored, role-targeted broadcast messages (not repliable). The content-once source of truth; delivery to individual recipients is a fan-out into `notifications` (one row per targeted profile), handled by a trigger — see the migration below.

```sql
id            uuid        PRIMARY KEY DEFAULT gen_random_uuid()
sender_id     uuid        NOT NULL REFERENCES profiles(id)
title         text        NOT NULL
body          text        NOT NULL
target_roles  text[]      NOT NULL
created_at    timestamptz NOT NULL DEFAULT now()
```

**Notes:**
- `target_roles` is a subset of `{'admin', 'client', 'contractor'}` — any combination, chosen via checkboxes in the compose UI (`app/login/admin/announcements/page.tsx`).
- Admin-only SELECT/INSERT. Non-admin recipients never query this table directly — they only ever see their own fanned-out `notifications` row (title/body copied over at send time).
- Immutable once sent — no UPDATE/DELETE policy, matching the immutability convention used by `project_messages`/`direct_messages`.
- Read receipts (who's read it, of how many) are exposed to admins via the `get_announcement_read_receipts(p_announcement_id)` RPC below, rather than broadening `notifications`' otherwise strictly-recipient-only SELECT policy.

---

## Notifications System Migration (apply by hand, in this order)

This is one migration, ordered because later statements depend on earlier ones (`notifications` references both `direct_messages` and `announcements`; every trigger function references `notifications`).

```sql
-- 1. direct_messages: add title, retire read_at (state moves to notifications)
ALTER TABLE public.direct_messages ADD COLUMN title text NOT NULL DEFAULT 'Message';
ALTER TABLE public.direct_messages DROP COLUMN read_at;
DROP POLICY IF EXISTS "Recipients can mark their messages read" ON public.direct_messages;
DROP POLICY IF EXISTS "Recipients can delete their messages" ON public.direct_messages;
REVOKE UPDATE, DELETE ON public.direct_messages FROM authenticated;

-- 2. announcements
CREATE TABLE public.announcements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    uuid NOT NULL REFERENCES public.profiles(id),
  title        text NOT NULL,
  body         text NOT NULL,
  target_roles text[] NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.announcements TO authenticated;

CREATE POLICY "Admins can view announcements"
ON public.announcements FOR SELECT TO authenticated
USING (public.get_my_role() = 'admin');

CREATE POLICY "Admins can send announcements"
ON public.announcements FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND public.get_my_role() = 'admin');

-- 3. notifications
CREATE TABLE public.notifications (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_id          uuid REFERENCES public.profiles(id),
  category           text NOT NULL CHECK (category IN ('direct_message', 'announcement', 'system')),
  title              text NOT NULL,
  body               text NOT NULL,
  link               text,
  direct_message_id  uuid REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  thread_root_id     uuid,
  announcement_id    uuid REFERENCES public.announcements(id) ON DELETE CASCADE,
  pinned_at          timestamptz,
  read_at            timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.notifications (recipient_id, created_at);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- No INSERT grant — every row is written by a SECURITY DEFINER trigger function.
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;

CREATE POLICY "Recipients can view their own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (recipient_id = auth.uid());

CREATE POLICY "Recipients can update their own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

CREATE POLICY "Recipients can delete their own notifications"
ON public.notifications FOR DELETE TO authenticated
USING (recipient_id = auth.uid());

-- 4. direct_messages -> notifications
CREATE OR REPLACE FUNCTION public.notify_direct_message_recipient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (
    recipient_id, sender_id, category, title, body, link, direct_message_id, thread_root_id
  ) VALUES (
    NEW.recipient_id, NEW.sender_id, 'direct_message', NEW.title, NEW.content, '/notifications',
    NEW.id, COALESCE(NEW.thread_id, NEW.id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_direct_message_recipient
AFTER INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_direct_message_recipient();

-- 5. announcements -> notifications (fan-out to every targeted role)
CREATE OR REPLACE FUNCTION public.notify_announcement_recipients()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, sender_id, category, title, body, announcement_id)
  SELECT id, NEW.sender_id, 'announcement', NEW.title, NEW.body, NEW.id
  FROM public.profiles
  WHERE role = ANY(NEW.target_roles);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_announcement_recipients
AFTER INSERT ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.notify_announcement_recipients();

-- 6. admin read-receipt RPC (keeps notifications' SELECT policy strictly recipient-only)
CREATE OR REPLACE FUNCTION public.get_announcement_read_receipts(p_announcement_id uuid)
RETURNS TABLE (recipient_id uuid, name text, role text, read_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.recipient_id, p.name, p.role, n.read_at
  FROM public.notifications n
  JOIN public.profiles p ON p.id = n.recipient_id
  WHERE n.announcement_id = p_announcement_id
    AND public.get_my_role() = 'admin'
  ORDER BY p.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_announcement_read_receipts(uuid) TO authenticated;

-- 7. project_messages (re-implemented fresh; see the note under its table section above)
CREATE TABLE public.project_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES public.profiles(id),
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.project_messages (project_id, created_at);

ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.project_messages TO authenticated;

-- Mirrors is_project_client() for the contractor side.
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

-- 8. project_messages -> notifications (every other project member)
CREATE OR REPLACE FUNCTION public.notify_project_message_recipients()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_title text;
  v_preview text;
BEGIN
  SELECT title INTO v_project_title FROM public.projects WHERE id = NEW.project_id;
  v_preview := left(NEW.content, 140);

  INSERT INTO public.notifications (recipient_id, sender_id, category, title, body, link)
  SELECT p.client_id, NEW.sender_id, 'system',
         'New message in ' || COALESCE(v_project_title, 'a project'),
         v_preview, '/login/projects/' || NEW.project_id
  FROM public.projects p
  WHERE p.id = NEW.project_id AND p.client_id IS NOT NULL AND p.client_id != NEW.sender_id;

  INSERT INTO public.notifications (recipient_id, sender_id, category, title, body, link)
  SELECT cp.contractor_id, NEW.sender_id, 'system',
         'New message in ' || COALESCE(v_project_title, 'a project'),
         v_preview, '/login/projects/' || NEW.project_id
  FROM public.contractor_projects cp
  WHERE cp.project_id = NEW.project_id AND cp.contractor_id != NEW.sender_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_project_message_recipients
AFTER INSERT ON public.project_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_project_message_recipients();

-- 9. proposals -> notify all admins on submit
CREATE OR REPLACE FUNCTION public.notify_admins_new_proposal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, sender_id, category, title, body, link)
  SELECT id, NEW.client_id, 'system', 'New proposal submitted',
         COALESCE(NEW.title, 'Untitled proposal'), '/login/admin/proposals'
  FROM public.profiles WHERE role = 'admin';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_admins_new_proposal
AFTER INSERT ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_proposal();

-- 10. proposals -> notify client on approve/reject
CREATE OR REPLACE FUNCTION public.notify_client_proposal_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('approved', 'rejected') AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (recipient_id, category, title, body, link)
    VALUES (
      NEW.client_id, 'system', 'Proposal ' || NEW.status,
      COALESCE(NEW.title, 'Untitled proposal'), '/login/client/proposals'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_client_proposal_status
AFTER UPDATE OF status ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.notify_client_proposal_status();

-- 11. proposal_requests -> notify all admins on new request
CREATE OR REPLACE FUNCTION public.notify_admins_new_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_title text;
BEGIN
  SELECT title INTO v_project_title FROM public.projects WHERE id = NEW.project_id;
  INSERT INTO public.notifications (recipient_id, sender_id, category, title, body, link)
  SELECT id, NEW.contractor_id, 'system', 'New request to join a project',
         COALESCE(v_project_title, 'A project'), '/login/admin/requests'
  FROM public.profiles WHERE role = 'admin';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_admins_new_request
AFTER INSERT ON public.proposal_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_request();

-- 12. proposal_requests -> notify contractor on rejection
-- (approval is covered by the contractor_projects INSERT trigger below, since
-- approveRequest() always inserts that row immediately after approving)
CREATE OR REPLACE FUNCTION public.notify_contractor_request_rejected()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_title text;
BEGIN
  IF NEW.status = 'rejected' AND NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT title INTO v_project_title FROM public.projects WHERE id = NEW.project_id;
    INSERT INTO public.notifications (recipient_id, category, title, body, link)
    VALUES (
      NEW.contractor_id, 'system', 'Request declined',
      'Your request to join ' || COALESCE(v_project_title, 'a project') || ' was declined.',
      '/login/contractor'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_contractor_request_rejected
AFTER UPDATE OF status ON public.proposal_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_contractor_request_rejected();

-- 13. contractor_projects -> notify the new contractor, the client, and existing contractors
CREATE OR REPLACE FUNCTION public.notify_contractor_joined()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project record;
  v_contractor_name text;
BEGIN
  SELECT title, client_id INTO v_project FROM public.projects WHERE id = NEW.project_id;
  SELECT name INTO v_contractor_name FROM public.profiles WHERE id = NEW.contractor_id;

  INSERT INTO public.notifications (recipient_id, category, title, body, link)
  VALUES (
    NEW.contractor_id, 'system', 'You joined a project',
    COALESCE(v_project.title, 'A project'), '/login/projects/' || NEW.project_id
  );

  IF v_project.client_id IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, sender_id, category, title, body, link)
    VALUES (
      v_project.client_id, NEW.contractor_id, 'system', 'New contractor joined your project',
      COALESCE(v_contractor_name, 'A contractor') || ' joined ' || COALESCE(v_project.title, 'your project'),
      '/login/projects/' || NEW.project_id
    );
  END IF;

  INSERT INTO public.notifications (recipient_id, sender_id, category, title, body, link)
  SELECT cp.contractor_id, NEW.contractor_id, 'system', 'New contractor joined your project',
         COALESCE(v_contractor_name, 'A contractor') || ' joined ' || COALESCE(v_project.title, 'your project'),
         '/login/projects/' || NEW.project_id
  FROM public.contractor_projects cp
  WHERE cp.project_id = NEW.project_id AND cp.contractor_id != NEW.contractor_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_contractor_joined
AFTER INSERT ON public.contractor_projects
FOR EACH ROW EXECUTE FUNCTION public.notify_contractor_joined();

-- 14. projects -> notify assigned client (on creation, or later assignment)
-- Skipped on INSERT when the project came from an approved proposal (proposal_id
-- set) — the client already gets a "Proposal approved" notification for that same
-- event via trg_notify_client_proposal_status, so this would be a redundant second
-- notification. Still fires for admin-direct project creation (no proposal) and for
-- later reassignment of an existing project's client, since neither of those has any
-- other notification covering them.
CREATE OR REPLACE FUNCTION public.notify_client_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.client_id IS DISTINCT FROM NEW.client_id)
     AND NOT (TG_OP = 'INSERT' AND NEW.proposal_id IS NOT NULL) THEN
    INSERT INTO public.notifications (recipient_id, category, title, body, link)
    VALUES (
      NEW.client_id, 'system', 'You were assigned to a project',
      COALESCE(NEW.title, 'A project'), '/login/projects/' || NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_client_assigned
AFTER INSERT OR UPDATE OF client_id ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.notify_client_assigned();
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
            │               ├── proposal_requests (project_id → projects.id)
            │               └── contractor_projects (project_id → projects.id)
            │
            ├── contractor_projects (contractor_id → profiles.id)
            │
            ├── proposal_requests (contractor_id → profiles.id)
            │
            ├── project_messages (sender_id → profiles.id)
            │
            ├── direct_messages (sender_id → profiles.id, recipient_id → profiles.id)
            │
            ├── announcements (sender_id → profiles.id)
            │
            └── notifications (recipient_id → profiles.id, sender_id → profiles.id)
                    ├── direct_message_id → direct_messages.id
                    └── announcement_id → announcements.id
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

### `proposal_requests`

| Operation | Who | Policy |
|---|---|---|
| SELECT | Admin | All rows |
| SELECT | Contractor | Own rows only |
| INSERT | Contractor | Own rows only (`contractor_id = auth.uid()`) |
| UPDATE | Admin | Status on any row (approve/reject) |

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
| SELECT | Sender or recipient | Rows where you're either party (client never needs this directly — see notes above) |
| SELECT | Admin | All rows |
| INSERT | Admin | Any thread, own sends only (`sender_id = auth.uid()`) |
| INSERT | Non-admin | Reply-only: `thread_id` must reference a message sent to them, and `recipient_id` must be that thread's original sender |
| UPDATE, DELETE | — | Not permitted for anyone — retired in favor of `notifications`' read/pin/delete state |

### `project_messages`

| Operation | Who | Policy |
|---|---|---|
| SELECT, INSERT | Client | On their own projects (`is_project_client()`) |
| SELECT, INSERT | Contractor | On projects they're assigned to (`is_project_contractor()`) |
| SELECT, INSERT | Admin | Any project |

### `announcements`

| Operation | Who | Policy |
|---|---|---|
| SELECT, INSERT | Admin | All rows / own sends only (`sender_id = auth.uid()`) |
| — | Everyone else | No direct access — recipients only ever see their fanned-out `notifications` row |

### `notifications`

| Operation | Who | Policy |
|---|---|---|
| SELECT, UPDATE, DELETE | Recipient | Own rows only |
| INSERT | Nobody, directly | Every row is written by a `SECURITY DEFINER` trigger function — no `authenticated` INSERT grant exists on this table at all |

---

## Known Gaps

| Gap | Impact | Resolved by |
|---|---|---|
| NULL rows in `profiles` | Orphaned auth records from out-of-flow user creation | Future cleanup migration (non-blocking) |
| `budget` has no numeric constraint | Freeform text — no validation beyond form `type="number"` | Post-MVP hardening |
| Terminal status not enforced at DB level | `approved`/`rejected` proposals can be updated via direct SQL | Post-MVP hardening (CHECK constraint or trigger) |
| No email delivery for notifications | All notification types (DM, announcement, system) are in-app only; the Settings "Email notifications" toggle is still a non-functional placeholder | Post-MVP — Resend is already wired for onboarding email and could be extended |

---

*Last updated: [Update on commit]*