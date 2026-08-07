'use client'

import { useEffect, useState } from 'react'
import RouteGuard from '@/components/RouteGuard'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types/auth'

type Announcement = {
  id: string
  title: string
  body: string
  target_roles: UserRole[]
  created_at: string
}

type ReadReceipt = {
  recipient_id: string
  name: string | null
  role: UserRole
  read_at: string | null
}

const TARGET_ROLES: UserRole[] = ['admin', 'client', 'contractor']

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admins',
  client: 'Clients',
  contractor: 'Contractors',
}

function AdminAnnouncementsContent() {
  const { profile } = useAuth()

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [targetRoles, setTargetRoles] = useState<UserRole[]>([])
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [receipts, setReceipts] = useState<Record<string, ReadReceipt[]>>({})
  const [loadingReceipts, setLoadingReceipts] = useState<string | null>(null)

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  async function fetchAnnouncements() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, body, target_roles, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setAnnouncements((data as Announcement[]) || [])
    setLoading(false)
  }

  function toggleTargetRole(role: UserRole) {
    setTargetRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]))
  }

  async function sendAnnouncement(e: React.FormEvent) {
    e.preventDefault()
    const trimmedTitle = title.trim()
    const trimmedBody = body.trim()
    if (!trimmedTitle || !trimmedBody || targetRoles.length === 0 || !profile?.id || sending) return

    setSending(true)
    setSendError(null)

    const { error } = await supabase.from('announcements').insert({
      sender_id: profile.id,
      title: trimmedTitle,
      body: trimmedBody,
      target_roles: targetRoles,
    })

    if (error) {
      setSendError(error.message)
      setSending(false)
      return
    }

    setSending(false)
    setTitle('')
    setBody('')
    setTargetRoles([])
    await fetchAnnouncements()
  }

  async function toggleReceipts(announcement: Announcement) {
    const isExpanded = expandedId === announcement.id
    setExpandedId(isExpanded ? null : announcement.id)
    if (isExpanded || receipts[announcement.id]) return

    setLoadingReceipts(announcement.id)
    const { data, error } = await supabase.rpc('get_announcement_read_receipts', {
      p_announcement_id: announcement.id,
    })

    if (!error && data) {
      setReceipts((prev) => ({ ...prev, [announcement.id]: data as ReadReceipt[] }))
    }
    setLoadingReceipts(null)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'white' }}>
      <Navbar title="Announcements" />

      <main className="flex-1 max-w-3xl mx-auto px-6 py-12 w-full">

        <div className="mb-10">
          <p
            className="text-xs font-semibold tracking-widest mb-2"
            style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}
          >
            ADMIN
          </p>
          <h1 className="text-3xl font-bold text-gray-900 leading-tight">Announcements</h1>
          <p className="text-sm text-gray-400 mt-1">
            Send a system-wide announcement to any combination of roles. Not repliable.
          </p>
        </div>

        <form onSubmit={sendAnnouncement} className="flex flex-col gap-4 mb-10 border rounded-lg p-5" style={{ borderColor: 'var(--nwd-border)' }}>
          <div>
            <label className="block text-xs font-semibold tracking-wider text-gray-500 mb-1.5" style={{ fontFamily: 'var(--font-geist-mono)' }}>
              AUDIENCE
            </label>
            <div className="flex gap-2">
              {TARGET_ROLES.map((role) => {
                const isSelected = targetRoles.includes(role)
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleTargetRole(role)}
                    className="flex-1 px-3 py-1.5 rounded-lg text-sm font-semibold border cursor-pointer transition-colors"
                    style={{
                      borderColor: isSelected ? 'var(--nwd-teal)' : 'var(--nwd-border)',
                      color: isSelected ? 'var(--nwd-teal)' : '#6b7280',
                      background: isSelected ? 'color-mix(in srgb, var(--nwd-teal) 8%, white)' : 'white',
                    }}
                  >
                    {ROLE_LABELS[role]}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold tracking-wider text-gray-500 mb-1.5" style={{ fontFamily: 'var(--font-geist-mono)' }}>
              TITLE
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Subject"
              className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900"
              style={{ borderColor: 'var(--nwd-border)' }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold tracking-wider text-gray-500 mb-1.5" style={{ fontFamily: 'var(--font-geist-mono)' }}>
              MESSAGE
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={4}
              placeholder="Write an announcement"
              className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 resize-none"
              style={{ borderColor: 'var(--nwd-border)' }}
            />
          </div>

          {sendError && (
            <p className="text-sm" style={{ color: '#9f1239' }}>{sendError}</p>
          )}

          <button
            type="submit"
            disabled={sending || !title.trim() || !body.trim() || targetRoles.length === 0}
            className="self-start px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--nwd-teal)' }}
          >
            {sending ? 'Sending…' : 'Send Announcement'}
          </button>
        </form>

        {error && (
          <div className="mb-6 rounded-lg p-4 border text-sm flex items-start justify-between gap-2" style={{ background: 'color-mix(in srgb, #f43f5e 8%, white)', borderColor: '#fda4af', color: '#9f1239' }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 text-lg leading-none flex-shrink-0 cursor-pointer" aria-label="Dismiss">×</button>
          </div>
        )}

        <p className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'var(--nwd-purple)', fontFamily: 'var(--font-geist-mono)' }}>
          SENT
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-[3px] border-gray-200 border-t-gray-600 animate-spin" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm">No announcements sent yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {announcements.map((announcement) => {
              const isExpanded = expandedId === announcement.id
              const list = receipts[announcement.id]
              const readCount = list?.filter((r) => r.read_at).length ?? null

              return (
                <div key={announcement.id} className="border rounded-lg p-4" style={{ borderColor: 'var(--nwd-border)' }}>
                  <div onClick={() => toggleReceipts(announcement)} className="cursor-pointer">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900">{announcement.title}</span>
                      <span className="text-xs text-gray-300 flex-shrink-0">
                        {new Date(announcement.created_at).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {announcement.target_roles.map((role) => (
                        <span
                          key={role}
                          className="text-xs font-semibold tracking-wider px-2 py-0.5 rounded"
                          style={{
                            color: 'var(--nwd-teal)',
                            background: 'color-mix(in srgb, var(--nwd-teal) 12%, transparent)',
                            fontFamily: 'var(--font-geist-mono)',
                          }}
                        >
                          {ROLE_LABELS[role]}
                        </span>
                      ))}
                      {readCount !== null && (
                        <span className="text-xs text-gray-400 ml-1">
                          {readCount}/{list!.length} read
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap mt-2 line-clamp-2">
                      {announcement.body}
                    </p>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3" style={{ borderTop: '1px dashed var(--nwd-border)' }}>
                      <p className="text-xs font-semibold tracking-widest mb-2" style={{ color: 'var(--nwd-purple)', fontFamily: 'var(--font-geist-mono)' }}>
                        READ RECEIPTS
                      </p>
                      {loadingReceipts === announcement.id ? (
                        <p className="text-sm text-gray-400">Loading…</p>
                      ) : !list || list.length === 0 ? (
                        <p className="text-sm text-gray-400">No recipients.</p>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {list.map((r) => (
                            <div key={r.recipient_id} className="flex items-center justify-between text-sm">
                              <span className="text-gray-700">{r.name ?? 'Unknown'} <span className="text-gray-400 capitalize">({r.role})</span></span>
                              <span className={r.read_at ? 'text-xs' : 'text-xs text-gray-300'} style={r.read_at ? { color: 'var(--nwd-teal)' } : undefined}>
                                {r.read_at ? 'Read' : 'Unread'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

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

export default function AdminAnnouncementsPage() {
  return (
    <RouteGuard allowedRoles={['admin']}>
      <AdminAnnouncementsContent />
    </RouteGuard>
  )
}
