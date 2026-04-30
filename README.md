# NWD Central Hub

The Next Wave Dev Central Hub is a unified platform designed to streamline how contractors, clients, and administrators collaborate on real technical projects. Currently, the onboarding and coordination process is manual and slow, limiting the number of contractors who can be supported. This project solves that problem by creating a centralized system where projects, communication, deliverables, and user roles are all managed efficiently. The primary users are graduates (contractors), client companies, and the Next Wave Dev nonprofit team.

> **View the live app:** [nwd-central-hub-prototype.vercel.app](https://nwd-central-hub-prototype.vercel.app)

---

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Backend/Auth:** [Supabase](https://supabase.com/)
- **Package Manager:** npm
- **Node Version:** 20.x

---

## Prerequisites

Before you begin, make sure you have the following installed:

- [Node.js](https://nodejs.org/) v20 or higher
- npm (comes bundled with Node.js)
- A [Supabase](https://supabase.com/) account (free tier is fine)

To check your Node version:

```bash
node -v
```

If you need to manage multiple Node versions, use [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install 20
nvm use 20
```

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/NextWaveDev/nwd-central-hub-prototype.git
cd nwd-central-hub-prototype
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env.local
```

Open `.env.local` and add your Supabase credentials (see [Connect to Supabase](#connect-to-supabase) below).

### 4. Run the development server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

---

## Connect to Supabase

This app uses Supabase for its database and authentication. Follow these steps to get your credentials:

1. Go to [https://supabase.com](https://supabase.com) and sign in or create a free account.
2. Create a new project (or use an existing one shared by the team).
3. Once the project is ready, navigate to **Project Settings → API**.
4. Copy the following values into your `.env.local` file:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → `anon` / `public` key |

Your `.env.local` should look like this when complete:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

> **Note:** Never commit `.env.local` to version control. It is already listed in `.gitignore`.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the local development server |
| `npm run build` | Build the app for production |
| `npm run start` | Start the production server (after build) |
| `npm run lint` | Run ESLint across the project |

---

## Documentation

- Developer Guide → see `DEVELOPER.md`
- Database Setup → see `/docs/database-setup.md`

---

## Project Structure

```
nwd-central-hub-prototype/
├── app/                  # Next.js App Router pages and layouts
│   ├── admin/            # Admin dashboard page
│   ├── login/            # Login pages per role (admin, client, contractor)
│   ├── proposals/        # Proposals listing and creation
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Landing page
├── components/           # Reusable UI components (Navbar, etc.)
├── lib/                  # Supabase client and helper logic
├── docs/                 # Additional documentation (database setup, etc.)
├── public/               # Static assets
├── .env.example          # Environment variable template
└── package.json
```

---

## Troubleshooting

### `Error: supabaseUrl is required`
Your `.env.local` file is missing or the variable names are incorrect. Double-check that both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set and that the file is named `.env.local` (not `.env`).

### `Module not found` or missing packages
Run `npm install` again. If the issue persists, delete `node_modules` and reinstall:

```bash
rm -rf node_modules
npm install
```

### Port 3000 is already in use
Run the dev server on a different port:

```bash
npm run dev -- -p 3001
```

### TypeScript errors on startup
Make sure you are on Node 20. Some type definitions in this project require it. Run `node -v` to confirm.

### Supabase requests returning `401 Unauthorized`
Your anon key may be incorrect or expired. Return to **Supabase → Project Settings → API** and re-copy the key into `.env.local`, then restart the dev server.