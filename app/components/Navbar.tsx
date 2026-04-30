'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthProvider'

export default function Navbar() {
  const { profile } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ padding: 20, borderBottom: '1px solid gray' }}>
      {profile?.role === 'Admin' && (
        <>
          <span>Admin Panel | </span>
          <button onClick={() => router.push('/login/admin')}>
            Approve Projects
          </button>
        </>
      )}

      {profile?.role === 'Contractor' && (
        <>
          <span>Contractor Dashboard | </span>
          <button onClick={() => router.push('/login/contractor')}>
            My Projects
          </button>
        </>
      )}

      {profile?.role === 'Client' && (
        <>
          <span>Client Dashboard | </span>
          <button onClick={() => router.push('/login/client')}>
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
