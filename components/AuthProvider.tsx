'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/types/auth'

type AuthContextValue = {
  profile: UserProfile | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({ profile: null, loading: true })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setProfile(null)
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('id, role, name, is_temporary_password, email_notifications')
        .eq('id', user.id)
        .single()

      setProfile(data ? { ...data, email: user.email ?? '' } : null)
      setLoading(false)
    }

    loadProfile()

    // Supabase silently re-validates/refreshes the session (and fires this)
    // whenever a hidden tab regains focus, not just on real sign-in/out. Reload
    // the profile in the background without touching `loading` — flipping it
    // back to true would make RouteGuard swap the whole page for a spinner,
    // unmounting it and wiping any in-progress form state on every tab switch.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadProfile()
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
