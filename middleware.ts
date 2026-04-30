import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import type { UserRole } from '@/types/auth'

// Routes that require a specific role — also covers all sub-paths
const ROLE_ROUTES: { prefix: string; role: UserRole }[] = [
  { prefix: '/admin', role: 'Admin' },
  { prefix: '/client', role: 'Client' },
  { prefix: '/contractor', role: 'Contractor' },
  { prefix: '/login/admin', role: 'Admin' },
  { prefix: '/login/client', role: 'Client' },
  { prefix: '/login/contractor', role: 'Contractor' },
]

// Routes that require authentication but no specific role
const AUTHENTICATED_PREFIXES = ['/proposals']

// Routes that anyone (including unauthenticated users) can access
const PUBLIC_ROUTES = new Set(['/', '/login', '/unauthorized', '/test-supabase'])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Pass through public routes immediately
  if (PUBLIC_ROUTES.has(pathname)) {
    return NextResponse.next()
  }

  // Build response so cookies can be forwarded
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Unauthenticated users cannot access any non-public route
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect authenticated users away from /login to their own dashboard
  if (pathname === '/login') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const dashboardMap: Record<string, string> = {
      Admin: '/login/admin',
      Client: '/login/client',
      Contractor: '/login/contractor',
    }
    const destination = dashboardMap[profile?.role ?? ''] ?? '/'
    return NextResponse.redirect(new URL(destination, request.url))
  }

  // Check if this route requires a specific role
  const roleRoute = ROLE_ROUTES.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(prefix + '/')
  )

  const requiresAuth = AUTHENTICATED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  )

  if (roleRoute || requiresAuth) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }

    if (roleRoute && profile.role !== roleRoute.role) {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
