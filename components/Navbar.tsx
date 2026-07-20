'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthProvider'
import UserMenu from './UserMenu'
import { useEffect, useState } from "react"

export default function Navbar() {
  const { profile } = useAuth()
  const router = useRouter()

  const [role, setRole] = useState(null)

  useEffect(() => {
    const fetchRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      setRole(profile?.role || null)
    }

    fetchRole()
  }, [router])

  return (
    <div style={{ padding: 20, borderBottom: '1px solid gray' }} className="flex items-center justify-between">
      <div>
        {profile?.role === 'admin' && (
          <>
            <span>Admin Panel | </span>

            <button onClick={() => router.push('/login/admin')}>
              Approve Projects
            </button>
          </>
        )}

        {profile?.role === 'contractor' && (
          <>
            <span>Contractor Dashboard | </span>

            <button onClick={() => router.push('/login/contractor')}>
              My Projects
            </button>
          </>
        )}

        {profile?.role === 'client' && (
          <>
            <span>Client Dashboard | </span>

            <button onClick={() => router.push('/login/client')}>
              My Projects
            </button>
          </>
        )}
      </div>

      <UserMenu />
    </div>
  )
}
