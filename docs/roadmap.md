# NWD Central Hub — Product Roadmap

Status key: ✅ Done | 🔄 In Progress | 📋 Not Started | ⏳ Deferred (post-MVP)

For product scope philosophy and the MVP acceptance criteria, see [`docs/mvp.md`](mvp.md).

---

## Current North Star: Beta v1.0 (MVP)

MVP is achieved when the **8-step acceptance test** in `docs/mvp.md` passes end-to-end in production. Everything in the "Alpha — MVP Blockers" section gates that milestone.

---

## Pre-Alpha Foundation — Complete

| Issue | Title | Status |
|-------|-------|--------|
| #36 | First-Time Login Password Change Flow | ✅ Done |
| #38 | Simplify Landing Page & Redirect Logic | ✅ Done |
| #39 | Role-Based Dashboard Redirection | ✅ Done |
| #41 | Contractor Clockify Link (basic) | ✅ Done |
| #42 | Admin Dashboard: Create & Invite Users | ✅ Done |
| #43 | Change Password Page | ✅ Done |
| #44 | Configure Email Provider & Notifications | ✅ Done |
| #46 | Supabase Row-Level Security for Role-Scoped Data | ✅ Done |
| #51 | Restructure Proposals Folder & Update Client Routing | ✅ Done |
| #52 | Client, Contractor, and Admin Active Project Pages | ✅ Done |
| #53 | Unify Dashboard Styling Across Roles | ✅ Done |
| #54 | Admin Proposal Review Page & Lifecycle Automation | ✅ Done |
| #60 | Documentation Overhaul — Onboarding, Schema, Architecture | ✅ Done |
| #78 | Logo Header Changes | ✅ Done |
| #55 | Core Project Workspace Page (+ GitHub Project link) | ✅ Done (PR #79) |
| #45 | Admin Dashboard: User Management Table | ✅ Done (PR #66) |
| #40 | Contractor Workflow: Request & Join Proposals | ✅ Done (PR #63) |

---

## Alpha — MVP Blockers

These are required for the 8-step acceptance test to pass. None are optional.

### In Progress

| Issue | Title | PR | Status |
|-------|-------|----|--------|
| #80 | Unify Headers to Missing Pages | #85 (open) | 🔄 In Progress |

### Not Started (MVP Blockers)

| Issue | Title | Status |
|-------|-------|--------|
| #56 | Shared Project Thread Messaging | 📋 Not Started |

---

## Alpha — UX & Auth Polish

Not required for the 8-step acceptance test, but necessary for Beta v1.0 quality.

| Issue | Title | PR | Status | Notes |
|-------|-------|----|--------|-------|
| #86 | Refactor: Extract NWD Header into Shared Component | — | 📋 Not Started | Unblocked after #80 merges |
| #81 | User Settings & Logout — Header Dropdown | #88 (draft) | 🔄 In Progress | Depends on #86 |
| #82 | Profile and Settings Pages (`/profile`, `/settings`) | #89 (draft) | 🔄 In Progress | Depends on #81 |
| #83 | Redesign Landing/Login Page | #90 (draft) | 🔄 In Progress | oAuth buttons as placeholders until #84 |
| #84 | Set Up oAuth and Account Linking | — | ⏳ Deferred | Placeholders ship with #83; full impl post-MVP |

---

## Documentation & Wiki

| Issue | Title | Status |
|-------|-------|--------|
| #69 | [Wiki] Redesign NWD Main Page | ✅ Done |
| #70 | [Wiki] Project Overview and The Three Roles | ✅ Done |
| #73 | [Wiki] Getting Involved and FAQ | ✅ Done |
| #71 | [Wiki] Tech Stack and Supabase | 📋 Not Started |
| #72 | [Wiki] Platform Workflow and MVP | 📋 Not Started |
| #74 | [Wiki] Architecture and Authentication Overview | 📋 Not Started |
| — | Demo Script & Seed Data (8-step acceptance test with pre-seeded accounts) | 📋 Not Started |

---

## Architecture: Hybrid Project Creation Flow — #87

**Issue #87 — PR #91 (draft), 🔄 In Progress.** This change affects the project workspace data model. #63/#66/#79 (workspace and contractor workflow) have since merged, so this now builds on top of that shipped foundation rather than needing to be sequenced before it.

### Problem

The current model assumes every project originates from a client submitting a proposal. In practice, NWD frequently agrees to projects through word-of-mouth or direct conversations before a client ever logs in. The existing flow then requires the client to re-enter information the admin already has — friction with no value. Additionally, if NWD has already vetted and onboarded the client (they must be given an account to even post), the proposal review step is redundant for those cases.

### Solution: Two paths into a project, one workspace

**Path A — Client-initiated (existing flow, kept as-is):**
Client submits proposal → admin reviews/approves → contractor requests → admin approves → project workspace

