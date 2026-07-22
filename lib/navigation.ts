import type { UserRole } from '@/types/auth'
import type { NavbarBreadcrumb } from '@/components/Navbar'

const DASHBOARDS: Record<UserRole, NavbarBreadcrumb> = {
  admin: { label: 'Admin Dashboard', href: '/login/admin' },
  contractor: { label: 'Contractor Dashboard', href: '/login/contractor' },
  client: { label: 'Client Dashboard', href: '/login/client' },
}

/**
 * The breadcrumb pointing at the signed-in user's own dashboard. Pages shared
 * across roles (profile, settings) use this so the crumb names — and links to —
 * the dashboard that user actually came from. Falls back to a generic,
 * unlinked crumb while the profile is still loading.
 */
export function dashboardBreadcrumb(role?: UserRole): NavbarBreadcrumb {
  return role ? DASHBOARDS[role] : { label: 'Dashboard' }
}
