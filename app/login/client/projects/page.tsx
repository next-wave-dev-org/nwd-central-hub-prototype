'use client'

import RouteGuard from '@/components/RouteGuard'
import Navbar from '@/components/Navbar'

export default function ClientProjectsPage() {
  return (
    <RouteGuard allowedRoles={['client']}>
      <Navbar />
      <div className="p-8">
        <h1>Client Active Projects</h1>
      </div>
    </RouteGuard>
  )
}