# Bug List

A running log of known application-code bugs found during development and review, kept so future bug-hunting sessions don't rediscover the same issues from scratch. This is not a replacement for GitHub issues — open one for anything being actively worked.

Schema- and RLS-level design gaps (missing columns, unenforced constraints, tables not yet built) are tracked separately in the "Known Gaps" table in [`database-schema.md`](./database-schema.md) — not duplicated here.

---

## Open

| Severity | File | Bug |
|---|---|---|
| High | [`app/login/admin/projects/page.tsx`](../app/login/admin/projects/page.tsx) | Queries a nonexistent `projects_table` with `.eq('status', 'Active')`. The real table is `projects` and the real default status is lowercase `'active'`. The page always renders "No active projects found" for admins. Same root cause was fixed in `client/projects/page.tsx` on 2026-07-15 — apply the same fix here. |
| Medium | [`app/login/admin/requests/page.tsx`](../app/login/admin/requests/page.tsx) | `approveRequest()` does two sequential writes — update `proposal_requests.status` to `approved`, then insert into `contractor_projects` — with no transaction. If the second write fails, the request is stuck marked "approved" with no matching `contractor_projects` row, and the contractor never actually gets access. Should be a single server action / RPC so both writes succeed or fail together. |
| Medium | [`app/login/client/page.tsx`](../app/login/client/page.tsx) | Contains a full, working `ClientContent` component (fetches real projects from Supabase) and a `clientItems` array that are both defined but never rendered — the exported `ClientDashboardPage` is an unrelated static nav-link stub. Leftover from a merge that combined two different implementations of this page. Needs a decision on which version is canonical; delete the other. `ClientContent.fetchProjects()` also doesn't check `.error`, so this inherits the "Low" issue below if it's ever wired up. |
| Low | [`app/login/contractor/page.tsx`](../app/login/contractor/page.tsx) | `fetchData` is referenced inside `useEffect` above its own declaration. Works today only because of function-declaration hoisting; fails the `react-hooks/immutability` lint rule and `exhaustive-deps` flags a missing dependency. Reorder or wrap in `useCallback`. |
| Low | Various | A number of pages historically didn't check `.error` on Supabase client calls, so a blocked/failed query (e.g. an RLS policy gap) silently rendered as an empty state instead of a visible error, making root causes hard to find. Fixed in `contractor/page.tsx`, `admin/requests/page.tsx`, and `client/projects/page.tsx` (2026-07-15). Worth auditing remaining pages for the same gap, starting with `admin/projects/page.tsx` and the dead `ClientContent` in `client/page.tsx` above. |
| Low | Site-wide (`Navbar.tsx`, `app/login/page.tsx`, `app/change-password/page.tsx`, `app/login/client/proposals/new/page.tsx`, `app/login/admin/proposals/page.tsx`, and likely others) | Native `<button>` elements don't get a pointer cursor on hover unless explicitly styled with `cursor-pointer` (unlike `<a>`/`Link`, which are pointer by default). `Navbar.tsx`'s four buttons are entirely unstyled. Fixed for the contractor-workflow pages (`contractor/page.tsx`, `admin/requests/page.tsx`, `client/projects/page.tsx`) on 2026-07-15; worth a dedicated pass to fix the rest — Navbar is the highest-impact one since it's on every page. |
| Low | [`components/Navbar.tsx`](../components/Navbar.tsx) | `fetchRole()` re-queries `profiles.role` into a local `role` state on every mount, but the JSX branches on `profile?.role` from `useAuth()` instead — the fetched `role` state is never read (flagged by `@typescript-eslint/no-unused-vars`). Wastes a redundant Supabase round-trip on every load of `admin/projects` and `client/projects` (the two pages still using `Navbar`), and the query's destructured `profile` shadows the outer `useAuth()` `profile`, which invites a real bug if someone "fixes" the dead code by wiring the wrong one up. Delete the effect/state or use it instead of `useAuth()`. |
| Low | [`app/login/admin/users/page.tsx`](../app/login/admin/users/page.tsx) | Page-reset/load logic runs as three separate `useEffect`s that call setState synchronously in the effect body — `loadUsers()` on mount, `setPage(0)` on search/sort change, `setPage(0)` on page-size change — flagged by the `react-hooks/set-state-in-effect` rule for triggering cascading renders. No visible symptom today since none of these feed back into their own dependencies, but should be derived state or event-handler resets instead of effects. |

---

## Resolved

| Date | Issue | Fix |
|---|---|---|
| 2026-07-15 | Contractors saw an empty dashboard (no active or available projects) after logging in. Root cause: the `projects` table RLS policy only allowed contractors to `SELECT` projects they were already assigned to via `contractor_projects` — there was no policy letting them browse unassigned/available projects. | Added a permissive RLS `SELECT` policy on `projects` for the `contractor` role (via `get_my_role()`), plus confirmed `proposal_requests` policies for contractor insert/view-own and admin full access. |
| 2026-07-15 | `app/login/client/projects/page.tsx` queried a nonexistent `projects_table` with `status = 'Active'` (wrong case), so clients could never see their own active projects. Also had no way to see which contractors were linked to a project after an admin approved a request. | Fixed the query to use `projects` / `status = 'active'`, and added a "Team" section that lists contractors linked via `contractor_projects` for each project. |
