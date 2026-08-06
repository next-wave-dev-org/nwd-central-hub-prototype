'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import type { DirectMessage } from '@/types/messages'

const MESSAGE_POLL_INTERVAL_MS = 8000

export default function DirectMessageInbox() {
  const { profile } = useAuth()
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.id) return

    let cancelled = false

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('direct_messages')
        .select('id, content, created_at, read_at, recipient_id, sender_id, profiles!sender_id(name)')
        .eq('recipient_id', profile.id)
        .order('created_at', { ascending: false })

      if (!cancelled && data) {
        setMessages(data as unknown as DirectMessage[])
        setLoading(false)
      }
    }

    fetchMessages()
    const intervalId = setInterval(fetchMessages, MESSAGE_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [profile?.id])

  async function markRead(message: DirectMessage) {
    setExpandedId((prev) => (prev === message.id ? null : message.id))
    if (message.read_at) return

    const readAt = new Date().toISOString()
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, read_at: readAt } : m)))

    await supabase.from('direct_messages').update({ read_at: readAt }).eq('id', message.id)
  }

  if (loading || messages.length === 0) return null

  const unreadCount = messages.filter((m) => !m.read_at).length

  return (
    <div className="w-full border rounded-lg mb-8" style={{ borderColor: 'var(--nwd-border)' }}>
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--nwd-border)' }}>
        <p className="text-xs font-semibold tracking-widest" style={{ color: 'var(--nwd-purple)', fontFamily: 'var(--font-geist-mono)' }}>
          MESSAGES FROM ADMIN
        </p>
        {unreadCount > 0 && (
          <span
            className="text-xs font-semibold tracking-wider px-2 py-0.5 rounded-full"
            style={{
              color: 'var(--nwd-purple)',
              background: 'color-mix(in srgb, var(--nwd-purple) 12%, transparent)',
              fontFamily: 'var(--font-geist-mono)',
            }}
          >
            {unreadCount} unread
          </span>
        )}
      </div>

      <div className="flex flex-col divide-y" style={{ borderColor: 'var(--nwd-border)' }}>
        {messages.map((message) => {
          const isUnread = !message.read_at
          const isExpanded = expandedId === message.id

          return (
            <button
              key={message.id}
              type="button"
              onClick={() => markRead(message)}
              className="text-left px-5 py-3 cursor-pointer transition-colors hover:brightness-[0.98]"
              style={{ background: isUnread ? 'color-mix(in srgb, var(--nwd-purple) 4%, white)' : 'white' }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {isUnread && (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--nwd-purple)' }} />
                  )}
                  <span className={`text-sm truncate ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-500'}`}>
                    {message.profiles?.name ?? 'Admin'}
                  </span>
                </div>
                <span className="text-xs text-gray-300 flex-shrink-0">
                  {new Date(message.created_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p
                className={`text-sm text-gray-600 leading-relaxed whitespace-pre-wrap mt-1 ${isExpanded ? '' : 'line-clamp-2'}`}
              >
                {message.content}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
