'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'
import type { UserRole } from '@/types/auth'

type Props = {
  allowedRoles: UserRole[]
  children: React.ReactNode
}

export default function RouteGuard({ allowedRoles, children }: Props) {
  const { profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    if (!profile) {
      router.replace('/login')
      return
    }

    if (!allowedRoles.includes(profile.role)) {
      router.replace('/unauthorized')
    }
  }, [profile, loading, allowedRoles, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-800">
        <div className="w-8 h-8 rounded-full border-[3px] border-stone-600 border-t-stone-100 animate-spin" />
      </div>
    )
  }

  if (!profile || !allowedRoles.includes(profile.role)) {
    return null
  }

  return <>{children}</>
}