**Path B — Admin-initiated (new):**
Admin creates project directly → assigns client → assigns contractor → project workspace

Both paths produce the same project entity and workspace. The proposal is optional, not the sole gate.

### Key decisions

| Decision | Notes |
|----------|-------|
| No "NWD Client" catch-all account | Admin creates a real client account for the project's actual client, or creates the project with no client assigned for fully internal work |
| `proposals` table stays | Admin-initiated projects either skip a proposal record or generate one with `origin: 'admin'` to distinguish creation paths |
| Acceptance test unchanged | The 8-step test still starts with a client submitting — Path A still works. Path B is additive |
| Client role on admin-initiated projects | Client gets read + message access to their assigned project; they do not need to "apply" |

### Scope of change

- New admin UI: "Create Project" flow (distinct from "Review Proposal")
- Schema: `origin` field on `proposals` or `projects` table; client/contractor assignment without a prior proposal
- RLS: project membership still the gate — no change to how access is enforced, only to how records are created
- `docs/database-schema.md` must be updated when this ships

---

## Post-MVP Backlog

Work that begins after the 8-step acceptance test passes in production.

### Messaging & Notifications

| Item | Notes |
|------|-------|
| #57 Admin-to-User Direct Messaging | ✅ Done — one-directional (no reply) DMs from admin to a specific contractor or client's dashboard. `direct_messages` table, a "Message" action (`SendMessageModal`) in each non-admin user's expanded row on the Manage Users page (`/login/admin/users`), plus a `DirectMessageInbox` component on client/contractor dashboards. Dashboard delivery only — email delivery (see taxonomy below) not yet implemented. |
| Email notifications for project events | Delivery via Resend (already wired); triggers listed below |
| Real-time updates (Supabase Realtime) | Replace polling in the project thread; extend to dashboard activity feeds |
| In-app notification inbox | Persistent bell/inbox for activity across all roles |

**Notification event taxonomy:**

| Event | Who receives it |
|-------|----------------|
| Proposal submitted | Admin |
| Proposal approved | Client |
| Proposal rejected | Client |
| Contractor access request submitted | Admin |
| Contractor access request approved | Contractor |
| Contractor access request rejected | Contractor |
| Contractor assigned to project | Client (so they know who's on it) |
| New message in project thread | All 3 roles assigned to that project |
| Admin DM received | Target contractor or client (dashboard — shipped with #57; email still pending) |
| Project status changed (active → complete) | All members of that project |
| New approved proposal available to request | All contractors (opt-in; can be noisy) |

Delivery order: email first (Resend), in-app bell second.

### Admin & Operations

| Item | Notes |
|------|-------|
| Admin reporting dashboard | Project health metrics, user activity, proposal pipeline summary |
| Audit log | Record key admin actions (user creation, proposal approval, contractor assignment) |
| Project status transitions | Formal lifecycle: Active → Complete → Archived; admin-initiated |

### Project Workspace Enhancements

| Item | Notes |
|------|-------|
| GitHub Projects read-only board view | Query GitHub Projects v2 via GraphQL API (GitHub App, `read:project` scope); render a read-only board/list in the workspace — no GitHub account needed by client or contractor to view it. Link fallback already ships with #55. |
| Project milestones & timeline view | Milestone tracking within the workspace; visual timeline optional |
| Clockify deeper API integration | #41 shipped a link; deeper integration (auto time logging, reports) is post-MVP |

### Document Uploads

Three distinct upload surfaces, each with different purpose and ownership:

| Surface | Who | What |
|---------|-----|------|
| Proposal submission (intake form) | Client | Brief, specs, reference docs attached when submitting a proposal |
| Project files (workspace) | Admin, client, contractor | Contracts, deliverables, assets — general project file library |
| Contractor project update | Contractor | Structured update submission (text + optional screenshots/files) logged to project timeline; visible to admin and client |

All uploads stored in Supabase Storage with RLS scoped to project membership. The contractor update submission is a dedicated page or modal — not just a file drop — so updates are time-stamped, attributable, and form a progress trail.

### Platform Polish

| Item | Notes |
|------|-------|
| Mobile responsiveness audit | Full pass across all role dashboards and the project workspace |
| Error & empty state polish | Proper UX for no-data states, failed loads, and edge cases across the app |
| E2E test suite | Spec is the 8-step acceptance test in `docs/mvp.md`; invest after Beta v1.0 ships |

---

## v1.0 & Beyond

| Item | Notes |
|------|-------|
| External client onboarding | Requires additional hardening, support capability, and client-facing polish |
| Payment / invoice tracking | Out of scope until post-v1.0 per `docs/mvp.md` |
| Advanced analytics & reporting | Deeper observability after real usage data exists |
| Workflow automation beyond proposal approval | Out of scope per original white paper; revisit at v1.0 |

---

*Last updated: 2026-07-17*
