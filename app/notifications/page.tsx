'use client'

import { useEffect, useMemo, useState } from 'react'
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

type ThreadMessage = {
  id: string
  title: string
  content: string
  created_at: string
  sender_id: string
  profiles: { name: string | null } | null
}

type ListItem = {
  key: string
  representative: Notification
  isUnread: boolean
  isPinned: boolean
  memberIds: string[]
}

function buildListItems(notifications: Notification[], category: NotificationCategory): ListItem[] {
  const items = notifications.filter((n) => n.category === category)

  if (category !== 'direct_message') {
    return items.map((n) => ({
      key: n.id,
      representative: n,
      isUnread: !n.read_at,
      isPinned: !!n.pinned_at,
      memberIds: [n.id],
    }))
  }

  const groups = new Map<string, Notification[]>()
  for (const n of items) {
    const key = n.thread_root_id ?? n.id
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(n)
  }

  return Array.from(groups.entries()).map(([key, group]) => {
    const representative = group.reduce((a, b) => (new Date(a.created_at) > new Date(b.created_at) ? a : b))
    return {
      key,
      representative,
      isUnread: group.some((n) => !n.read_at),
      isPinned: group.some((n) => !!n.pinned_at),
      memberIds: group.map((n) => n.id),
    }
  })
}

function sortListItems(items: ListItem[]) {
  return [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    return new Date(b.representative.created_at).getTime() - new Date(a.representative.created_at).getTime()
  })
}

