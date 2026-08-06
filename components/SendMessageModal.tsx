'use client'

import { useCallback, useEffect, useState } from 'react'
import Modal from '@/components/Modal'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types/auth'

type Recipient = {
  id: string
  name: string | null
  email: string
}

type PresetRecipient = {
  id: string
  name: string | null
  email: string
  role: 'client' | 'contractor'
}

type SendMessageModalProps = {
  onClose: () => void
  onSent?: () => void
  /** Skips the role toggle + recipient dropdown and sends straight to this user. */
  presetRecipient?: PresetRecipient
}

const TARGET_ROLES: Extract<UserRole, 'client' | 'contractor'>[] = ['client', 'contractor']

export default function SendMessageModal({ onClose, onSent, presetRecipient }: SendMessageModalProps) {
  const { profile } = useAuth()

  const [targetRole, setTargetRole] = useState<'client' | 'contractor'>(presetRecipient?.role ?? 'client')
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [recipientId, setRecipientId] = useState(presetRecipient?.id ?? '')
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState(false)

  const fetchRecipients = useCallback(async (role: 'client' | 'contractor') => {
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
  }, [])

  useEffect(() => {
    if (presetRecipient) return
    fetchRecipients(targetRole)
  }, [targetRole, presetRecipient, fetchRecipients])

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
    onSent?.()
  }

  return (
    <Modal title="New Message" onClose={onClose}>
      <form onSubmit={sendMessage} className="flex flex-col gap-4">
        {presetRecipient ? (
          <div>
            <label className="block text-xs font-semibold tracking-wider text-gray-500 mb-1.5" style={{ fontFamily: 'var(--font-geist-mono)' }}>
              TO
            </label>
            <p className="text-sm font-semibold text-gray-900">
              {presetRecipient.name ?? presetRecipient.email}
              <span className="ml-2 text-xs font-normal text-gray-400 capitalize">({presetRecipient.role})</span>
            </p>
          </div>
        ) : (
          <>
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
          </>
        )}

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
  )
}
