'use client'

import Link from 'next/link'
import Navbar from '@/components/Navbar'
import RouteGuard from '@/components/RouteGuard'

function AdminContent() {
  return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <main className="max-w-4xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-bold mb-8">
            Admin Dashboard
          </h1>

          <div className="grid gap-4">
            <Link
                href="/login/admin/proposals"
                className="block p-6 border rounded-lg shadow hover:shadow-md transition"
            >
              <h2 className="font-bold text-lg">Proposal Review</h2>
              <p>Review submitted proposals and approve or reject them.</p>
            </Link>

            <Link
                href="/login/admin/users/create"
                className="block p-6 border rounded-lg shadow hover:shadow-md transition"
            >
              <h2 className="font-bold text-lg">Create User</h2>
              <p>Invite a new client, contractor, or admin to the platform.</p>
            </Link>
          </div>
        </main>
      </div>
  )
}

export default function AdminPage() {
  return (
      <RouteGuard allowedRoles={['admin']}>
        <AdminContent />
      </RouteGuard>
  )
}