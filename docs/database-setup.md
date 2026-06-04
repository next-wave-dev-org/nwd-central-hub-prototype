# Database Setup Guide (Supabase)

## Overview

This document explains how to recreate the database schema for the NWD Central Hub application using Supabase.

The schema includes:

* User profiles with roles (admin, client, contractor)
* Proposals created by clients and reviewed by admins
* Projects created when a proposal is approved
* Contractor assignments to projects
* Contractor requests to join projects

A new developer should be able to fully recreate the database using this guide.

---

## Tables

### 1. profiles

Stores all application users and their roles. Created automatically by Supabase Auth triggers; managed via the Supabase dashboard or admin tooling.

| Column                | Type        | Description                           |
| --------------------- | ----------- | ------------------------------------- |
| id                    | uuid        | Primary key                           |
| email                 | text        | User email                            |
| name                  | text        | Display name                          |
| role                  | text        | User role: `admin`, `client`, `contractor` |
| is_temporary_password | boolean     | Whether the user must change password on next login |
| created_at            | timestamptz | Timestamp of creation                 |

```sql
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  role text check (role in ('admin', 'client', 'contractor')),
  email text,
  name text,
  is_temporary_password boolean not null default false
);
```

---

### 2. proposals

Stores proposals submitted by clients. An admin reviews and approves or rejects them. Approval creates a project.

| Column      | Type        | Description                                              |
| ----------- | ----------- | -------------------------------------------------------- |
| id          | uuid        | Primary key                                              |
| client_id   | uuid        | References profiles.id — the client who submitted       |
| title       | text        | Proposal title                                           |
| description | text        | Proposal description                                     |
| status      | text        | `draft` \| `submitted` \| `approved` \| `rejected`      |
| created_at  | timestamptz | Timestamp of creation                                    |

```sql
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'rejected')),
  created_at timestamptz default now()
);
```

---

### 3. projects

Created when an admin approves a proposal. Linked to the originating proposal and the client who submitted it.

| Column      | Type        | Description                           |
| ----------- | ----------- | ------------------------------------- |
| id          | uuid        | Primary key                           |
| proposal_id | uuid        | References proposals.id               |
| client_id   | uuid        | References profiles.id                |
| title       | text        | Project title (copied from proposal)  |
| description | text        | Project description                   |
| created_at  | timestamptz | Timestamp of creation                 |

```sql
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references public.proposals(id) on delete set null,
  client_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  created_at timestamptz default now()
);
```

---

### 4. contractor_projects

Junction table linking contractors to the projects they have been assigned to. A row is inserted here when an admin approves a contractor's join request.

| Column        | Type        | Description                         |
| ------------- | ----------- | ----------------------------------- |
| id            | uuid        | Primary key                         |
| contractor_id | uuid        | References profiles.id              |
| project_id    | uuid        | References projects.id              |
| assigned_at   | timestamptz | Timestamp of assignment             |

```sql
create table if not exists public.contractor_projects (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  assigned_at timestamptz default now(),
  unique (contractor_id, project_id)
);
```

---

### 5. proposal_requests

Tracks a contractor's request to join a project. An admin reviews the request and approves or rejects it. Approval inserts a row into `contractor_projects`.

| Column        | Type        | Description                                    |
| ------------- | ----------- | ---------------------------------------------- |
| id            | uuid        | Primary key                                    |
| contractor_id | uuid        | References profiles.id                         |
| project_id    | uuid        | References projects.id                         |
| status        | text        | `pending` \| `approved` \| `rejected`          |
| created_at    | timestamptz | Timestamp of creation                          |

```sql
create table if not exists public.proposal_requests (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now(),
  unique (contractor_id, project_id)
);
```

---

## Roles

The system supports three roles:

* **admin** → full system access; approves proposals and contractor join requests
* **client** → submits proposals; views their active projects
* **contractor** → requests access to projects; logs hours against assigned projects

---

## Relationships

```
profiles.id → proposals.client_id        (one client, many proposals)
proposals.id → projects.proposal_id      (one proposal creates one project)
profiles.id → projects.client_id         (one client, many projects)
profiles.id → contractor_projects.contractor_id  (one contractor, many projects)
projects.id → contractor_projects.project_id     (one project, many contractors)
profiles.id → proposal_requests.contractor_id    (one contractor, many requests)
projects.id → proposal_requests.project_id       (one project, many requests)
```

---

## SQL Setup (Run in Supabase SQL Editor)

Run these in order. Each table depends on the one above it.

```sql
-- 1. profiles (usually auto-created by Auth triggers — only run manually if needed)
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  role text check (role in ('admin', 'client', 'contractor')),
  email text,
  name text,
  is_temporary_password boolean not null default false
);

-- 2. proposals
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'rejected')),
  created_at timestamptz default now()
);

-- 3. projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references public.proposals(id) on delete set null,
  client_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  created_at timestamptz default now()
);

-- 4. contractor_projects
create table if not exists public.contractor_projects (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  assigned_at timestamptz default now(),
  unique (contractor_id, project_id)
);

-- 5. proposal_requests
create table if not exists public.proposal_requests (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now(),
  unique (contractor_id, project_id)
);
```

---

## Seed Data (Optional for Testing)

```sql
-- Add test profiles (use real Supabase Auth user IDs in production)
insert into public.profiles (email, role, name)
values
  ('admin@example.com', 'admin', 'Admin User'),
  ('client@example.com', 'client', 'Client User'),
  ('contractor@example.com', 'contractor', 'Contractor User');

-- Add a test proposal for the client
insert into public.proposals (client_id, title, description, status)
select id, 'Test Proposal', 'Example proposal for testing.', 'submitted'
from public.profiles
where email = 'client@example.com';
```

---

## How to Recreate the Database

1. Open the Supabase dashboard
2. Go to **SQL Editor**
3. Run the table creation queries above in order
4. (Optional) Run seed data queries
5. Verify tables in **Table Editor**

---

## Verification

* `profiles` table exists with `role`, `name`, `email`, `is_temporary_password` columns
* `proposals` table exists and references `profiles`
* `projects` table exists and references both `proposals` and `profiles`
* `contractor_projects` table exists with unique constraint on `(contractor_id, project_id)`
* `proposal_requests` table exists with unique constraint on `(contractor_id, project_id)`
