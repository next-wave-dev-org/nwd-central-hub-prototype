'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import RouteGuard from '@/components/RouteGuard'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import type { Notification, NotificationCategory } from '@/types/notifications'
import { TITLE_MAX_LENGTH, BODY_MAX_LENGTH } from '@/lib/messageLimits'
import SelectUsersModal from '@/components/SelectUsersModal'
import SendMessageModal, { type Recipient } from '@/components/SendMessageModal'
import { notifyDirectMessageByEmail } from '@/lib/email/notificationActions'
import type { UserProfile } from '@/types/auth'

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
  const threadListRef = useRef<HTMLDivElement>(null)

  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [participants, setParticipants] = useState<{ id: string; name: string | null; email: string }[]>([])
  const [showAddUsers, setShowAddUsers] = useState(false)
  const [addUsersError, setAddUsersError] = useState<string | null>(null)

  const [showNewMessagePicker, setShowNewMessagePicker] = useState(false)
  const [newMessageRecipients, setNewMessageRecipients] = useState<Recipient[] | null>(null)

  // Guards optimistic read/pin state against a poll refresh landing before the
  // write it's protecting has actually persisted (which was reverting reads/pins
  // back to their old value ~one poll cycle after the click that set them).
  const pendingWritesRef = useRef<Map<string, Partial<Pick<Notification, 'read_at' | 'pinned_at'>>>>(new Map())

  function applyPendingWrite(ids: string[], patch: Partial<Pick<Notification, 'read_at' | 'pinned_at'>>) {
    for (const id of ids) {
      pendingWritesRef.current.set(id, { ...pendingWritesRef.current.get(id), ...patch })
    }
  }

  function clearPendingWrite(ids: string[]) {
    for (const id of ids) pendingWritesRef.current.delete(id)
  }

  // Only force-scroll to the bottom right after WE open a thread or send into
  // it — never on a background poll pulling in someone else's reply, which
  // was yanking the view to the bottom out from under anyone scrolled up
  // reading older messages.
  const shouldScrollToBottomRef = useRef(true)

  useEffect(() => {
    const el = threadListRef.current
    if (!el || !shouldScrollToBottomRef.current) return
    el.scrollTop = el.scrollHeight
    shouldScrollToBottomRef.current = false
  }, [threadMessages])

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
        const fresh = (data as unknown as Notification[]) || []
        const merged = pendingWritesRef.current.size === 0
          ? fresh
          : fresh.map((n) => {
              const pending = pendingWritesRef.current.get(n.id)
              return pending ? { ...n, ...pending } : n
            })
        setNotifications(merged)
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

  const [listSearch, setListSearch] = useState('')

  const listItems = useMemo(() => {
    const items = sortListItems(buildListItems(notifications, activeCategory))
    const q = listSearch.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      const n = item.representative
      return (
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        (n.profiles?.name ?? '').toLowerCase().includes(q)
      )
    })
  }, [notifications, activeCategory, listSearch])

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

  async function fetchParticipants(rootId: string) {
    const { data, error } = await supabase
      .from('direct_message_participants')
      .select('profile_id, profiles!profile_id(name, email)')
      .eq('thread_root_id', rootId)

    if (!error && data) {
      setParticipantIds(data.map((row) => row.profile_id as string))
      setParticipants(
        data.map((row) => {
          const p = row.profiles as unknown as { name: string | null; email: string } | null
          return { id: row.profile_id as string, name: p?.name ?? null, email: p?.email ?? '' }
        })
      )
    }
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
      setParticipantIds([])
      setParticipants([])
      return
    }

    const unreadIds = selectedItem.memberIds.filter((id) => notifications.find((n) => n.id === id)?.read_at == null)
    if (unreadIds.length > 0) {
      const readAt = new Date().toISOString()
      applyPendingWrite(unreadIds, { read_at: readAt })
      setNotifications((prev) => prev.map((n) => (unreadIds.includes(n.id) ? { ...n, read_at: readAt } : n)))
      supabase.from('notifications').update({ read_at: readAt }).in('id', unreadIds).then(({ error }) => {
        clearPendingWrite(unreadIds)
        if (error) setError(error.message)
      })
    }

    if (activeCategory === 'direct_message') {
      shouldScrollToBottomRef.current = true
      fetchThread(selectedItem.key)
      fetchParticipants(selectedItem.key)
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
    const ids = notifications.filter((n) => !n.read_at).map((n) => n.id)
    applyPendingWrite(ids, { read_at: readAt })
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: readAt })))
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('recipient_id', profile.id)
      .is('read_at', null)
    clearPendingWrite(ids)
    if (error) setError(error.message)
    setMarkingAll(false)
  }

  async function togglePin() {
    if (!selectedItem) return
    const pinnedAt = selectedItem.representative.pinned_at ? null : new Date().toISOString()
    const id = selectedItem.representative.id
    applyPendingWrite([id], { pinned_at: pinnedAt })
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, pinned_at: pinnedAt } : n)))
    const { error } = await supabase.from('notifications').update({ pinned_at: pinnedAt }).eq('id', id)
    clearPendingWrite([id])
    if (error) setError(error.message)
  }

  async function toggleReadState() {
    if (!selectedItem) return
    const readAt = selectedItem.isUnread ? new Date().toISOString() : null
    const ids = selectedItem.memberIds
    applyPendingWrite(ids, { read_at: readAt })
    setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: readAt } : n)))
    const { error } = await supabase.from('notifications').update({ read_at: readAt }).in('id', ids)
    clearPendingWrite(ids)
    if (error) setError(error.message)
  }

  async function deleteSelected() {
    if (!selectedItem) return
    const isConversation = activeCategory === 'direct_message' && selectedItem.memberIds.length > 1
    const confirmMessage = isConversation
      ? 'Delete this entire conversation? This cannot be undone.'
      : 'Delete this message? This cannot be undone.'
    if (!confirm(confirmMessage)) return
    const ids = selectedItem.memberIds
    setNotifications((prev) => prev.filter((n) => !ids.includes(n.id)))
    setSelectedKey(null)
    await supabase.from('notifications').delete().in('id', ids)
  }

  async function sendReply() {
    const trimmed = replyContent.trim()
    const item = selectedItem
    if (!trimmed || !profile?.id || !item?.representative.sender_id || replySending) return

    if (trimmed.length > BODY_MAX_LENGTH) {
      setReplyError(`Reply must be ${BODY_MAX_LENGTH} characters or fewer.`)
      return
    }

    setReplySending(true)
    setReplyError(null)

    const replyTitle = `Re: ${item.representative.title}`.slice(0, TITLE_MAX_LENGTH)

    const { error } = await supabase.from('direct_messages').insert({
      sender_id: profile.id,
      recipient_id: item.representative.sender_id,
      thread_id: item.key,
      title: replyTitle,
      content: trimmed,
    })

    if (error) {
      setReplyError(error.message)
      setReplySending(false)
      return
    }

    setReplySending(false)
    setReplyContent('')
    shouldScrollToBottomRef.current = true
    fetchThread(item.key)
    notifyDirectMessageByEmail(participantIds.filter((id) => id !== profile.id), replyTitle, trimmed)
  }

  async function handleAddUsersConfirm(users: UserProfile[]) {
    if (!selectedItem) return
    setAddUsersError(null)

    const { error } = await supabase.rpc('add_direct_message_participants', {
      p_thread_root_id: selectedItem.key,
      p_profile_ids: users.map((u) => u.id),
    })

    if (error) {
      setAddUsersError(error.message)
      return
    }

    setShowAddUsers(false)
    fetchParticipants(selectedItem.key)
    fetchThread(selectedItem.key)
  }

  function handleNewMessagePickerConfirm(users: UserProfile[]) {
    setNewMessageRecipients(
      users.map((u) => ({ id: u.id, name: u.name ?? null, email: u.email, role: u.role }))
    )
    setShowNewMessagePicker(false)
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
          <div className="flex items-center gap-2 flex-shrink-0">
            {profile?.role === 'admin' && (
              <button
                onClick={() => setShowNewMessagePicker(true)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer flex-shrink-0"
                style={{ background: 'var(--nwd-teal)' }}
              >
                New +
              </button>
            )}
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
        </div>

        {error && (
          <div className="mb-6 rounded-lg p-4 border text-sm flex items-start justify-between gap-2" style={{ background: 'color-mix(in srgb, #f43f5e 8%, white)', borderColor: '#fda4af', color: '#9f1239' }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 text-lg leading-none flex-shrink-0 cursor-pointer" aria-label="Dismiss">×</button>
          </div>
        )}

        <div className="flex gap-2 mb-6 border-b flex-shrink-0" style={{ borderColor: 'var(--nwd-border)' }}>
          {CATEGORIES.map(({ key, label }) => {
            const isActive = activeCategory === key
            const unread = categoryCounts[key]
            return (
              <button
                key={key}
                onClick={() => { setActiveCategory(key); setSelectedKey(null) }}
                className="px-4 py-2.5 text-sm font-semibold cursor-pointer transition-colors relative -mb-px border-b-2"
                style={{ borderColor: isActive ? 'var(--nwd-teal)' : 'transparent', color: isActive ? 'var(--nwd-teal)' : '#6b7280' }}
              >
                {label}
                {unread > 0 && (
                  <span
                    className="ml-1.5 text-xs font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ color: 'var(--nwd-purple)', background: 'color-mix(in srgb, var(--nwd-purple) 12%, transparent)', fontFamily: 'var(--font-geist-mono)' }}
                  >
                    {unread}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-[3px] border-gray-200 border-t-gray-600 animate-spin" />
          </div>
        ) : (
          <div className="flex border rounded-lg overflow-hidden" style={{ borderColor: 'var(--nwd-border)', height: '32rem' }}>

            {/* ── List pane ── */}
            <div
              className={`${selectedKey ? 'hidden sm:flex' : 'flex'} w-full sm:w-80 flex-shrink-0 border-r flex-col min-h-0`}
              style={{ borderColor: 'var(--nwd-border)' }}
            >
              <div className="p-2 border-b flex-shrink-0" style={{ borderColor: 'var(--nwd-border)' }}>
                <input
                  type="text"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  placeholder="Search"
                  className="w-full border rounded-lg px-3 py-1.5 text-sm text-gray-900"
                  style={{ borderColor: 'var(--nwd-border)' }}
                />
              </div>
              <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: 'var(--nwd-border)' }}>
                {listItems.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10 px-4">
                    {listSearch.trim() ? 'No matches.' : 'Nothing here.'}
                  </p>
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
            <div className={`${selectedKey ? 'flex' : 'hidden sm:flex'} flex-1 flex-col min-w-0 min-h-0`}>
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
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <h2 className="text-lg font-bold text-gray-900 leading-snug min-w-0 truncate">{selectedItem.representative.title}</h2>
                      <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                        {activeCategory === 'system' && selectedItem.representative.link && (
                          <button
                            onClick={() => router.push(selectedItem.representative.link!)}
                            className="flex items-center gap-1.5 text-xs font-semibold px-2 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 3H3v10h10v-3M9 2h5v5M13.5 2.5L7 9" />
                            </svg>
                            View
                          </button>
                        )}
                        <button
                          onClick={togglePin}
                          className="flex items-center gap-1.5 text-xs font-semibold px-2 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M8 1a1 1 0 011 1v4.382l2.447 1.223A1 1 0 0112 9v1a1 1 0 01-1 1H9v3a1 1 0 11-2 0v-3H5a1 1 0 01-1-1V9a1 1 0 01.553-.895L7 6.882V2a1 1 0 011-1z" />
                          </svg>
                          {selectedItem.isPinned ? 'Unpin' : 'Pin'}
                        </button>
                        <button
                          onClick={toggleReadState}
                          className="flex items-center gap-1.5 text-xs font-semibold px-2 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2 4h12v8H2V4zm0 0l6 5 6-5" />
                          </svg>
                          {selectedItem.isUnread ? 'Mark read' : 'Mark unread'}
                        </button>
                        <button
                          onClick={deleteSelected}
                          className="flex items-center gap-1.5 text-xs font-semibold px-2 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h10M6 4V2.5A.5.5 0 016.5 2h3a.5.5 0 01.5.5V4m-7 0l.5 9a1 1 0 001 1h6a1 1 0 001-1l.5-9" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </div>
                    {activeCategory === 'direct_message' && participants.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1.5 truncate">
                        With: {participants.map((p) => p.name ?? p.email).join(', ')}
                      </p>
                    )}
                  </div>

                  {activeCategory === 'direct_message' ? (
                    <>
                      <div ref={threadListRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
                        {threadLoading && threadMessages.length === 0 ? (
                          <p className="text-sm text-gray-400">Loading…</p>
                        ) : (
                          threadMessages.map((message) => (
                            <div key={message.id} className="text-sm">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-semibold text-gray-900">{message.profiles?.name ?? 'Unknown'}</span>
                                <span className="text-xs text-gray-300">{formatTime(message.created_at)}</span>
                              </div>
                              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
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
                            maxLength={BODY_MAX_LENGTH}
                            placeholder="Write a reply"
                            className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 resize-none"
                            style={{ borderColor: 'var(--nwd-border)' }}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={sendReply}
                              disabled={replySending || !replyContent.trim()}
                              className="self-start px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ background: 'var(--nwd-teal)' }}
                            >
                              {replySending ? 'Sending…' : 'Reply'}
                            </button>
                            {profile?.role === 'admin' && (
                              <button
                                onClick={() => setShowAddUsers(true)}
                                className="self-start px-4 py-1.5 rounded-lg text-sm font-semibold border cursor-pointer transition-colors hover:bg-gray-50"
                                style={{ borderColor: 'var(--nwd-border)', color: '#6b7280' }}
                              >
                                Add User
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 overflow-y-auto px-5 py-4">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">{selectedItem.representative.body}</p>
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

      {showAddUsers && selectedItem && (
        <SelectUsersModal
          title="Add to Conversation"
          warning="Anyone you add will be able to see this conversation's full message history, not just messages sent after they join."
          confirmLabel={(n) => (n > 0 ? `Add ${n} User${n === 1 ? '' : 's'}` : 'Add')}
          excludeIds={participantIds}
          onClose={() => { setShowAddUsers(false); setAddUsersError(null) }}
          onConfirm={handleAddUsersConfirm}
          confirmError={addUsersError}
        />
      )}

      {showNewMessagePicker && (
        <SelectUsersModal
          title="New Message"
          confirmLabel={() => 'Next'}
          excludeIds={[]}
          onClose={() => setShowNewMessagePicker(false)}
          onConfirm={handleNewMessagePickerConfirm}
        />
      )}

      {newMessageRecipients && (
        <SendMessageModal
          recipients={newMessageRecipients}
          onClose={() => setNewMessageRecipients(null)}
        />
      )}
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
