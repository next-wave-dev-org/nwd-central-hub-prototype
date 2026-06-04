'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import RouteGuard from '@/components/RouteGuard'
import { createUser } from './create/actions'
import { getUsers, resetUserPassword } from './actions'
import type { UserRole, UserProfile } from '@/types/auth'

const ROLE_STYLES: Record<UserRole, { color: string; label: string }> = {
  contractor: { color: 'var(--nwd-teal)', label: 'Contractor' },
  client:     { color: 'var(--nwd-purple)', label: 'Client' },
  admin:      { color: '#6b7280', label: 'Admin' },
}

function RoleBadge({ role }: { role: UserRole }) {
  const { color, label } = ROLE_STYLES[role] ?? ROLE_STYLES.admin
  return (
    <span
      className="text-xs font-semibold tracking-wider px-2 py-0.5 rounded"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        fontFamily: 'var(--font-geist-mono)',
      }}
    >
      {label}
    </span>
  )
}

function StatusBadge({ pending }: { pending: boolean }) {
  return pending ? (
    <span
      className="text-xs font-semibold tracking-wider px-2 py-0.5 rounded"
      style={{
        color: '#92400e',
        background: 'color-mix(in srgb, #f59e0b 15%, transparent)',
        fontFamily: 'var(--font-geist-mono)',
      }}
    >
      Pending
    </span>
  ) : (
    <span
      className="text-xs font-semibold tracking-wider px-2 py-0.5 rounded"
      style={{
        color: '#065f46',
        background: 'color-mix(in srgb, #10b981 15%, transparent)',
        fontFamily: 'var(--font-geist-mono)',
      }}
    >
      Active
    </span>
  )
}

