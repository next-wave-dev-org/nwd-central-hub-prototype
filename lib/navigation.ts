import type { UserRole } from '@/types/auth'

const DASHBOARDS: Record<UserRole, string> = {
  admin: '/login/admin',
  contractor: '/login/contractor',
  client: '/login/client',
}

/**
 * The signed-in user's own dashboard. The Navbar brand links here so every page
 * — including ones shared across roles, like profile and settings — points back
 * to the dashboard that user actually came from. Undefined while the profile is
 * still loading, which leaves the brand unlinked rather than guessing.
 */
export function dashboardHref(role?: UserRole): string | undefined {
  return role ? DASHBOARDS[role] : undefined
}
