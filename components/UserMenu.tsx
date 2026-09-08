'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthProvider'

export default function UserMenu() {
  const { profile } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!profile) return null

  return (
    <div className="relative flex-shrink-0" ref={menuRef}>
      {/* Whole name + gear is one trigger — clicking the name toggles the same
          dropdown as the gear. "Welcome," is desktop-only; name shows always. */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-2 cursor-pointer"
        aria-label="Open user menu"
        aria-expanded={open}
      >
        <span className="text-sm text-gray-500 group-hover:text-gray-700 font-medium truncate max-w-[12rem] transition-colors">
          <span className="hidden sm:inline">Welcome, </span>
          {profile.name || profile.email}
        </span>
        <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-40 rounded-md border bg-white shadow-md py-1 z-20"
          style={{ borderColor: 'var(--nwd-border)' }}
        >
          <Link
            href="/profile"
            className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
          <Link
            href="/notifications"
            className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            onClick={() => setOpen(false)}
          >
            Notifications
          </Link>
          <Link
            href="/settings"
            className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <button
            onClick={handleLogout}
            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  )
}
