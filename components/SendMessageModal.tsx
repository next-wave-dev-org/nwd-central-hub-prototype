'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'

type Recipient = {
  id: string
  name: string | null
  email: string
  role: 'client' | 'contractor'
}

type SendMessageModalProps = {
  onClose: () => void
  onSent?: () => void
  recipient: Recipient
}

export default function SendMessageModal({ onClose, onSent, recipient }: SendMessageModalProps) {
  const { profile } = useAuth()

  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed || !profile?.id || sending) return

    setSending(true)
    setSendError(null)

    const { error } = await supabase.from('direct_messages').insert({
      recipient_id: recipient.id,
      sender_id: profile.id,
      content: trimmed,
    })

    if (error) {
      setSendError(error.message)
      setSending(false)
      return
    }

    onSent?.()
    onClose()
  }

  return (
    <Modal title="New Message" onClose={onClose}>
      <form onSubmit={sendMessage} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-semibold tracking-wider text-gray-500 mb-1.5" style={{ fontFamily: 'var(--font-geist-mono)' }}>
            TO
          </label>
          <p className="text-sm font-semibold text-gray-900">
            {recipient.name ?? recipient.email}
            <span className="ml-2 text-xs font-normal text-gray-400 capitalize">({recipient.role})</span>
          </p>
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

        <button
          type="submit"
          disabled={sending || !content.trim()}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'var(--nwd-teal)' }}
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </Modal>
  )
}
