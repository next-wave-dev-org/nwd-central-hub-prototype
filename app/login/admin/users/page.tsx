'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import RouteGuard from '@/components/RouteGuard'
import { useAuth } from '@/components/AuthProvider'
import { createUser } from './create/actions'
import {
  getUsers, resetUserPassword, deleteUser,
  updateUser, bulkDeleteUsers, bulkChangeRole, bulkResendInvite,
} from './actions'
import type { UserRole, UserProfile } from '@/types/auth'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 0] // 0 = All

const ROLE_STYLES: Record<UserRole, { color: string; label: string }> = {
  contractor: { color: 'var(--nwd-teal)', label: 'Contractor' },
  client:     { color: 'var(--nwd-purple)', label: 'Client' },
  admin:      { color: '#6b7280', label: 'Admin' },
}

type SortCol = 'name' | 'email' | 'role' | 'status' | 'created'
type SortDir = 'asc' | 'desc'

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

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol | null; sortDir: SortDir }) {
  const active = sortCol === col
  const color = active ? 'var(--nwd-teal)' : '#d1d5db'
  return (
    <svg className="inline-block ml-1 w-3 h-3 flex-shrink-0" viewBox="0 0 10 12" fill="none" aria-hidden>
      <path d="M5 1L2 4.5h6L5 1z" fill={active && sortDir === 'asc' ? color : '#d1d5db'} />
      <path d="M5 11L8 7.5H2L5 11z" fill={active && sortDir === 'desc' ? color : '#d1d5db'} />
    </svg>
  )
}

