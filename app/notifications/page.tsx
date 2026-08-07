'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import RouteGuard from '@/components/RouteGuard'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import type { Notification, NotificationCategory } from '@/types/notifications'

const POLL_INTERVAL_MS = 8000

const CATEGORIES: { key: NotificationCategory; label: string }[] = [
  { key: 'direct_message', label: 'Direct Messages' },
  { key: 'announcement', label: 'Announcements' },
  { key: 'system', label: 'System' },
]

function sortNotifications(items: Notification[]) {
  return [...items].sort((a, b) => {
    if (!!a.pinned_at !== !!b.pinned_at) return a.pinned_at ? -1 : 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

function NotificationsContent() {
  const { profile } = useAuth()
  const router = useRouter()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('direct_message')

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [replyingId, setReplyingId] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [replySending, setReplySending] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    if (!profile?.id) return

    let cancelled = false

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, category, title, body, link, recipient_id, sender_id, thread_root_id, pinned_at, read_at, created_at, profiles!sender_id(name)')
        .eq('recipient_id', profile.id)
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (error) {
        setError(error.message)
      } else {
        setNotifications((data as unknown as Notification[]) || [])
      }
      setLoading(false)
    }

    fetchNotifications()
    const intervalId = setInterval(fetchNotifications, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [profile?.id])

  const categoryCounts = CATEGORIES.reduce<Record<NotificationCategory, { total: number; unread: number }>>(
    (acc, { key }) => {
      const items = notifications.filter((n) => n.category === key)
      acc[key] = { total: items.length, unread: items.filter((n) => !n.read_at).length }
      return acc
    },
    {} as Record<NotificationCategory, { total: number; unread: number }>
  )

  const visible = sortNotifications(notifications.filter((n) => n.category === activeCategory))
  const totalUnread = notifications.filter((n) => !n.read_at).length

  function toggleExpand(notification: Notification) {
    setExpandedId((prev) => (prev === notification.id ? null : notification.id))
    setReplyingId(null)
    if (!notification.read_at) markRead(notification)
  }

  async function markRead(notification: Notification) {
    const readAt = new Date().toISOString()
    setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, read_at: readAt } : n)))
    await supabase.from('notifications').update({ read_at: readAt }).eq('id', notification.id)
  }

  async function markUnread(notification: Notification) {
    setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, read_at: null } : n)))
    await supabase.from('notifications').update({ read_at: null }).eq('id', notification.id)
  }

  async function markAllRead() {
    if (totalUnread === 0 || !profile?.id) return
    setMarkingAll(true)
    const readAt = new Date().toISOString()
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: readAt })))
    await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('recipient_id', profile.id)
      .is('read_at', null)
    setMarkingAll(false)
  }

  async function togglePin(notification: Notification) {
    const pinnedAt = notification.pinned_at ? null : new Date().toISOString()
    setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, pinned_at: pinnedAt } : n)))
    await supabase.from('notifications').update({ pinned_at: pinnedAt }).eq('id', notification.id)
  }

  async function deleteNotification(notification: Notification) {
    setNotifications((prev) => prev.filter((n) => n.id !== notification.id))
    if (expandedId === notification.id) setExpandedId(null)
    await supabase.from('notifications').delete().eq('id', notification.id)
  }

  function openReply(notification: Notification) {
    setReplyingId((prev) => (prev === notification.id ? null : notification.id))
    setReplyContent('')
    setReplyError(null)
  }

  async function sendReply(notification: Notification) {
    const trimmed = replyContent.trim()
    if (!trimmed || !profile?.id || !notification.sender_id || !notification.thread_root_id || replySending) return

    setReplySending(true)
    setReplyError(null)

    const { error } = await supabase.from('direct_messages').insert({
      sender_id: profile.id,
      recipient_id: notification.sender_id,
      thread_id: notification.thread_root_id,
      title: `Re: ${notification.title}`,
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

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'white' }}>
      <Navbar title="Notifications" />

      <main className="flex-1 max-w-3xl mx-auto px-6 py-12 w-full">

        <div className="mb-8 flex items-end justify-between gap-4">
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
                {totalUnread === 0 ? 'You\'re all caught up.' : `${totalUnread} unread`}
              </p>
            )}
          </div>
          {totalUnread > 0 && (
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

        <div className="flex gap-2 mb-6 border-b" style={{ borderColor: 'var(--nwd-border)' }}>
          {CATEGORIES.map(({ key, label }) => {
            const isActive = activeCategory === key
            const counts = categoryCounts[key]
            return (
              <button
                key={key}
                onClick={() => { setActiveCategory(key); setExpandedId(null) }}
                className="px-4 py-2.5 text-sm font-semibold cursor-pointer transition-colors relative -mb-px border-b-2"
                style={{
                  borderColor: isActive ? 'var(--nwd-teal)' : 'transparent',
                  color: isActive ? 'var(--nwd-teal)' : '#6b7280',
                }}
              >
                {label}
                {counts?.unread > 0 && (
                  <span
                    className="ml-1.5 text-xs font-semibold px-1.5 py-0.5 rounded-full"
                    style={{
                      color: 'var(--nwd-purple)',
                      background: 'color-mix(in srgb, var(--nwd-purple) 12%, transparent)',
                      fontFamily: 'var(--font-geist-mono)',
                    }}
                  >
                    {counts.unread}
                  </span>
                )}
              </button>
            )
          })}
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
        ) : visible.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm">Nothing here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((notification) => {
              const isUnread = !notification.read_at
              const isPinned = !!notification.pinned_at
              const isExpanded = expandedId === notification.id
              const isReplying = replyingId === notification.id

              return (
                <div
                  key={notification.id}
                  className="border rounded-lg p-4"
                  style={{
                    borderColor: isPinned ? 'var(--nwd-teal)' : 'var(--nwd-border)',
                    background: isUnread ? 'color-mix(in srgb, var(--nwd-purple) 4%, white)' : 'white',
                  }}
                >
                  <div onClick={() => toggleExpand(notification)} className="cursor-pointer">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {isUnread && (
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--nwd-purple)' }} />
                        )}
                        {isPinned && (
                          <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--nwd-teal)' }} fill="currentColor" viewBox="0 0 16 16">
                            <path d="M8 1a1 1 0 011 1v4.382l2.447 1.223A1 1 0 0112 9v1a1 1 0 01-1 1H9v3a1 1 0 11-2 0v-3H5a1 1 0 01-1-1V9a1 1 0 01.553-.895L7 6.882V2a1 1 0 011-1z" />
                          </svg>
                        )}
                        <span className={`text-sm truncate ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'}`}>
                          {notification.title}
                        </span>
                      </div>
                      <span className="text-xs text-gray-300 flex-shrink-0">
                        {new Date(notification.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {notification.profiles?.name && (
                      <p className="text-xs text-gray-400 mt-0.5">from {notification.profiles.name}</p>
                    )}

                    {isExpanded && (
                      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap mt-2">
                        {notification.body}
                      </p>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="flex flex-col gap-3 mt-3 pt-3" style={{ borderTop: '1px dashed var(--nwd-border)' }} onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2 flex-wrap">
                        {notification.category === 'direct_message' && (
                          <button
                            onClick={() => openReply(notification)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:brightness-90 cursor-pointer"
                            style={{ borderColor: 'var(--nwd-teal)', color: 'var(--nwd-teal)', background: 'color-mix(in srgb, var(--nwd-teal) 8%, white)' }}
                          >
                            Reply
                          </button>
                        )}
                        {notification.link && (
                          <button
                            onClick={() => router.push(notification.link!)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:brightness-90 cursor-pointer"
                            style={{ borderColor: 'var(--nwd-sky)', color: 'var(--nwd-sky)', background: 'color-mix(in srgb, var(--nwd-sky) 8%, white)' }}
                          >
                            View
                          </button>
                        )}
                        <button
                          onClick={() => togglePin(notification)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:brightness-90 cursor-pointer"
                          style={{ borderColor: 'var(--nwd-purple)', color: 'var(--nwd-purple)', background: 'color-mix(in srgb, var(--nwd-purple) 8%, white)' }}
                        >
                          {isPinned ? 'Unpin' : 'Pin'}
                        </button>
                        <button
                          onClick={() => (isUnread ? markRead(notification) : markUnread(notification))}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:brightness-90 cursor-pointer"
                          style={{ borderColor: '#6b7280', color: '#6b7280', background: 'color-mix(in srgb, #6b7280 8%, white)' }}
                        >
                          {isUnread ? 'Mark read' : 'Mark unread'}
                        </button>
                        <button
                          onClick={() => deleteNotification(notification)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:brightness-90 cursor-pointer"
                          style={{ borderColor: '#f43f5e', color: '#f43f5e', background: 'color-mix(in srgb, #f43f5e 8%, white)' }}
                        >
                          Delete
                        </button>
                      </div>

                      {isReplying && (
                        <div className="flex flex-col gap-2">
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
                              onClick={() => sendReply(notification)}
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
