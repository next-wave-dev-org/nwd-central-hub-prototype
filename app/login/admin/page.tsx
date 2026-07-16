'use client'

import Link from 'next/link'
import Image from 'next/image'
import RouteGuard from '@/components/RouteGuard'

const adminItems = [
  {
    href: '/login/admin/proposals',
    label: 'Proposal Review',
    description: 'Review submitted proposals and approve or reject them',
    accent: 'var(--nwd-purple)',
    tag: 'PROPOSALS',
  },
  {
    href: '/login/admin/users',
    label: 'Manage Users',
    description: 'Create users and manage all clients and contractors',
    accent: 'var(--nwd-teal)',
    tag: 'USERS',
  },
  {
    href: '/login/admin/projects',
    label: 'Active Projects',
    description: 'View all active projects across the platform',
    accent: 'var(--nwd-purple)',
    tag: 'PROJECTS',
  },
]

function AdminDashboardContent() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'white' }}>

      <header className="bg-white border-b" style={{ borderColor: 'var(--nwd-border)' }}>
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Image
            src="/NextWaveDev_FINAL_small.png"
            alt="NextWaveDev logo"
            width={36}
            height={36}
            className="object-contain"
          />
          <div>
            <span className="font-semibold text-base tracking-tight" style={{ color: 'var(--nwd-purple)' }}>
              NextWaveDev
            </span>
            <span className="text-gray-400 mx-2 select-none">/</span>
            <span className="text-sm text-gray-500 font-medium">Admin Dashboard</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-14">
        <div className="w-full max-w-md">

          <div className="mb-10">
            <p
              className="text-xs font-semibold tracking-widest mb-2"
              style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}
            >
              ADMIN
            </p>
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">
              What would you like to do?
            </h1>
          </div>

          <nav className="flex flex-col gap-3">
            {adminItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-5 rounded-lg px-5 py-4 border transition-colors hover:brightness-95"
                style={{ borderColor: item.accent, background: 'white' }}
              >
                <div
                  className="w-1 self-stretch rounded-full flex-shrink-0"
                  style={{ background: item.accent }}
                />

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

export default function AdminDashboardPage() {
  return (
    <RouteGuard allowedRoles={['admin']}>
      <AdminDashboardContent />
    </RouteGuard>
  )
}