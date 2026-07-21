'use client'

import Link from 'next/link'
import RouteGuard from '@/components/RouteGuard'
import Navbar from '@/components/Navbar'

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
  {
    href: '/login/client/projects',
    label: 'Active Projects',
    description: 'View your active projects',
    accent: 'var(--nwd-sky)',
    tag: 'VIEW',
  },
]

function ClientDashboardContent() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'white' }}>

      <Navbar breadcrumbs={[{ label: 'Client Dashboard' }]} />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-14">
        <div className="w-full max-w-md">

          <div className="mb-10">
            <p
              className="text-xs font-semibold tracking-widest mb-2"
              style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}
            >
              CLIENT
            </p>
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">
              What would you like to do?
            </h1>
          </div>

          <nav className="flex flex-col gap-3">
            {clientItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-5 rounded-lg px-5 py-4 border transition-colors hover:brightness-95"
                style={{ borderColor: item.accent, background: 'white' }}
              >
                <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: item.accent }} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-gray-900">{item.label}</span>
                    <span
                      className="text-xs font-semibold tracking-wider px-1.5 py-0.5 rounded"
                      style={{
                        color: item.accent,
                        background: `color-mix(in srgb, ${item.accent} 10%, transparent)`,
                        fontFamily: 'var(--font-geist-mono)',
                      }}
                    >
                      {item.tag}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">{item.description}</p>
                </div>

                <svg
                  className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0"
                  fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </Link>
            ))}
          </nav>

        </div>
      </main>

      <footer className="text-center py-6 px-4">
        <p
          className="text-xs tracking-wide"
          style={{ color: 'var(--nwd-purple)', opacity: 0.4, fontFamily: 'var(--font-geist-mono)' }}
        >
          NWD CENTRAL HUB
        </p>
      </footer>

    </div>
  )
}

export default function ClientDashboardPage() {
  return (
    <RouteGuard allowedRoles={['client']}>
      <ClientDashboardContent />
    </RouteGuard>
  )
}
