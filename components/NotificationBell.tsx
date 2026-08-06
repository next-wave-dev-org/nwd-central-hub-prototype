'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'

const POLL_INTERVAL_MS = 8000

export default function NotificationBell() {
  const { profile } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!profile?.id) return

    let cancelled = false

    const fetchCount = async () => {
      const { count: unread } = await supabase
        .from('direct_messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', profile.id)
        .is('read_at', null)

      if (!cancelled) setCount(unread ?? 0)
    }

    fetchCount()
    const intervalId = setInterval(fetchCount, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [profile?.id])

  if (!profile) return null

  return (
    <Link
      href="/notifications"
      className="relative flex items-center justify-center w-9 h-9 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
      aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {count > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
          style={{ background: 'var(--nwd-purple)' }}
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  )
}
