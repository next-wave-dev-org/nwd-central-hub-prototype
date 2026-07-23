# NWD Central Hub — Onboarding Guide

This guide is for new contributors joining the NWD Central Hub project. By the end of this document you should have the repository running locally, Supabase access confirmed, and a working login for each role. You should not need to ask anyone for help beyond what is listed here.

---

## 1. Prerequisites

Make sure the following are installed before you begin.

| Tool | Version | Check |
|---|---|---|
| Node.js | v20 or higher | `node -v` |
| npm | Comes with Node | `npm -v` |
| Git | Any recent version | `git --version` |

If you need to manage multiple Node versions, use [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install 20
nvm use 20
```

---

## 2. Repository Access

Request access to the GitHub repository from one of the project administrators listed in Section 6.

Once access is granted:

```bash
git clone https://github.com/NextWaveDev/nwd-central-hub-prototype.git
cd nwd-central-hub-prototype
npm install
```

---

## 3. Supabase Access

The project uses a shared Supabase instance. You cannot run the application without credentials from this instance.

### Step 1 — Create a Supabase account

Go to [https://supabase.com](https://supabase.com) and create a free account if you do not already have one.

### Step 2 — Request access

Contact one of the project administrators (see Section 6) and provide the **email address you used to sign up for Supabase**. They will invite you to the NWD Central Hub project.

You will receive an email invitation from Supabase. Accept it to gain access.

### Step 3 — Get your environment variables

Once you have access to the Supabase project:

1. Go to the Supabase dashboard and open the NWD Central Hub project
2. Navigate to **Project Settings → API**
3. Copy the following values:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → `anon / public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` key |
| `RESEND_API_KEY` | Contact a project administrator |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for local development |

### Step 4 — Create your local environment file

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the values from the step above. Your completed file should look like this:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
RESEND_API_KEY=your-resend-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Never commit `.env.local` to version control.** It is already listed in `.gitignore`.

> **The `SUPABASE_SERVICE_ROLE_KEY` has full database access and bypasses Row-Level Security.** It is used only in server-side admin actions. Never expose it to the client or commit it anywhere.

---

## 4. Running the Application

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the local development server |
| `npm run build` | Build for production |
| `npm run start` | Start the production server (after build) |
| `npm run lint` | Run ESLint |

---

## 5. Verifying Your Setup

Once the app is running, verify each of the following before starting any development work.

### 5.1 Verify Supabase connection

Navigate to [http://localhost:3000](http://localhost:3000). If the landing page loads without a `supabaseUrl is required` error, your environment variables are correctly set.

### 5.2 Verify role-based login

Request test account credentials from a project administrator (see Section 6). There should be one account per role:

| Role | What to verify |
|---|---|
| `admin` | Logs in → routed to admin dashboard |
| `client` | Logs in → routed to client dashboard |
| `contractor` | Logs in → routed to contractor dashboard |

If a role routes incorrectly or throws an error, check that the `profiles` table has a row for that user with the correct `role` value. See `docs/database-schema.md` for table details.

### 5.3 Verify the invite flow (optional but recommended)

Log in as admin, navigate to the user creation page, and create a test user. Verify:
- A success message appears with a temporary password
- The invited user receives an onboarding email from Resend
- The invited user can log in with the temporary password and is forced to change it

If the email does not arrive, check that `RESEND_API_KEY` and `NEXT_PUBLIC_APP_URL` are correctly set in `.env.local`.

### 5.4 Verify OAuth sign-in and account linking (optional)

The shared test accounts (`admin@email.com`, `client@email.com`, `contractor@email.com`) **cannot** be used to test Google/GitHub/LinkedIn sign-in or linking — they're fabricated addresses with no real account behind them, so no OAuth provider will ever authenticate as one of them. To verify this flow, use your own real account instead:
- Sign in with your own Google/GitHub/LinkedIn account from `/login`, or
- Log in as any test user, then link your own account from `/settings`

See `docs/architecture.md` → "OAuth Sign-In & Account Linking" for how the flow works under the hood.

---

## 6. Project Administrators

For repository access, Supabase invitations, test account credentials, or Resend API key:

| Name | Role |
|---|---|
| Taylor | Project Administrator |
| Brad | Project Administrator |
| Jesse | Project Administrator |

Reach out via Slack DM with your GitHub username and Supabase email.

---

## 7. Troubleshooting

**`Error: supabaseUrl is required`**
Your `.env.local` file is missing or incorrectly named. Confirm the file is named `.env.local` (not `.env`) and that both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set.

**`Module not found` or missing packages**
Run `npm install`. If the issue persists:
```bash
rm -rf node_modules
npm install
```

**`401 Unauthorized` from Supabase**
Your anon key may be incorrect. Return to Supabase → Project Settings → API and re-copy the key into `.env.local`, then restart the dev server.

**Logged-in user routes to `/unauthorized`**
The `profiles` table may be missing a row for this user, or the `role` column may be incorrect. Check the `profiles` table in the Supabase dashboard.

**Temporary password works but user is stuck in a loop**
The `is_temporary_password` flag in the `profiles` table may not be updating on password change. Confirm PR #36 (First-Time Login Password Change Flow) is merged and deployed.

**Port 3000 is already in use**
```bash
npm run dev -- -p 3001
```

---

## 8. What to Read Next

Once your setup is verified, read these documents before writing any code:

- `DEVELOPER.md` — role management, database schema reference, development notes
- `docs/architecture.md` — auth flow, role routing, proposal-to-project lifecycle
- `docs/database-schema.md` — current deployed tables, RLS policies, relationships
- `docs/mvp.md` — product scope, MVP definition, what is and is not in scope

---

*Last updated: [Update on commit]*