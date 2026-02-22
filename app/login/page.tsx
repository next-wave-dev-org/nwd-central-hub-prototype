'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const handleLogin = async () => {
    setMessage('') // clear old message

    // 1️⃣ Login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    if (!data?.user) {
      setMessage('Login failed')
      return
    }

    // 2️⃣ Fetch role from profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle()

    if (profileError) {
      setMessage(profileError.message)
      return
    }

    if (!profile) {
      setMessage('Profile not found')
      return
    }

    // 3️⃣ Success
    if (profile.role === 'Admin') {
      router.push('/login/admin')
    } else if (profile.role === 'Contractor') {
      router.push('/login/contractor')
    } else {
      router.push('/login/client')
    }
  }

  return (
    <div style={{ padding: 40 }}>
      
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <br /><br />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <br /><br />

      <button onClick={handleLogin}>Login</button>

      <p>{message}</p>
    </div>
  )
}