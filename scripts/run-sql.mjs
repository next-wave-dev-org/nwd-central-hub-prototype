// Runs a .sql file (or a query passed with --query) directly against the
// Supabase Postgres database, bypassing PostgREST/RLS entirely — for admins
// applying migrations or inspecting schema from the CLI.
//
// Usage:
//   npm run db:exec -- path/to/migration.sql
//   npm run db:exec -- --query "select proname from pg_proc where proname = 'approve_contractor_request'"
//
// Requires DATABASE_URL in .env.local (Supabase Dashboard -> Project Settings
// -> Database -> Connection string -> URI). Never commit that value.

import { readFileSync } from 'node:fs'
import { Client } from 'pg'

const args = process.argv.slice(2)

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add it to .env.local first.')
  process.exit(1)
}

let sql
if (args[0] === '--query') {
  sql = args[1]
} else {
  sql = readFileSync(args[0], 'utf8')
}

if (!sql) {
  console.error('Usage: npm run db:exec -- <file.sql>  |  npm run db:exec -- --query "<sql>"')
  process.exit(1)
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

await client.connect()

try {
  const result = await client.query(sql)
  const results = Array.isArray(result) ? result : [result]
  for (const r of results) {
    if (r.rows?.length) {
      console.table(r.rows)
    } else {
      console.log(`${r.command} OK (${r.rowCount ?? 0} row(s))`)
    }
  }
} finally {
  await client.end()
}
