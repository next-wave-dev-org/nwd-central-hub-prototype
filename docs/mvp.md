# NWD Central Hub — MVP Definition

This document defines the Minimum Viable Product (MVP) for the NWD Central Hub, how success is measured, and the scope boundaries that guide engineering decisions. It is the source of truth for product scope and should be read alongside the original white paper prepared by the business team.

---

## What This Platform Is

NWD Central Hub is the internal coordination platform for Next Wave Dev. It centralizes the workflow that NWD already operates manually: client organizations submit project proposals, NWD staff review and approve them, and NWD graduate contractors are assigned to and work on those projects.

The platform does not introduce a new workflow. It automates and centralizes one that exists today.

---

## The Three Roles

The platform is built around three distinct user types. Understanding who each role represents in the real world is essential for every product and engineering decision.

| Role | Who They Are | What They Do |
|---|---|---|
| **Admin** | NWD staff and senior developers | Manage users, review proposals, oversee projects, facilitate contractor assignment |
| **Client** | External organizations hiring NWD graduates | Submit project proposals, track project progress |
| **Contractor** | NWD graduate students | Browse approved proposals, request project assignment, deliver project work |

**During the MVP phase**, clients and contractors will be represented by test accounts managed by the NWD team. Real external clients are not onboarded until v1.0. Students in the practicum serve as **user testers** — validating that the platform works as intended — not as permanent users of any role.

---

## What the MVP Is

The MVP is the minimum version of the platform that delivers the complete three-role coordination workflow end-to-end, running reliably in production, and documented well enough that a new practicum student can onboard and contribute within their first sprint.

**MVP is achieved when the following scenario executes without manual intervention:**

1. An admin invites a new client via the admin dashboard
2. The client receives an onboarding email, logs in, changes their temporary password, and is routed to the client dashboard
3. The client creates and submits a project proposal
4. The admin reviews the submitted proposal and approves it
5. A contractor logs in, views the approved proposal, and requests access
6. The admin approves the contractor's request
7. The client, contractor, and admin can each navigate to the project workspace from their respective dashboards
8. All three roles can post and read messages in the project thread

This scenario is the MVP acceptance test. When it passes reliably in production, the platform has reached MVP and transitions to **Beta v1.0**.

**MVP is not achieved by any partial slice of this workflow.** A working proposal flow without a workspace, or a workspace without messaging, demonstrates technical progress but does not deliver the coordination value the platform exists to provide.

---

## What the MVP Is Not

Being explicit about what is out of scope is as important as defining what is in scope.

- **Not a public product launch.** The platform is for internal NWD use during the MVP phase. External client onboarding happens post-MVP.
- **Not a commercially hardened platform.** Enterprise-grade scale, performance, and security are v1.0 concerns, not MVP concerns.
- **Not a finished product.** MVP is the beginning of real use, not the end of development.
- **Not a teaching tool.** The platform is built by students but is not itself educational software. It is a real internal tool that happens to be built by a student engineering team.

---

## Who Uses It and When

| Phase | Users | Purpose |
|---|---|---|
| **Pre-MVP (now)** | Practicum students as user testers, NWD staff as admins | Build and validate the platform |
| **Beta v1.0 (MVP complete)** | NWD staff and seeded test accounts for all three roles | Internal coordination of real NWD project work |
| **v1.0** | NWD staff, real external clients, NWD graduate contractors | Full production use; potential external client onboarding |

---

## Release Phases

| Phase | Definition |
|---|---|
| **Pre-Alpha** | Foundation work complete. Auth, roles, and plumbing exist. Not usable as a coordination tool. |
| **Alpha** | The end-to-end workflow exists. Rough edges. Internal dogfood and testing only. |
| **Beta v1.0** | MVP complete. Full workflow is functional and stable in production. Ready for internal NWD use with test accounts. |
| **v1.0** | Stable release after beta feedback and refinement. Ready for real external clients. |
| **Post-v1.0** | Enhancement releases based on real usage (v1.1, v1.2, etc.). |

Reaching Beta v1.0 is the engineering team's current north star.

---

## MVP Scope

### In Scope

The following capabilities are required for MVP. None are optional.

