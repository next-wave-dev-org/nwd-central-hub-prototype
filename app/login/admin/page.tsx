'use client'

import Navbar from '../../components/Navbar'
import RouteGuard from '../../components/RouteGuard'

export default function AdminDashboardPage() {
  return (
    <RouteGuard allowedRoles={['Admin']}>
      <Navbar />
    </RouteGuard>
  )
}