function NotificationsContent() {
  const { profile } = useAuth()
  const router = useRouter()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('direct_message')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [replySending, setReplySending] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)

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

  const categoryCounts = CATEGORIES.reduce<Record<NotificationCategory, number>>((acc, { key }) => {
    acc[key] = notifications.filter((n) => n.category === key && !n.read_at).length
    return acc
  }, {} as Record<NotificationCategory, number>)

  const totalUnread = notifications.filter((n) => !n.read_at).length

  const listItems = useMemo(
    () => sortListItems(buildListItems(notifications, activeCategory)),
    [notifications, activeCategory]
  )

  const selectedItem = listItems.find((item) => item.key === selectedKey) ?? null

  async function fetchThread(rootId: string) {
    setThreadLoading(true)
    const { data, error } = await supabase
      .from('direct_messages')
      .select('id, title, content, created_at, sender_id, profiles!sender_id(name)')
      .or(`id.eq.${rootId},thread_id.eq.${rootId}`)
      .order('created_at', { ascending: true })

    if (!error && data) setThreadMessages(data as unknown as ThreadMessage[])
    setThreadLoading(false)
  }

  // Keep the selection valid as data changes (category switch, delete, poll refresh
  // dropping the current item) — auto-select the next best item, but never fight an
  // existing valid selection during background polling.
  useEffect(() => {
    if (listItems.some((item) => item.key === selectedKey)) return
    setSelectedKey(listItems[0]?.key ?? null)
  }, [listItems, selectedKey])

  // Runs only when the actual selection changes — loads the DM thread / marks read.
  useEffect(() => {
    setReplyContent('')
    setReplyError(null)

    if (!selectedItem) {
      setThreadMessages([])
      return
    }

    const unreadIds = selectedItem.memberIds.filter((id) => notifications.find((n) => n.id === id)?.read_at == null)
    if (unreadIds.length > 0) {
      const readAt = new Date().toISOString()
      setNotifications((prev) => prev.map((n) => (unreadIds.includes(n.id) ? { ...n, read_at: readAt } : n)))
      supabase.from('notifications').update({ read_at: readAt }).in('id', unreadIds)
    }

    if (activeCategory === 'direct_message') {
      fetchThread(selectedItem.key)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem?.key])

  // While a conversation is open, poll it independently so incoming replies appear live.
  useEffect(() => {
    if (activeCategory !== 'direct_message' || !selectedKey) return
    const intervalId = setInterval(() => fetchThread(selectedKey), POLL_INTERVAL_MS)
    return () => clearInterval(intervalId)
  }, [activeCategory, selectedKey])

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

  async function togglePin() {
    if (!selectedItem) return
    const pinnedAt = selectedItem.representative.pinned_at ? null : new Date().toISOString()
    const id = selectedItem.representative.id
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, pinned_at: pinnedAt } : n)))
    await supabase.from('notifications').update({ pinned_at: pinnedAt }).eq('id', id)
  }

  async function toggleReadState() {
    if (!selectedItem) return
    const readAt = selectedItem.isUnread ? new Date().toISOString() : null
    const ids = selectedItem.memberIds
    setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: readAt } : n)))
    await supabase.from('notifications').update({ read_at: readAt }).in('id', ids)
  }

  async function deleteSelected() {
    if (!selectedItem) return
    const ids = selectedItem.memberIds
    setNotifications((prev) => prev.filter((n) => !ids.includes(n.id)))
    setSelectedKey(null)
    await supabase.from('notifications').delete().in('id', ids)
  }

  async function sendReply() {
    const trimmed = replyContent.trim()
    const item = selectedItem
    if (!trimmed || !profile?.id || !item?.representative.sender_id || replySending) return

    setReplySending(true)
    setReplyError(null)

    const { error } = await supabase.from('direct_messages').insert({
      sender_id: profile.id,
      recipient_id: item.representative.sender_id,
      thread_id: item.key,
      title: `Re: ${item.representative.title}`,
      content: trimmed,
    })

    if (error) {
      setReplyError(error.message)
      setReplySending(false)
      return
    }

    setReplySending(false)
    setReplyContent('')
    fetchThread(item.key)
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'white' }}>
      <Navbar title="Notifications" />

      <main className="flex-1 max-w-6xl mx-auto px-6 py-10 w-full flex flex-col">

        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p
              className="text-xs font-semibold tracking-widest mb-2"
              style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}
            >
              ACCOUNT
            </p>
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">Notifications</h1>
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
        ) : (
          <div className="flex-1 flex border rounded-lg overflow-hidden" style={{ borderColor: 'var(--nwd-border)', minHeight: '32rem' }}>

            {/* ── List pane ── */}
            <div
              className={`${selectedKey ? 'hidden sm:flex' : 'flex'} w-full sm:w-80 flex-shrink-0 border-r flex-col`}
              style={{ borderColor: 'var(--nwd-border)' }}
            >
              <div className="flex border-b flex-shrink-0" style={{ borderColor: 'var(--nwd-border)' }}>
                {CATEGORIES.map(({ key, label }) => {
                  const isActive = activeCategory === key
                  const unread = categoryCounts[key]
                  return (
                    <button
                      key={key}
                      onClick={() => { setActiveCategory(key); setSelectedKey(null) }}
                      className="flex-1 px-2 py-3 text-xs font-semibold cursor-pointer transition-colors border-b-2 truncate"
                      style={{ borderColor: isActive ? 'var(--nwd-teal)' : 'transparent', color: isActive ? 'var(--nwd-teal)' : '#6b7280' }}
                    >
                      {label}
                      {unread > 0 && <span className="ml-1" style={{ color: 'var(--nwd-purple)' }}>({unread})</span>}
                    </button>
                  )
                })}
              </div>

              <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: 'var(--nwd-border)' }}>
                {listItems.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10 px-4">Nothing here.</p>
                ) : (
                  listItems.map((item) => {
                    const n = item.representative
                    const isSelected = item.key === selectedKey
                    return (
                      <button
                        key={item.key}
                        onClick={() => setSelectedKey(item.key)}
                        className="w-full text-left px-4 py-3 cursor-pointer transition-colors"
                        style={{ background: isSelected ? 'color-mix(in srgb, var(--nwd-teal) 8%, white)' : item.isUnread ? 'color-mix(in srgb, var(--nwd-purple) 4%, white)' : 'white' }}
                      >
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {item.isUnread && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--nwd-purple)' }} />}
                            {item.isPinned && (
                              <svg className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--nwd-teal)' }} fill="currentColor" viewBox="0 0 16 16">
                                <path d="M8 1a1 1 0 011 1v4.382l2.447 1.223A1 1 0 0112 9v1a1 1 0 01-1 1H9v3a1 1 0 11-2 0v-3H5a1 1 0 01-1-1V9a1 1 0 01.553-.895L7 6.882V2a1 1 0 011-1z" />
                              </svg>
                            )}
                            <span className={`text-sm truncate ${item.isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'}`}>
                              {n.title}
                            </span>
                          </div>
                          <span className="text-xs text-gray-300 flex-shrink-0">{formatTime(n.created_at)}</span>
                        </div>
                        {n.profiles?.name && <p className="text-xs text-gray-400 mb-0.5">{n.profiles.name}</p>}
                        <p className="text-xs text-gray-400 truncate">{n.body}</p>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* ── Detail pane ── */}
            <div className={`${selectedKey ? 'flex' : 'hidden sm:flex'} flex-1 flex-col min-w-0`}>
              {!selectedItem ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-gray-400">Select a message to view</p>
                </div>
              ) : (
                <>
                  <div className="px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--nwd-border)' }}>
                    <button
                      onClick={() => setSelectedKey(null)}
                      className="sm:hidden text-xs font-semibold mb-2 cursor-pointer"
                      style={{ color: 'var(--nwd-teal)' }}
                    >
                      ← Back
                    </button>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h2 className="text-lg font-bold text-gray-900 leading-snug">{selectedItem.representative.title}</h2>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {activeCategory === 'system' && selectedItem.representative.link && (
                        <button
                          onClick={() => router.push(selectedItem.representative.link!)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:brightness-90 cursor-pointer"
                          style={{ borderColor: 'var(--nwd-sky)', color: 'var(--nwd-sky)', background: 'color-mix(in srgb, var(--nwd-sky) 8%, white)' }}
                        >
                          View
                        </button>
                      )}
                      <button
                        onClick={togglePin}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:brightness-90 cursor-pointer"
                        style={{ borderColor: 'var(--nwd-purple)', color: 'var(--nwd-purple)', background: 'color-mix(in srgb, var(--nwd-purple) 8%, white)' }}
                      >
                        {selectedItem.isPinned ? 'Unpin' : 'Pin'}
                      </button>
                      <button
                        onClick={toggleReadState}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:brightness-90 cursor-pointer"
                        style={{ borderColor: '#6b7280', color: '#6b7280', background: 'color-mix(in srgb, #6b7280 8%, white)' }}
                      >
                        {selectedItem.isUnread ? 'Mark read' : 'Mark unread'}
                      </button>
                      <button
                        onClick={deleteSelected}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:brightness-90 cursor-pointer"
                        style={{ borderColor: '#f43f5e', color: '#f43f5e', background: 'color-mix(in srgb, #f43f5e 8%, white)' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {activeCategory === 'direct_message' ? (
                    <>
                      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
                        {threadLoading && threadMessages.length === 0 ? (
                          <p className="text-sm text-gray-400">Loading…</p>
                        ) : (
                          threadMessages.map((message) => (
                            <div key={message.id} className="text-sm">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-semibold text-gray-900">{message.profiles?.name ?? 'Unknown'}</span>
                                <span className="text-xs text-gray-300">{formatTime(message.created_at)}</span>
                              </div>
                              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{message.content}</p>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--nwd-border)' }}>
                        {replyError && <p className="text-sm mb-2" style={{ color: '#9f1239' }}>{replyError}</p>}
                        <div className="flex flex-col gap-2">
                          <textarea
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            rows={2}
                            placeholder="Write a reply"
                            className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 resize-none"
                            style={{ borderColor: 'var(--nwd-border)' }}
                          />
                          <button
                            onClick={sendReply}
                            disabled={replySending || !replyContent.trim()}
                            className="self-start px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: 'var(--nwd-teal)' }}
                          >
                            {replySending ? 'Sending…' : 'Reply'}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 overflow-y-auto px-5 py-4">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedItem.representative.body}</p>
                    </div>
                  )}
                </>
              )}
            </div>
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
