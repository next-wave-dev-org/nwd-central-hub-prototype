'use client'

import { useEffect, useState } from 'react'
import RouteGuard from '@/components/RouteGuard'
import Navbar from '@/components/Navbar'
import Modal from '@/components/Modal'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types/auth'

type Recipient = {
  id: string
  name: string | null
  email: string
}

type SentMessage = {
  id: string
  content: string
  created_at: string
  recipient: { name: string | null; email: string; role: UserRole } | null
}

const TARGET_ROLES: Extract<UserRole, 'client' | 'contractor'>[] = ['client', 'contractor']

function AdminMessagesContent() {
  const { profile } = useAuth()

  const [sent, setSent] = useState<SentMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [targetRole, setTargetRole] = useState<'client' | 'contractor'>('client')
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [recipientId, setRecipientId] = useState('')
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState(false)

  useEffect(() => {
    fetchSent()
  }, [])

  useEffect(() => {
    if (!showModal) return
    fetchRecipients(targetRole)
  }, [showModal, targetRole])

  async function fetchSent() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('direct_messages')
      .select('id, content, created_at, recipient:profiles!recipient_id(name, email, role)')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSent((data as unknown as SentMessage[]) || [])
    setLoading(false)
  }

  async function fetchRecipients(role: 'client' | 'contractor') {
    setRecipientId('')
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('role', role)
      .order('name')

    if (error) {
      setSendError(error.message)
      return
    }

    setRecipients((data as Recipient[]) || [])
  }

  function openModal() {
    setSendError(null)
    setSendSuccess(false)
    setContent('')
    setTargetRole('client')
    setShowModal(true)
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed || !recipientId || !profile?.id || sending) return

    setSending(true)
    setSendError(null)

    const { error } = await supabase.from('direct_messages').insert({
      recipient_id: recipientId,
      sender_id: profile.id,
      content: trimmed,
    })

    if (error) {
      setSendError(error.message)
      setSending(false)
      return
    }

    setSending(false)
    setSendSuccess(true)
    setContent('')
    await fetchSent()
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'white' }}>

      <Navbar title="Messages" />

      <main className="flex-1 max-w-3xl mx-auto px-6 py-12 w-full">

        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p
              className="text-xs font-semibold tracking-widest mb-2"
              style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}
            >
              ADMIN
            </p>
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">Messages</h1>
            <p className="text-sm text-gray-400 mt-1">
              Send a private message directly to a client or contractor&apos;s dashboard
            </p>
          </div>
          <button
            onClick={openModal}
            className="px-4 py-2 rounded-full text-sm font-semibold bg-gray-900 text-white hover:bg-gray-700 transition-colors cursor-pointer flex-shrink-0"
          >
            New Message
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg p-4 border text-sm flex items-start justify-between gap-2" style={{ background: 'color-mix(in srgb, #f43f5e 8%, white)', borderColor: '#fda4af', color: '#9f1239' }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 text-lg leading-none flex-shrink-0 cursor-pointer" aria-label="Dismiss">×</button>
          </div>
        )}

        <p className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'var(--nwd-purple)', fontFamily: 'var(--font-geist-mono)' }}>
          RECENTLY SENT
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-[3px] border-gray-200 border-t-gray-600 animate-spin" />
          </div>
        ) : sent.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm">No messages sent yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sent.map((msg) => (
              <div
                key={msg.id}
                className="border rounded-lg p-4 flex flex-col gap-1.5"
                style={{ borderColor: 'var(--nwd-border)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {msg.recipient?.name ?? msg.recipient?.email ?? 'Unknown recipient'}
                  </span>
                  <span className="text-xs text-gray-300">
                    {new Date(msg.created_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap line-clamp-2">
                  {msg.content}
                </p>
              </div>
            ))}
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

      {showModal && (
        <Modal title="New Message" onClose={() => setShowModal(false)}>
          <form onSubmit={sendMessage} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold tracking-wider text-gray-500 mb-1.5" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                TARGET
              </label>
              <div className="flex gap-2">
                {TARGET_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setTargetRole(role)}
                    className="flex-1 px-3 py-1.5 rounded-lg text-sm font-semibold border cursor-pointer transition-colors capitalize"
                    style={{
                      borderColor: targetRole === role ? 'var(--nwd-teal)' : 'var(--nwd-border)',
                      color: targetRole === role ? 'var(--nwd-teal)' : '#6b7280',
                      background: targetRole === role ? 'color-mix(in srgb, var(--nwd-teal) 8%, white)' : 'white',
                    }}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold tracking-wider text-gray-500 mb-1.5" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                RECIPIENT
              </label>
              <select
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900"
                style={{ borderColor: 'var(--nwd-border)' }}
              >
                <option value="" disabled>
                  {recipients.length === 0 ? `No ${targetRole}s found` : `Select a ${targetRole}`}
                </option>
                {recipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name ?? r.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold tracking-wider text-gray-500 mb-1.5" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                MESSAGE
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={4}
                placeholder="Write a message"
                className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 resize-none"
                style={{ borderColor: 'var(--nwd-border)' }}
              />
            </div>

            {sendError && (
              <p className="text-sm" style={{ color: '#9f1239' }}>{sendError}</p>
            )}
            {sendSuccess && !sendError && (
              <p className="text-sm" style={{ color: 'var(--nwd-teal)' }}>Message sent.</p>
            )}

            <button
              type="submit"
              disabled={sending || !content.trim() || !recipientId}
              className="px-4 py-2 rounded-full text-sm font-semibold bg-gray-900 text-white hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </form>
        </Modal>
      )}

    </div>
  )
}

export default function AdminMessagesPage() {
  return (
    <RouteGuard allowedRoles={['admin']}>
      <AdminMessagesContent />
    </RouteGuard>
  )
}