**Authentication and User Management**
- Secure login with role-based routing
- Admin-driven user invitation with temporary credentials delivered via email
- First-time password change enforcement
- Row-Level Security ensuring users only access data appropriate to their role

**Proposal Workflow**
- Client dashboard with actions to create, submit, and track proposals
- Formalized proposal statuses: Draft → Submitted → Approved / Rejected
- Admin interface to review pending proposals with Approve and Reject actions

**Project Creation**
- Approved proposals automatically promoted to Project entities in the database
- Client linked to the resulting project at approval time

**Contractor Assignment**
- Contractor dashboard view of approved proposals with a Request Access action
- Admin view of pending contractor requests with approval and rejection actions
- Approved contractors linked to the project and granted workspace access

**Project Workspace**
- Dedicated workspace page per project at a dynamic route (`/projects/[id]`)
- Displays project metadata: title, description, status, members
- Accessible only to the client, assigned contractor(s), and admin associated with that project
- Visible from each role's dashboard via an Active Projects view

**In-Project Messaging**
- Shared message thread embedded in the project workspace
- All three assigned roles can post and read messages
- Messages attributed to sender with role context
- Real-time delivery preferred; polling is an acceptable fallback for MVP

**Documentation**
- Onboarding guide sufficient for a new practicum student to clone, configure, and run the project within one session
- Current database schema reflecting deployed tables and RLS policies
- Architecture overview covering auth flow, role routing, and the proposal-to-project lifecycle
- Demo script covering the 8-step MVP acceptance test with pre-seeded test accounts

### Out of Scope for MVP

The following are explicitly deferred. They are not forgotten — they are post-MVP.

| Item | Rationale |
|---|---|
| Admin-to-user direct messaging | Separate system from project threads; adds complexity without serving the core workflow |
| Real-time notification system | Useful enrichment; polling is sufficient for MVP |
| Clockify API integration | External link to Clockify already shipped; deeper integration is post-MVP |
| File uploads and deliverable management | Important for v1.0 but not required to validate the coordination workflow |
| Advanced admin analytics | Post-MVP observability feature |
| External client onboarding | Not until v1.0; requires additional hardening and support capability |
| Payment integration | Post-v1.0 |
| Workflow automation beyond proposal approval | Out of scope per original white paper |

---

## Engineering Principles for This Project

These are not coding standards — those live in the codebase. These are the product-level principles that should guide decisions when scope is ambiguous.

**The workflow is the product.** Every feature decision should be evaluated against the 8-step acceptance test. If a feature doesn't serve that test, it is post-MVP by default.

**Handoff quality is a first-class deliverable.** The practicum model means contributors rotate every quarter. Code that works but cannot be understood by the next contributor is a liability. Documentation, clear commit history, and well-scoped issues are not optional.

**Students are testers, not clients.** Practicum students validate that the platform works. Their feedback during development is invaluable. Their long-term experience as a user persona does not define the product — the three-role model does.

**The senior dev layer holds architectural direction.** Rotating contributors own feature work. The persistent senior team owns the architecture, the scope boundaries, and the product direction. When these are in tension, the senior layer decides.

**Defer, don't delete.** When scope needs to shrink, move work to post-MVP, not to the trash. The backlog is a product asset.

---

## Relationship to the White Paper

The original white paper prepared by the business team describes a generic team collaboration tool focused on reducing operational fragmentation. This MVP definition refines that vision into the specific workflow the codebase has been built around: a three-role platform where NWD brokers project work between external client organizations and graduate contractors.

The two documents are not in conflict. The white paper is the **problem statement and strategic framing**. This document is the **product definition and engineering scope**. New contributors should read both. Where they appear to diverge, this document takes precedence for engineering decisions.

---

## Notes for Contributors

- This document is living. Update it when scope clarifies, when a milestone completes, or when the platform's direction evolves.
- New feature proposals should be evaluated against the MVP scope section before being added to the backlog. Work that doesn't serve the MVP acceptance test is post-MVP by default.
- The acceptance test in this document is the spec for a future end-to-end test suite. When the team is ready to invest in E2E testing, the 8-step scenario is the starting point.
- All three roles should be represented by test accounts in the development and staging environments at all times. Losing test account access is a blocker, not a minor issue.

---

*Last updated: [Update on commit]*