function ManageUsersContent() {
  const { profile: currentUser } = useAuth()
  const headerCheckboxRef = useRef<HTMLInputElement>(null)

  // ── Create form ──
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('client')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<{ password: string; email: string } | null>(null)

  // ── Users list ──
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [usersError, setUsersError] = useState<string | null>(null)

  // ── Per-user actions ──
  const [resetResult, setResetResult] = useState<{ password: string; email: string } | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null)

  // ── Table controls ──
  const [searchRaw, setSearchRaw] = useState('')
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<SortCol | null>('created')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── Bulk selection ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkRole, setBulkRole] = useState<UserRole>('client')
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null)
  const [bulkError, setBulkError] = useState<string | null>(null)

  // ── Inline editing ──
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('client')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // ── Debounced search ──
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchRaw), 300)
    return () => clearTimeout(timer)
  }, [searchRaw])

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

  useEffect(() => { loadUsers() }, [loadUsers])

  // Reset page and clear selection on search/sort change
  useEffect(() => { setPage(0); setSelectedIds(new Set()) }, [search, sortCol, sortDir])

  // Reset page on page size change
  useEffect(() => { setPage(0) }, [pageSize])

  // Sync header checkbox indeterminate state
  const filteredSortedUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    let result = q
      ? users.filter(
          (u) =>
            (u.name ?? '').toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            u.role.toLowerCase().includes(q)
        )
      : [...users]

    if (sortCol) {
      result.sort((a, b) => {
        let av = '', bv = ''
        if (sortCol === 'name')    { av = (a.name ?? '').toLowerCase(); bv = (b.name ?? '').toLowerCase() }
        if (sortCol === 'email')   { av = (a.email ?? '').toLowerCase(); bv = (b.email ?? '').toLowerCase() }
        if (sortCol === 'role')    { av = a.role ?? '';                  bv = b.role ?? '' }
        if (sortCol === 'status')  { av = a.is_temporary_password ? '1' : '0'; bv = b.is_temporary_password ? '1' : '0' }
        if (sortCol === 'created') { av = a.created_at ?? ''; bv = b.created_at ?? '' }
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    }
    return result
  }, [users, search, sortCol, sortDir])

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredSortedUsers.length / pageSize))
  const pagedUsers = pageSize === 0
    ? filteredSortedUsers
    : filteredSortedUsers.slice(page * pageSize, (page + 1) * pageSize)

  // Selection helpers
  const isPageFullySelected = pagedUsers.length > 0 && pagedUsers.every(u => selectedIds.has(u.id))
  const isPagePartiallySelected = pagedUsers.some(u => selectedIds.has(u.id)) && !isPageFullySelected
  const isAllFilteredSelected = filteredSortedUsers.length > 0 && filteredSortedUsers.every(u => selectedIds.has(u.id))

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isPagePartiallySelected
    }
  }, [isPagePartiallySelected])

  function toggleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  function toggleSelectPage() {
    if (isPageFullySelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        pagedUsers.forEach(u => next.delete(u.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        pagedUsers.forEach(u => next.add(u.id))
        return next
      })
    }
  }

  function toggleSelectUser(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllFiltered() {
    setSelectedIds(new Set(filteredSortedUsers.map(u => u.id)))
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (role === 'admin' && !confirm(`Grant admin access to ${name || email}? Admins can create and delete users.`)) return
    setCreating(true)
    setCreateError(null)
    setCreateSuccess(null)
    const result = await createUser(email, role, name)
    if (result.success) {
      setCreateSuccess({ password: result.temporaryPassword, email })
      setName('')
      setEmail('')
      setRole('client')
      setPage(0)
      await loadUsers()
    } else {
      setCreateError(result.error)
    }
    setCreating(false)
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => {
      if (prev !== id) {
        setEditingId(null)
        setEditError(null)
      }
      return prev === id ? null : id
    })
  }

  async function handleDelete(user: UserProfile) {
    if (!confirm(`Delete ${user.name ?? user.email}? This cannot be undone.`)) return
    setDeletingId(user.id)
    setDeleteError(null)
    try {
      const result = await deleteUser(user.id)
      if (result.success) {
        setExpandedId(null)
        setDeleteError(null)
        await loadUsers()
      } else {
        setDeleteError({ id: user.id, message: result.error })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error — the user may have been deleted. Refresh to confirm.'
      setDeleteError({ id: user.id, message: msg })
      await loadUsers()
    } finally {
      setDeletingId(null)
    }
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

  function startEdit(user: UserProfile) {
    setEditingId(user.id)
    setEditName(user.name ?? '')
    setEditEmail(user.email)
    setEditRole(user.role)
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError(null)
  }

  async function handleSaveEdit(user: UserProfile) {
    if (editRole === 'admin' && user.role !== 'admin') {
      if (!confirm(`Grant admin access to ${editName || editEmail}?`)) return
    }
    const prev = [...users]
    // Optimistic update
    setUsers(users.map(u =>
      u.id === user.id ? { ...u, name: editName, email: editEmail, role: editRole } : u
    ))
    setEditingId(null)
    setEditSaving(true)

    const result = await updateUser(user.id, { name: editName, email: editEmail, role: editRole })

    if (!result.success) {
      setUsers(prev) // rollback
      setEditingId(user.id) // re-open
      setEditError(result.error)
    }
    setEditSaving(false)
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds].filter(id => id !== currentUser?.id)
    if (ids.length === 0) { setBulkError('Cannot delete your own account.'); return }
    if (selectedIds.has(currentUser?.id ?? '')) {
      if (!confirm(`Your own account was excluded. Delete the remaining ${ids.length} user${ids.length !== 1 ? 's' : ''}?`)) return
    } else {
      if (!confirm(`Permanently delete ${ids.length} user${ids.length !== 1 ? 's' : ''}? This cannot be undone.`)) return
    }

    const prev = [...users]
    setUsers(users.filter(u => !ids.includes(u.id)))
    setSelectedIds(new Set())
    setBulkActionLoading(true)
    setBulkError(null)
    setBulkSuccess(null)

    const result = await bulkDeleteUsers(ids)
    if (!result.success) {
      setUsers(prev)
      setBulkError(result.error)
    } else {
      setBulkSuccess(`Deleted ${result.deleted} user${result.deleted !== 1 ? 's' : ''}`)
    }
    setBulkActionLoading(false)
  }

  async function handleBulkChangeRole() {
    const ids = [...selectedIds]
    if (bulkRole === 'admin' && !confirm(`Grant admin access to ${ids.length} user${ids.length !== 1 ? 's' : ''}?`)) return
    else if (bulkRole !== 'admin' && !confirm(`Change role to ${bulkRole} for ${ids.length} user${ids.length !== 1 ? 's' : ''}?`)) return

    const prev = [...users]
    setUsers(users.map(u => ids.includes(u.id) ? { ...u, role: bulkRole } : u))
    setBulkActionLoading(true)
    setBulkError(null)
    setBulkSuccess(null)

    const result = await bulkChangeRole(ids, bulkRole)
    if (!result.success) {
      setUsers(prev)
      setBulkError(result.error)
    } else {
      setSelectedIds(new Set())
      setBulkSuccess(`Updated role for ${ids.length} user${ids.length !== 1 ? 's' : ''}`)
    }
    setBulkActionLoading(false)
  }

  async function handleBulkResendInvite() {
    const ids = [...selectedIds]
    if (!confirm(`Send invite to ${ids.length} user${ids.length !== 1 ? 's' : ''}?`)) return

    setBulkActionLoading(true)
    setBulkError(null)
    setBulkSuccess(null)

    const result = await bulkResendInvite(ids)
    if (!result.success) {
      setBulkError(result.error)
    } else {
      setSelectedIds(new Set())
      setBulkSuccess(`Sent invite to ${result.sent} user${result.sent !== 1 ? 's' : ''}`)
      await loadUsers()
    }
    setBulkActionLoading(false)
  }

  const COLUMNS: { label: string; key: SortCol | null }[] = [
    { label: 'Name',       key: 'name' },
    { label: 'Email',      key: 'email' },
    { label: 'Role',       key: 'role' },
    { label: 'Status',     key: 'status' },
    { label: 'Created At', key: 'created' },
  ]

  const inputCls = 'w-full rounded-lg border px-3 py-1.5 text-xs outline-none focus:ring-2 bg-white'
  const inputStyle = { borderColor: 'var(--nwd-border)' }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'white' }}>

      <header className="bg-white border-b" style={{ borderColor: 'var(--nwd-border)' }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <Image src="/NextWaveDev_FINAL_small.png" alt="NextWaveDev logo" width={36} height={36} className="object-contain" />
          <div className="flex items-center flex-1 min-w-0">
            <span className="font-semibold text-base tracking-tight" style={{ color: 'var(--nwd-purple)' }}>NextWaveDev</span>
            <span className="text-gray-400 mx-2 select-none">/</span>
            <Link href="/login/admin" className="text-sm text-gray-500 font-medium hover:text-gray-700 transition-colors">Admin Dashboard</Link>
            <span className="text-gray-400 mx-2 select-none">/</span>
            <span className="text-sm font-medium" style={{ color: 'var(--nwd-teal)' }}>Manage Users</span>
          </div>
          <Link href="/login/admin" className="text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 3L5 8l5 5" />
            </svg>
            Back
          </Link>
        </div>
      </header>

      <main className="flex-1 px-6 py-10">
        <div className="max-w-5xl mx-auto flex flex-col gap-10">

          {/* ── Create User ── */}
          <section>
            <p className="text-xs font-semibold tracking-widest mb-1" style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}>CREATE</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Add a new user</h2>

            {createSuccess && (
              <div className="mb-6 rounded-lg p-4 border" style={{ background: 'color-mix(in srgb, #10b981 8%, white)', borderColor: '#6ee7b7' }}>
                <p className="font-semibold text-sm text-emerald-800 mb-1">User created successfully!</p>
                <p className="text-sm text-emerald-700 mb-2">
                  A welcome email has been sent to <strong>{createSuccess.email}</strong>. Share this temporary password as a backup:
                </p>
                <code className="block rounded px-3 py-2 text-sm tracking-widest" style={{ background: 'white', border: '1px solid #6ee7b7', fontFamily: 'var(--font-geist-mono)', color: '#065f46' }}>
                  {createSuccess.password}
                </code>
              </div>
            )}

            {createError && (
              <div className="mb-6 rounded-lg p-4 border text-sm" style={{ background: 'color-mix(in srgb, #f43f5e 8%, white)', borderColor: '#fda4af', color: '#9f1239' }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700" htmlFor="name">Name</label>
                <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Full name"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2" style={{ borderColor: 'var(--nwd-border)' }} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700" htmlFor="create-email">Email</label>
                <input id="create-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="user@example.com"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2" style={{ borderColor: 'var(--nwd-border)' }} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700" htmlFor="role">Role</label>
                <select id="role" value={role} onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 bg-white" style={{ borderColor: 'var(--nwd-border)' }}>
                  <option value="client">Client</option>
                  <option value="contractor">Contractor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex flex-col justify-end">
                <button type="submit" disabled={creating}
                  className="w-full rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                  style={{ background: 'var(--nwd-teal)' }}>
                  {creating ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </section>

          {/* ── Divider ── */}
          <hr style={{ borderColor: 'var(--nwd-border)' }} />

          {/* ── All Users ── */}
          <section>
            <p className="text-xs font-semibold tracking-widest mb-1" style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}>ALL USERS</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Registered users</h2>

            {resetResult && (
              <div className="mb-6 rounded-lg p-4 border" style={{ background: 'color-mix(in srgb, #10b981 8%, white)', borderColor: '#6ee7b7' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-emerald-800 mb-1">Password reset successfully.</p>
                    <p className="text-sm text-emerald-700 mb-2">An email has been sent to <strong>{resetResult.email}</strong>. Temporary password backup:</p>
                    <code className="block rounded px-3 py-2 text-sm tracking-widest" style={{ background: 'white', border: '1px solid #6ee7b7', fontFamily: 'var(--font-geist-mono)', color: '#065f46' }}>
                      {resetResult.password}
                    </code>
                  </div>
                  <button onClick={() => setResetResult(null)} className="text-emerald-600 hover:text-emerald-800 text-lg leading-none flex-shrink-0" aria-label="Dismiss">×</button>
                </div>
              </div>
            )}

            {resetError && (
              <div className="mb-6 rounded-lg p-4 border text-sm flex items-start justify-between gap-2"
                style={{ background: 'color-mix(in srgb, #f43f5e 8%, white)', borderColor: '#fda4af', color: '#9f1239' }}>
                <span>{resetError}</span>
                <button onClick={() => setResetError(null)} className="text-rose-400 hover:text-rose-600 text-lg leading-none flex-shrink-0" aria-label="Dismiss">×</button>
              </div>
            )}

            {bulkSuccess && (
              <div className="mb-4 rounded-lg p-3 border text-sm flex items-center justify-between gap-2"
                style={{ background: 'color-mix(in srgb, #10b981 8%, white)', borderColor: '#6ee7b7', color: '#065f46' }}>
                <span>{bulkSuccess}</span>
                <button onClick={() => setBulkSuccess(null)} className="text-emerald-600 hover:text-emerald-800 text-lg leading-none flex-shrink-0" aria-label="Dismiss">×</button>
              </div>
            )}

            {bulkError && (
              <div className="mb-4 rounded-lg p-3 border text-sm flex items-center justify-between gap-2"
                style={{ background: 'color-mix(in srgb, #f43f5e 8%, white)', borderColor: '#fda4af', color: '#9f1239' }}>
                <span>{bulkError}</span>
                <button onClick={() => setBulkError(null)} className="text-rose-400 hover:text-rose-600 text-lg leading-none flex-shrink-0" aria-label="Dismiss">×</button>
              </div>
            )}

            {/* Search bar */}
            <div className="mb-3 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
                <circle cx="6.5" cy="6.5" r="4" />
                <path strokeLinecap="round" d="M11 11l2.5 2.5" />
              </svg>
              <input
                type="search"
                placeholder="Search by name, email, or role…"
                value={searchRaw}
                onChange={(e) => setSearchRaw(e.target.value)}
                className="w-full rounded-lg border pl-9 pr-3 py-2 text-sm outline-none focus:ring-2"
                style={{ borderColor: 'var(--nwd-border)' }}
              />
            </div>

            {/* Bulk action toolbar */}
            {selectedIds.size > 0 && (
              <div className="mb-3 rounded-lg border p-3 flex items-center gap-3 flex-wrap"
                style={{ borderColor: 'var(--nwd-border)', background: 'var(--nwd-surface)' }}>
                <span className="text-xs font-semibold text-gray-700" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                  {selectedIds.size} selected
                </span>
                {!isAllFilteredSelected && (
                  <button onClick={selectAllFiltered} className="text-xs font-medium underline underline-offset-2"
                    style={{ color: 'var(--nwd-teal)' }}>
                    Select all {filteredSortedUsers.length}
                  </button>
                )}
                <button onClick={clearSelection} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  Clear
                </button>
                <div className="flex-1" />
                {/* Bulk role change */}
                <div className="flex items-center gap-2">
                  <select
                    value={bulkRole}
                    onChange={(e) => setBulkRole(e.target.value as UserRole)}
                    disabled={bulkActionLoading}
                    className="rounded-lg border px-2 py-1.5 text-xs outline-none focus:ring-2 bg-white disabled:opacity-50"
                    style={{ borderColor: 'var(--nwd-border)' }}
                  >
                    <option value="client">Client</option>
                    <option value="contractor">Contractor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    onClick={handleBulkChangeRole}
                    disabled={bulkActionLoading}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:brightness-90 active:brightness-75 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
                    style={{ borderColor: 'var(--nwd-purple)', color: 'var(--nwd-purple)', background: `color-mix(in srgb, var(--nwd-purple) 8%, white)` }}
                  >
                    Change Role
                  </button>
                </div>
                <button
                  onClick={handleBulkResendInvite}
                  disabled={bulkActionLoading}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:brightness-90 active:brightness-75 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
                  style={{ borderColor: 'var(--nwd-teal)', color: 'var(--nwd-teal)', background: `color-mix(in srgb, var(--nwd-teal) 8%, white)` }}
                >
                  {bulkActionLoading ? 'Working…' : 'Send Invite'}
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkActionLoading}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:brightness-90 active:brightness-75 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
                  style={{ borderColor: '#f43f5e', color: '#f43f5e', background: `color-mix(in srgb, #f43f5e 8%, white)` }}
                >
                  Delete
                </button>
              </div>
            )}

            {/* Pagination controls */}
            {!loadingUsers && !usersError && filteredSortedUsers.length > 0 && (
              <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <p className="text-xs text-gray-400" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                    {filteredSortedUsers.length} user{filteredSortedUsers.length !== 1 ? 's' : ''}
                    {search && ' matching'}
                    {pageSize !== 0 && ` · page ${page + 1} of ${totalPages}`}
                  </p>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="rounded-md border px-2 py-1 text-xs outline-none focus:ring-2 bg-white"
                    style={{ borderColor: 'var(--nwd-border)', fontFamily: 'var(--font-geist-mono)' }}
                  >
                    {PAGE_SIZE_OPTIONS.map(s => (
                      <option key={s} value={s}>{s === 0 ? 'All' : s} / page</option>
                    ))}
                  </select>
                </div>
                {pageSize !== 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ borderColor: 'var(--nwd-border)', color: 'var(--nwd-purple)' }}
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ borderColor: 'var(--nwd-border)', color: 'var(--nwd-purple)' }}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}

            {loadingUsers ? (
              <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading users…</div>
            ) : usersError ? (
              <div className="rounded-lg p-4 border text-sm" style={{ background: 'color-mix(in srgb, #f43f5e 8%, white)', borderColor: '#fda4af', color: '#9f1239' }}>
                {usersError}
              </div>
            ) : filteredSortedUsers.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">
                {search ? 'No users match your search.' : 'No users found.'}
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto" style={{ borderColor: 'var(--nwd-border)' }}>
                <table className="min-w-full divide-y" style={{ borderColor: 'var(--nwd-border)' }}>
                  <thead>
                    <tr style={{ background: 'var(--nwd-surface)' }}>
                      {/* Checkbox column */}
                      <th className="px-4 py-3 w-10">
                        <input
                          ref={headerCheckboxRef}
                          type="checkbox"
                          checked={isPageFullySelected}
                          onChange={toggleSelectPage}
                          className="rounded cursor-pointer accent-[var(--nwd-teal)]"
                          aria-label="Select all on page"
                        />
                      </th>
                      {COLUMNS.map(({ label, key }) => (
                        <th
                          key={label}
                          className={[
                            'px-4 py-3 text-left text-xs font-semibold tracking-wider text-gray-500 whitespace-nowrap',
                            key ? 'cursor-pointer select-none hover:text-gray-700' : '',
                          ].join(' ')}
                          style={{ fontFamily: 'var(--font-geist-mono)' }}
                          onClick={() => key && toggleSort(key)}
                        >
                          {label}
                          {key && <SortIcon col={key} sortCol={sortCol} sortDir={sortDir} />}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y" style={{ borderColor: 'var(--nwd-border)' }}>
                    {pagedUsers.map((user) => {
                      const isPending = user.is_temporary_password ?? false
                      const isExpanded = expandedId === user.id
                      const isSelected = selectedIds.has(user.id)
                      const isResetting = resettingId === user.id
                      const isDeleting = deletingId === user.id
                      const anyBusy = resettingId !== null || deletingId !== null
                      const isSelf = currentUser?.id === user.id
                      const isEditing = editingId === user.id
                      const createdAt = user.created_at
                        ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'

                      return (
                        <React.Fragment key={user.id}>
                          {/* User row */}
                          <tr
                            onClick={() => toggleExpand(user.id)}
                            className="cursor-pointer transition-colors"
                            style={{ background: isExpanded ? 'color-mix(in srgb, var(--nwd-teal) 5%, white)' : isSelected ? 'color-mix(in srgb, var(--nwd-teal) 3%, white)' : undefined }}
                            onMouseEnter={(e) => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'var(--nwd-surface)' }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isExpanded ? 'color-mix(in srgb, var(--nwd-teal) 5%, white)' : isSelected ? 'color-mix(in srgb, var(--nwd-teal) 3%, white)' : '' }}
                          >
                            {/* Checkbox cell */}
                            <td className="px-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectUser(user.id)}
                                className="rounded cursor-pointer accent-[var(--nwd-teal)]"
                                aria-label={`Select ${user.name ?? user.email}`}
                              />
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <svg
                                  className="w-3 h-3 flex-shrink-0 transition-transform"
                                  style={{ color: isExpanded ? 'var(--nwd-teal)' : '#d1d5db', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                                  fill="none" viewBox="0 0 8 12" stroke="currentColor" strokeWidth="2"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 2l4 4-4 4" />
                                </svg>
                                {user.name ?? '—'}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{user.email}</td>
                            <td className="px-4 py-3 whitespace-nowrap"><RoleBadge role={user.role} /></td>
                            <td className="px-4 py-3 whitespace-nowrap"><StatusBadge pending={isPending} /></td>
                            <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                              {createdAt}
                            </td>
                          </tr>

                          {/* Expanded action row */}
                          {isExpanded && (
                            <tr style={{ background: 'color-mix(in srgb, var(--nwd-teal) 5%, white)', borderTop: 'none' }}>
                              <td colSpan={6} className="px-6 py-4" style={{ borderTop: `1px dashed color-mix(in srgb, var(--nwd-teal) 30%, transparent)` }}>

                                {/* Action buttons */}
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span className="text-xs text-gray-400 mr-1" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                                    {user.name ?? user.email}
                                  </span>
                                  {isPending && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleReset(user) }}
                                      disabled={anyBusy}
                                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:brightness-90 active:brightness-75 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
                                      style={{ borderColor: 'var(--nwd-teal)', color: isResetting ? '#6b7280' : 'var(--nwd-teal)', background: isResetting ? 'color-mix(in srgb, #6b7280 8%, white)' : 'color-mix(in srgb, var(--nwd-teal) 8%, white)' }}
                                    >
                                      {isResetting ? 'Sending…' : 'Resend Invitation'}
                                    </button>
                                  )}
                                  {!isPending && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleReset(user) }}
                                      disabled={anyBusy}
                                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:brightness-90 active:brightness-75 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
                                      style={{ borderColor: 'var(--nwd-purple)', color: isResetting ? '#6b7280' : 'var(--nwd-purple)', background: isResetting ? 'color-mix(in srgb, #6b7280 8%, white)' : 'color-mix(in srgb, var(--nwd-purple) 8%, white)' }}
                                    >
                                      {isResetting ? 'Sending…' : 'Reset Password'}
                                    </button>
                                  )}
                                  {/* Edit toggle */}
                                  {!isEditing && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); startEdit(user) }}
                                      disabled={anyBusy || editSaving}
                                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:brightness-90 active:brightness-75 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
                                      style={{ borderColor: '#6b7280', color: '#6b7280', background: 'color-mix(in srgb, #6b7280 8%, white)' }}
                                    >
                                      Edit
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(user) }}
                                    disabled={anyBusy || isSelf}
                                    title={isSelf ? 'You cannot delete your own account' : undefined}
                                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:brightness-90 active:brightness-75 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
                                    style={{ borderColor: '#f43f5e', color: isDeleting ? '#6b7280' : '#f43f5e', background: isDeleting ? 'color-mix(in srgb, #6b7280 8%, white)' : 'color-mix(in srgb, #f43f5e 8%, white)' }}
                                  >
                                    {isDeleting ? 'Deleting…' : 'Delete'}
                                  </button>
                                </div>

                                {/* Inline edit form */}
                                {isEditing && (
                                  <div className="mt-3 pt-3" style={{ borderTop: `1px solid color-mix(in srgb, var(--nwd-teal) 20%, transparent)` }}>
                                    <div className="grid grid-cols-3 gap-3 mb-3">
                                      <div>
                                        <label className="text-xs text-gray-500 mb-1 block">Name</label>
                                        <input
                                          type="text"
                                          value={editName}
                                          onChange={(e) => setEditName(e.target.value)}
                                          onClick={(e) => e.stopPropagation()}
                                          placeholder="Full name"
                                          className={inputCls}
                                          style={inputStyle}
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-gray-500 mb-1 block">Email</label>
                                        <input
                                          type="email"
                                          value={editEmail}
                                          onChange={(e) => setEditEmail(e.target.value)}
                                          onClick={(e) => e.stopPropagation()}
                                          placeholder="user@example.com"
                                          className={inputCls}
                                          style={inputStyle}
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-gray-500 mb-1 block">Role</label>
                                        <select
                                          value={editRole}
                                          onChange={(e) => setEditRole(e.target.value as UserRole)}
                                          onClick={(e) => e.stopPropagation()}
                                          className={inputCls}
                                          style={inputStyle}
                                        >
                                          <option value="client">Client</option>
                                          <option value="contractor">Contractor</option>
                                          <option value="admin">Admin</option>
                                        </select>
                                      </div>
                                    </div>
                                    {editError && (
                                      <p className="text-xs mb-2" style={{ color: '#9f1239', fontFamily: 'var(--font-geist-mono)' }}>{editError}</p>
                                    )}
                                    <div className="flex gap-2">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleSaveEdit(user) }}
                                        disabled={editSaving}
                                        className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity disabled:opacity-60"
                                        style={{ background: 'var(--nwd-teal)' }}
                                      >
                                        {editSaving ? 'Saving…' : 'Save'}
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); cancelEdit() }}
                                        disabled={editSaving}
                                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50 disabled:opacity-60"
                                        style={{ borderColor: 'var(--nwd-border)', color: '#6b7280' }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {deleteError?.id === user.id && (
                                  <p className="mt-3 text-xs font-medium" style={{ color: '#9f1239', fontFamily: 'var(--font-geist-mono)' }}>
                                    {deleteError.message}
                                  </p>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
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
        <p className="text-xs tracking-wide" style={{ color: 'var(--nwd-purple)', opacity: 0.4, fontFamily: 'var(--font-geist-mono)' }}>
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
