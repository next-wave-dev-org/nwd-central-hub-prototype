'use client'

import { useEffect, useState } from 'react'
import RouteGuard from '@/components/RouteGuard'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import type { DirectMessage } from '@/types/messages'

const POLL_INTERVAL_MS = 8000

function NotificationsContent() {
  const { profile } = useAuth()

  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [replyingId, setReplyingId] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [replySending, setReplySending] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    if (!profile?.id) return

    let cancelled = false

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('id, content, created_at, read_at, recipient_id, sender_id, thread_id, profiles!sender_id(name)')
        .eq('recipient_id', profile.id)
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (error) {
        setError(error.message)
      } else {
        setMessages((data as unknown as DirectMessage[]) || [])
      }
      setLoading(false)
    }

    fetchMessages()
    const intervalId = setInterval(fetchMessages, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [profile?.id])

  const unreadCount = messages.filter((m) => !m.read_at).length

  async function markRead(message: DirectMessage) {
    if (message.read_at) return
    const readAt = new Date().toISOString()
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, read_at: readAt } : m)))
    await supabase.from('direct_messages').update({ read_at: readAt }).eq('id', message.id)
  }

  async function markAllRead() {
    if (unreadCount === 0 || !profile?.id) return
    setMarkingAll(true)
    const readAt = new Date().toISOString()
    setMessages((prev) => prev.map((m) => (m.read_at ? m : { ...m, read_at: readAt })))
    await supabase
      .from('direct_messages')
      .update({ read_at: readAt })
      .eq('recipient_id', profile.id)
      .is('read_at', null)
    setMarkingAll(false)
  }

  function openReply(message: DirectMessage) {
    setReplyingId((prev) => (prev === message.id ? null : message.id))
    setReplyContent('')
    setReplyError(null)
  }

  async function sendReply(message: DirectMessage) {
    const trimmed = replyContent.trim()
    if (!trimmed || !profile?.id || replySending) return

    setReplySending(true)
    setReplyError(null)

    const { error } = await supabase.from('direct_messages').insert({
      sender_id: profile.id,
      recipient_id: message.sender_id,
      thread_id: message.thread_id ?? message.id,
      content: trimmed,
    })

    if (error) {
      setReplyError(error.message)
      setReplySending(false)
      return
    }

    setReplySending(false)
    setReplyingId(null)
    setReplyContent('')
  }

  async function deleteMessage(message: DirectMessage) {
    setDeletingId(message.id)
    const { error } = await supabase.from('direct_messages').delete().eq('id', message.id)
    if (error) {
      setError(error.message)
      setDeletingId(null)
      return
    }
    setMessages((prev) => prev.filter((m) => m.id !== message.id))
    setDeletingId(null)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'white' }}>
      <Navbar title="Notifications" />

      <main className="flex-1 max-w-3xl mx-auto px-6 py-12 w-full">

        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p
              className="text-xs font-semibold tracking-widest mb-2"
              style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}
            >
              ACCOUNT
            </p>
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">Notifications</h1>
            {!loading && (
              <p className="text-sm text-gray-400 mt-1">
                {unreadCount === 0 ? 'You\'re all caught up.' : `${unreadCount} unread`}
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className="px-4 py-2 rounded-lg text-sm font-semibold border transition-colors hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              style={{ borderColor: 'var(--nwd-border)', color: '#6b7280' }}
            >
              {markingAll ? 'Marking…' : 'Mark all as read'}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-lg p-4 border text-sm flex items-start justify-between gap-2" style={{ background: 'color-mix(in srgb, #f43f5e 8%, white)', borderColor: '#fda4af', color: '#9f1239' }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 text-lg leading-none flex-shrink-0 cursor-pointer" aria-label="Dismiss">×</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-[3px] border-gray-200 border-t-gray-600 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm">No notifications yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((message) => {
              const isUnread = !message.read_at
              const isReplying = replyingId === message.id
              const isDeleting = deletingId === message.id

              return (
                <div
                  key={message.id}
                  className="border rounded-lg p-4"
                  style={{
                    borderColor: 'var(--nwd-border)',
                    background: isUnread ? 'color-mix(in srgb, var(--nwd-purple) 4%, white)' : 'white',
                  }}
                >
                  <div
                    onClick={() => markRead(message)}
                    className={isUnread ? 'cursor-pointer' : undefined}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {isUnread && (
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--nwd-purple)' }} />
                        )}
                        <span className={`text-sm truncate ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-500'}`}>
                          {message.profiles?.name ?? 'Unknown'}
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
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap mt-1">
                      {message.content}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); openReply(message) }}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:brightness-90 active:brightness-75 cursor-pointer"
                      style={{ borderColor: 'var(--nwd-teal)', color: 'var(--nwd-teal)', background: 'color-mix(in srgb, var(--nwd-teal) 8%, white)' }}
                    >
                      Reply
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteMessage(message) }}
                      disabled={isDeleting}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:brightness-90 active:brightness-75 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      style={{ borderColor: '#f43f5e', color: isDeleting ? '#6b7280' : '#f43f5e', background: isDeleting ? 'color-mix(in srgb, #6b7280 8%, white)' : 'color-mix(in srgb, #f43f5e 8%, white)' }}
                    >
                      {isDeleting ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>

                  {isReplying && (
                    <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: '1px dashed var(--nwd-border)' }} onClick={(e) => e.stopPropagation()}>
                      <textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        rows={3}
                        placeholder="Write a reply"
                        className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 resize-none"
                        style={{ borderColor: 'var(--nwd-border)' }}
                      />
                      {replyError && (
                        <p className="text-sm" style={{ color: '#9f1239' }}>{replyError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => sendReply(message)}
                          disabled={replySending || !replyContent.trim()}
                          className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ background: 'var(--nwd-teal)' }}
                        >
                          {replySending ? 'Sending…' : 'Send'}
                        </button>
                        <button
                          onClick={() => setReplyingId(null)}
                          className="px-4 py-1.5 rounded-lg text-sm font-semibold border transition-colors hover:bg-gray-50 cursor-pointer"
                          style={{ borderColor: 'var(--nwd-border)', color: '#6b7280' }}
                        >
                          Cancel
                        </button>
                      </div>
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

export default function NotificationsPage() {
  return (
    <RouteGuard allowedRoles={['admin', 'client', 'contractor']}>
      <NotificationsContent />
    </RouteGuard>
  )
}
