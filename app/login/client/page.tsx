'use client'

import Link from 'next/link'
import Image from 'next/image'
import Navbar from '@/components/Navbar'
import RouteGuard from '@/components/RouteGuard'

const clientItems = [
  {
    href: '/login/client/proposals/new',
    label: 'Create Proposal',
    description: 'Submit a new project proposal',
    accent: 'var(--nwd-teal)',
    tag: 'NEW',
  },
  {
    href: '/login/client/proposals',
    label: 'My Proposals',
    description: 'View proposal submissions',
    accent: 'var(--nwd-purple)',
    tag: 'VIEW',
  },
]




export default function ClientDashboardPage() {
  return (
    <RouteGuard allowedRoles={['client']}>

      <Navbar />

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">
          Client Dashboard
        </h1>

        <div className="grid gap-4">
          <Link
            href="/login/client/proposals/new"
            className="block p-6 border rounded-lg shadow hover:shadow-md transition"
          >
            <h2 className="font-bold text-lg">Create New Proposal</h2>
            <p>Submit a new project proposal.</p>
          </Link>

          <Link
            href="/login/client/proposals"
            className="block p-6 border rounded-lg shadow hover:shadow-md transition"
          >
            <h2 className="font-bold text-lg">Proposal Submissions</h2>
            <p>View your submitted proposals.</p>
          </Link>

          <Link
            href="/login/client/projects"
            className="block p-6 border rounded-lg shadow hover:shadow-md transition"
          >
            <h2 className="font-bold text-lg">Active Projects</h2>
            <p>View active projects.</p>
          </Link>
        </div>
      </main>
    </RouteGuard>
  )
}