function ManageUsersContent() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('client')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<{ password: string; email: string } | null>(null)

  const [users, setUsers] = useState<UserProfile[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [usersError, setUsersError] = useState<string | null>(null)

  const [resetResult, setResetResult] = useState<{ password: string; email: string } | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resettingId, setResettingId] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    setUsersError(null)
    const result = await getUsers()
    if (result.success) {
      setUsers(result.users)
    } else {
      setUsersError(result.error)
    }
    setLoadingUsers(false)
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    setCreateSuccess(null)

    const result = await createUser(email, role, name)

    if (result.success) {
      setCreateSuccess({ password: result.temporaryPassword, email })
      setName('')
      setEmail('')
      setRole('client')
      await loadUsers()
    } else {
      setCreateError(result.error)
    }
    setCreating(false)
  }

  async function handleReset(user: UserProfile) {
    setResettingId(user.id)
    setResetResult(null)
    setResetError(null)

    const result = await resetUserPassword(user.id, user.email)

    if (result.success) {
      setResetResult({ password: result.temporaryPassword, email: user.email })
      await loadUsers()
    } else {
      setResetError(result.error)
    }
    setResettingId(null)
  }

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
          <div className="flex items-center flex-1 min-w-0">
            <span className="font-semibold text-base tracking-tight" style={{ color: 'var(--nwd-purple)' }}>
              NextWaveDev
            </span>
            <span className="text-gray-400 mx-2 select-none">/</span>
            <Link
              href="/login/admin"
              className="text-sm text-gray-500 font-medium hover:text-gray-700 transition-colors"
            >
              Admin Dashboard
            </Link>
            <span className="text-gray-400 mx-2 select-none">/</span>
            <span className="text-sm font-medium" style={{ color: 'var(--nwd-teal)' }}>
              Manage Users
            </span>
          </div>
          <Link
            href="/login/admin"
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 3L5 8l5 5" />
            </svg>
            Back
          </Link>
        </div>
      </header>

      <main className="flex-1 px-6 py-10">
        <div className="max-w-2xl mx-auto flex flex-col gap-10">

          {/* ── Create User ── */}
          <section>
            <p
              className="text-xs font-semibold tracking-widest mb-1"
              style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}
            >
              CREATE
            </p>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Add a new user</h2>

            {createSuccess && (
              <div
                className="mb-6 rounded-lg p-4 border"
                style={{ background: 'color-mix(in srgb, #10b981 8%, white)', borderColor: '#6ee7b7' }}
              >
                <p className="font-semibold text-sm text-emerald-800 mb-1">User created successfully!</p>
                <p className="text-sm text-emerald-700 mb-2">
                  A welcome email has been sent to <strong>{createSuccess.email}</strong>.
                  Share this temporary password as a backup:
                </p>
                <code
                  className="block rounded px-3 py-2 text-sm tracking-widest"
                  style={{
                    background: 'white',
                    border: '1px solid #6ee7b7',
                    fontFamily: 'var(--font-geist-mono)',
                    color: '#065f46',
                  }}
                >
                  {createSuccess.password}
                </code>
              </div>
            )}

            {createError && (
              <div
                className="mb-6 rounded-lg p-4 border text-sm"
                style={{ background: 'color-mix(in srgb, #f43f5e 8%, white)', borderColor: '#fda4af', color: '#9f1239' }}
              >
                {createError}
              </div>
            )}

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700" htmlFor="name">Name</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Full name"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                  style={{ borderColor: 'var(--nwd-border)', focusRingColor: 'var(--nwd-teal)' } as React.CSSProperties}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700" htmlFor="create-email">Email</label>
                <input
                  id="create-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="user@example.com"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                  style={{ borderColor: 'var(--nwd-border)' }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700" htmlFor="role">Role</label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 bg-white"
                  style={{ borderColor: 'var(--nwd-border)' }}
                >
                  <option value="client">Client</option>
                  <option value="contractor">Contractor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                style={{ background: 'var(--nwd-teal)' }}
              >
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </form>
          </section>

          {/* ── Divider ── */}
          <hr style={{ borderColor: 'var(--nwd-border)' }} />

          {/* ── All Users ── */}
          <section>
            <p
              className="text-xs font-semibold tracking-widest mb-1"
              style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}
            >
              ALL USERS
            </p>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Registered users</h2>

            {resetResult && (
              <div
                className="mb-6 rounded-lg p-4 border"
                style={{ background: 'color-mix(in srgb, #10b981 8%, white)', borderColor: '#6ee7b7' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-emerald-800 mb-1">Password reset successfully.</p>
                    <p className="text-sm text-emerald-700 mb-2">
                      An email has been sent to <strong>{resetResult.email}</strong>. Temporary password backup:
                    </p>
                    <code
                      className="block rounded px-3 py-2 text-sm tracking-widest"
                      style={{
                        background: 'white',
                        border: '1px solid #6ee7b7',
                        fontFamily: 'var(--font-geist-mono)',
                        color: '#065f46',
                      }}
                    >
                      {resetResult.password}
                    </code>
                  </div>
                  <button
                    onClick={() => setResetResult(null)}
                    className="text-emerald-600 hover:text-emerald-800 text-lg leading-none flex-shrink-0"
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            {resetError && (
              <div
                className="mb-6 rounded-lg p-4 border text-sm flex items-start justify-between gap-2"
                style={{ background: 'color-mix(in srgb, #f43f5e 8%, white)', borderColor: '#fda4af', color: '#9f1239' }}
              >
                <span>{resetError}</span>
                <button onClick={() => setResetError(null)} className="text-rose-400 hover:text-rose-600 text-lg leading-none flex-shrink-0" aria-label="Dismiss">×</button>
              </div>
            )}

            {loadingUsers ? (
              <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
                Loading users…
              </div>
            ) : usersError ? (
              <div
                className="rounded-lg p-4 border text-sm"
                style={{ background: 'color-mix(in srgb, #f43f5e 8%, white)', borderColor: '#fda4af', color: '#9f1239' }}
              >
                {usersError}
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">No users found.</div>
            ) : (
              <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--nwd-border)' }}>
                <table className="min-w-full divide-y" style={{ borderColor: 'var(--nwd-border)' }}>
                  <thead>
                    <tr style={{ background: 'var(--nwd-surface)' }}>
                      {['Name', 'Email', 'Role', 'Status', 'Actions'].map((col) => (
                        <th
                          key={col}
                          className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-gray-500"
                          style={{ fontFamily: 'var(--font-geist-mono)' }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y" style={{ borderColor: 'var(--nwd-border)' }}>
                    {users.map((user) => {
                      const isPending = user.is_temporary_password ?? false
                      const isResetting = resettingId === user.id
                      const anyResetting = resettingId !== null

                      return (
                        <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                            {user.name ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                            {user.email}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <RoleBadge role={user.role} />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusBadge pending={isPending} />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <button
                              onClick={() => handleReset(user)}
                              disabled={anyResetting}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{
                                borderColor: 'var(--nwd-teal)',
                                color: isResetting ? '#6b7280' : 'var(--nwd-teal)',
                                background: isResetting
                                  ? 'color-mix(in srgb, #6b7280 8%, white)'
                                  : 'color-mix(in srgb, var(--nwd-teal) 8%, white)',
                              }}
                            >
                              {isResetting
                                ? 'Sending…'
                                : isPending
                                ? 'Resend Invitation'
                                : 'Reset Password'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

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

export default function ManageUsersPage() {
  return (
    <RouteGuard allowedRoles={['admin']}>
      <ManageUsersContent />
    </RouteGuard>
  )
}
