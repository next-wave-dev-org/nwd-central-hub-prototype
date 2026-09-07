import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Only allow redirecting back to a relative path within this app
function safeNext(next: string | null): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    return next
  }
  return '/'
}

const NO_ACCOUNT_MESSAGE =
  'No account found for this email — sign in with your password first, then link this provider from Settings.'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))
  const errorDescription = searchParams.get('error_description') ?? searchParams.get('error')

  if (errorDescription) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorDescription)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Missing authorization code')}`)
  }

  // Collect cookie mutations from every Supabase call made during this
  // request (code exchange, and possibly a follow-up signOut) so they can
  // all be applied to whichever redirect response we end up sending.
  const pendingCookies: { name: string; value: string; options: CookieOptions }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet)
        },
      },
    }
  )

  const applyCookies = (response: NextResponse) => {
    pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    return response
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return applyCookies(
      NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error?.message ?? 'Sign-in failed')}`)
    )
  }

  // Sign-in (not linking — linking always reuses the already-authenticated
  // user, so a profile is guaranteed to exist) can land here with a brand
  // new auth.users row when the provider's email didn't match an existing
  // confirmed account closely enough for Supabase to auto-link. There's no
  // profiles row for that user because only admins create those — treat it
  // as a failed sign-in rather than letting it through to /unauthorized.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!profile) {
    const orphanedUserId = data.user.id
    await supabase.auth.signOut()
    await supabaseAdmin.auth.admin.deleteUser(orphanedUserId).catch(() => {})

    return applyCookies(
      NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(NO_ACCOUNT_MESSAGE)}`)
    )
  }

  return applyCookies(NextResponse.redirect(`${origin}${next}`))
}
