'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function Navbar() {
  const [role, setRole] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()

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
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ padding: 20, borderBottom: '1px solid gray' }}>
      {role === 'Admin' && (
        <>
          <span>Admin Panel | </span>
          <button onClick={() => router.push('/login/admin')}>
            Approve Projects
          </button>
        </>
      )}

      {role === 'Contractor' && (
        <>
          <span>Contractor Dashboard | </span>
          <button onClick={() => router.push('/login/contractor')}>
            My Projects
          </button>
        </>
      )}

      {role === 'Client' && (
        <>
          <span>Client Dashboard | </span>
          <button onClick={() => router.push('/login/contractor')}>
            My Projects
          </button>
        </>
      )}

      <button onClick={handleLogout} style={{ marginLeft: 20 }}>
        Logout
      </button>
    </div>
  )
}