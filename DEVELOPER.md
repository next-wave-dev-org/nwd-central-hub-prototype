# NWD Central Hub – Technical Transition Kit

This document explains how to manage users, assign roles, recreate the database schema, and outlines future development steps.

---

## 1. How to Add a New User

This project uses Supabase Authentication.

To manually add a user:

1. Log into Supabase Dashboard
2. Select the NWD Central Hub project
3. Go to **Authentication → Users**
4. Click **Add User**
5. Enter:
   - Email
   - Temporary password
6. Confirm the email manually if needed

The user will now exist in `auth.users`.

---

## 2. How to Assign a Role

User roles are stored in the `profiles` table.

Available roles:
- `admin`
- `client`
- `contractor`

### Option A – Using Table Editor

1. Go to Supabase → Table Editor
2. Open the `profiles` table
3. Find the user
4. Update the `role` column
5. Save

### Option B – Using SQL

```sql
UPDATE profiles
SET role = 'admin'
WHERE id = 'USER_UUID';
```

---

## 3. Database Schema

### Profiles Table

```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  role text CHECK (role IN ('admin', 'client', 'contractor')),
  created_at timestamp DEFAULT now()
);
```

### Projects Table

```sql
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  client_id uuid REFERENCES profiles(id),
  created_at timestamp DEFAULT now()
);
```

### Contractor Projects Table

```sql
CREATE TABLE contractor_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid REFERENCES profiles(id),
  project_id uuid REFERENCES projects(id),
  assigned_at timestamp DEFAULT now()
);
```

---

## 4. What's Next (Roadmap)

The following features are planned or recommended:

- Messaging system between users
- Real-time notifications
- File uploads for contractors
- Role-based dashboard improvements
- Project status tracking
- Payment integration
- Admin analytics dashboard
- Improved error handling and validation

---

## 5. Environment Setup

To run locally:

```bash
npm install
npm run dev
```

Ensure you have a `.env.local` file with:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
---

## 6. Notes for Future Developers

- Roles control dashboard access.
- Supabase Row Level Security (RLS) should be enabled.
- Always test role-based routing after changes.
- Keep authentication logic centralized.

---

End of Technical Transition Kit.