'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/Modal'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { TITLE_MAX_LENGTH, BODY_MAX_LENGTH } from '@/lib/messageLimits'
import { notifyDirectMessageByEmail } from '@/lib/email/notificationActions'
import type { UserRole } from '@/types/auth'

export type Recipient = {
  id: string
  name: string | null
  email: string
  role: UserRole
}

type SendMessageModalProps = {
  onClose: () => void
  recipients: Recipient[]
}

const CLOSE_DELAY_MS = 2000

export default function SendMessageModal({ onClose, recipients }: SendMessageModalProps) {
  const { profile } = useAuth()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!sent) return
    const timer = setTimeout(onClose, CLOSE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [sent, onClose])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    const trimmedTitle = title.trim()
    const trimmedContent = content.trim()
    if (!trimmedTitle || !trimmedContent || !profile?.id || sending) return

    if (trimmedTitle.length > TITLE_MAX_LENGTH) {
      setSendError(`Title must be ${TITLE_MAX_LENGTH} characters or fewer.`)
      return
    }
    if (trimmedContent.length > BODY_MAX_LENGTH) {
      setSendError(`Message must be ${BODY_MAX_LENGTH} characters or fewer.`)
      return
    }

    setSending(true)
    setSendError(null)

    const [firstRecipient, ...otherRecipients] = recipients

    const { data, error } = await supabase
      .from('direct_messages')
      .insert({
        recipient_id: firstRecipient.id,
        sender_id: profile.id,
        title: trimmedTitle,
        content: trimmedContent,
      })
      .select('id')
      .single()

    if (error) {
      setSendError(error.message)
      setSending(false)
      return
    }

    if (otherRecipients.length > 0) {
      const { error: addError } = await supabase.rpc('add_direct_message_participants', {
        p_thread_root_id: data.id,
        p_profile_ids: otherRecipients.map((r) => r.id),
      })

      if (addError) {
        setSendError(addError.message)
        setSending(false)
        return
      }
    }

    setSending(false)
    setSent(true)
    notifyDirectMessageByEmail(recipients.map((r) => r.id), trimmedTitle, trimmedContent)
  }

  if (sent) {
    return (
      <Modal title="New Message" onClose={onClose}>
        <div className="flex flex-col items-center gap-3 py-6">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, var(--nwd-teal) 15%, transparent)' }}
          >
            <svg className="w-5 h-5" style={{ color: 'var(--nwd-teal)' }} fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l3.5 3.5L13 5" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-900">Message sent</p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="New Message" onClose={onClose}>
      <form onSubmit={sendMessage} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-semibold tracking-wider text-gray-500 mb-1.5" style={{ fontFamily: 'var(--font-geist-mono)' }}>
            TO
          </label>
          <p className="text-sm font-semibold text-gray-900">
            {recipients.map((r) => r.name ?? r.email).join(', ')}
            {recipients.length === 1 && (
              <span className="ml-2 text-xs font-normal text-gray-400 capitalize">({recipients[0].role})</span>
            )}
          </p>
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
            maxLength={TITLE_MAX_LENGTH}
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
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            maxLength={BODY_MAX_LENGTH}
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
          disabled={sending || !title.trim() || !content.trim()}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'var(--nwd-teal)' }}
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </Modal>
  )
}
