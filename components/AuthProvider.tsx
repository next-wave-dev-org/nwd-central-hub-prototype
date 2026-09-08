'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/types/auth'

type AuthContextValue = {
  profile: UserProfile | null
  loading: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  profile: null,
  loading: true,
  refreshProfile: async () => {},
})

const PROFILE_COLUMNS =
  'id, role, name, is_temporary_password, email_notifications, pronouns, company, region, mini_profile_visibility, avatar_url'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Imperative refresh for callers that write to `profiles` directly (e.g. the
  // profile page's save handler). A plain table UPDATE fires no auth event, so
  // without this the context stays stale until the next mount or tab refocus.
  // Deliberately does not touch `loading` — flipping it would make RouteGuard
  // swap the page for a spinner and wipe any in-progress form state.
  const refreshProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setProfile(null)
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', user.id)
      .single()
    setProfile(data ? { ...data, email: user.email ?? '' } : null)
  }, [])

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
        .select(PROFILE_COLUMNS)
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
    <AuthContext.Provider value={{ profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
