import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// A cookie-bound Supabase client for use inside 'use server' actions — lets a
// server action verify who's actually calling it (auth.getUser()) and query
// as that user (RLS-enforced), instead of trusting client-supplied identifiers.
export async function createActionSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )
}
