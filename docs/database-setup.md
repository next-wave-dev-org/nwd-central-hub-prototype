# Database Setup Guide (Supabase)

## Overview

This document explains how to recreate the database schema for the NWD Central Hub application using Supabase.

The schema includes:

* Users with roles (admin, client, contractor)
* Proposals created by clients
* Relationships between users and proposals

A new developer should be able to fully recreate the database using this guide.

---

## Tables

### 1. users

Stores all application users and their roles.

| Column     | Type        | Description                           |
| ---------- | ----------- | ------------------------------------- |
| id         | uuid        | Primary key                           |
| email      | text        | Unique user email                     |
| role       | text        | User role (admin, client, contractor) |
| created_at | timestamptz | Timestamp of creation                 |

---

### 2. proposals

Stores proposals created by clients.

| Column      | Type        | Description           |
| ----------- | ----------- | --------------------- |
| id          | uuid        | Primary key           |
| client_id   | uuid        | References users.id   |
| title       | text        | Proposal title        |
| description | text        | Proposal description  |
| status      | text        | Proposal status       |
| created_at  | timestamptz | Timestamp of creation |

---

## Roles

The system supports three roles:

* **admin** → full system access
* **client** → can create proposals
* **contractor** → can view/respond to proposals

---

## Relationships

* A **client (user)** can have **many proposals**
* Relationship:

```
users.id → proposals.client_id
```

* Foreign key constraint ensures data integrity

---

## SQL Setup (Run in Supabase SQL Editor)

### Create Users Table

```sql
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null check (role in ('admin', 'client', 'contractor')),
  created_at timestamptz default now()
);
```

---

### Create Proposals Table

```sql
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'rejected')),
  created_at timestamptz default now()
);
```

---

## Seed Data (Optional for Testing)

Run this after creating tables:

```sql
insert into public.users (email, role)
values
  ('admin@example.com', 'admin'),
  ('client@example.com', 'client'),
  ('contractor@example.com', 'contractor');
```

```sql
insert into public.proposals (client_id, title, description, status)
select id, 'Test Proposal', 'Example proposal for testing.', 'draft'
from public.users
where email = 'client@example.com';
```

---

## How to Recreate the Database

1. Open Supabase dashboard
2. Go to **SQL Editor**
3. Run the table creation queries
4. (Optional) Run seed data queries
5. Verify tables in **Table Editor**

---

## Verification

* Users table exists with roles
* Proposals table exists
* Proposals correctly reference users
* Test data appears correctly

---

## Notes

* Roles are stored directly in the `users` table for simplicity
* This can be extended later with more advanced role-based access control (RBAC)
