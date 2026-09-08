'use client'

import { useEffect, useMemo, useState } from 'react'
import Modal from '@/components/Modal'
import { useAuth } from '@/components/AuthProvider'
import { getUsers } from '@/app/login/admin/users/actions'
import type { UserProfile } from '@/types/auth'

type SelectUsersModalProps = {
  title: string
  warning?: string
  confirmLabel: (count: number) => string
  excludeIds: string[]
  onClose: () => void
  onConfirm: (users: UserProfile[]) => void | Promise<void>
  confirmError?: string | null
}

export default function SelectUsersModal({
  title,
  warning,
  confirmLabel,
  excludeIds,
  onClose,
  onConfirm,
  confirmError,
}: SelectUsersModalProps) {
  const { profile } = useAuth()

  const [users, setUsers] = useState<UserProfile[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadingUsers(true)
    getUsers().then((result) => {
      if (cancelled) return
      if (result.success) {
        setUsers(result.users)
      } else {
        setLoadError(result.error)
      }
      setLoadingUsers(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const excludeSet = useMemo(() => {
    const ids = [...excludeIds]
    if (profile) ids.push(profile.id)
    return new Set(ids)
  }, [excludeIds, profile])

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users
      .filter((u) => !excludeSet.has(u.id))
      .filter((u) => !q || (u.name ?? '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  }, [users, excludeSet, search])

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleConfirm() {
    if (selectedIds.size === 0 || confirming) return
    setConfirming(true)
    const selectedUsers = users.filter((u) => selectedIds.has(u.id))
    await onConfirm(selectedUsers)
    setConfirming(false)
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {warning && (
          <div
            className="rounded-lg p-3 text-sm"
            style={{ background: 'color-mix(in srgb, #f59e0b 10%, white)', color: '#92400e' }}
          >
            {warning}
          </div>
        )}

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email"
          className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900"
          style={{ borderColor: 'var(--nwd-border)' }}
          autoFocus
        />

        <div className="max-h-64 overflow-y-auto border rounded-lg divide-y" style={{ borderColor: 'var(--nwd-border)' }}>
          {loadingUsers ? (
            <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
          ) : loadError ? (
            <p className="text-sm px-3 py-6 text-center" style={{ color: '#9f1239' }}>{loadError}</p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No matching users.</p>
          ) : (
            candidates.map((u) => {
              const isSelected = selectedIds.has(u.id)
              return (
                <label
                  key={u.id}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors"
                  style={{ background: isSelected ? 'color-mix(in srgb, var(--nwd-teal) 8%, white)' : 'white' }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(u.id)}
                    className="flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.name ?? u.email}</p>
                    <p className="text-xs text-gray-400 truncate capitalize">{u.email} · {u.role}</p>
                  </div>
                </label>
              )
            })
          )}
        </div>

        {confirmError && <p className="text-sm" style={{ color: '#9f1239' }}>{confirmError}</p>}

        <button
          onClick={handleConfirm}
          disabled={selectedIds.size === 0 || confirming}
          className="self-start px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'var(--nwd-teal)' }}
        >
          {confirming ? 'Working…' : confirmLabel(selectedIds.size)}
        </button>
      </div>
    </Modal>
  )
}
