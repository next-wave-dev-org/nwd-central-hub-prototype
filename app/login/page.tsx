'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { GoogleIcon, GithubIcon, LinkedInIcon } from '@/components/SocialIcons'

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 6l10 7 10-7" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a20.3 20.3 0 0 1-3.22 4.39M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  )
}

type OAuthProvider = 'google' | 'github' | 'linkedin_oidc'

const SOCIAL_PROVIDERS: { name: string; provider: OAuthProvider; Icon: () => React.JSX.Element }[] = [
  { name: 'Google', provider: 'google', Icon: GoogleIcon },
  { name: 'GitHub', provider: 'github', Icon: GithubIcon },
  { name: 'LinkedIn', provider: 'linkedin_oidc', Icon: LinkedInIcon },
]

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthProvider, setOauthProvider] = useState<OAuthProvider | null>(null)

  const handleOAuthSignIn = async (provider: OAuthProvider) => {
    setMessage('')
    setOauthProvider(provider)

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setMessage(error.message)
      setOauthProvider(null)
    }
    // On success the browser navigates to the provider — nothing else to do here.
  }

  useEffect(() => {
    const checkOAuthError = () => {
      const params = new URLSearchParams(window.location.search)
      const error = params.get('error')
      if (error) {
        setMessage(error)
        window.history.replaceState(null, '', '/login')
      }
    }
    checkOAuthError()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setLoading(true)

    // 1️⃣ Login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    if (!data?.user) {
      setMessage('Login failed')
      setLoading(false)
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
      setLoading(false)
      return
    }

    if (!profile) {
      setMessage('Profile not found')
      setLoading(false)
      return
    }

    // 3️⃣ Success
    if (profile.role === 'admin') {
      router.push('/login/admin')
    } else if (profile.role === 'contractor') {
      router.push('/login/contractor')
    } else {
      router.push('/login/client')
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'white' }}>

      {/* Header */}
      <header className="bg-white border-b" style={{ borderColor: 'var(--nwd-border)' }}>
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Image
            src="/NextWaveDev_FINAL_small.png"
            alt="NextWaveDev logo"
            width={36}
            height={36}
            className="object-contain"
          />
          <div className="flex items-center flex-1 min-w-0">
            <span className="font-semibold text-base tracking-tight" style={{ color: 'var(--nwd-purple)' }}>
              NextWaveDev
            </span>
            <span className="text-gray-400 mx-2 select-none">/</span>
            <span className="text-sm font-medium truncate" style={{ color: 'var(--nwd-teal)' }}>
              Sign In
            </span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-14">
        <div className="w-full max-w-md">

          {/* Page heading */}
          <div className="mb-8">
            <p
              className="text-xs font-semibold tracking-widest mb-2"
              style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}
            >
              PORTAL ACCESS
            </p>
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">
              Welcome back
            </h1>
            <p className="text-sm text-gray-400 mt-2">
              Sign in to access your NWD Central Hub workspace.
            </p>
          </div>

          {/* Sign-in card */}
          <div className="bg-white rounded-lg border p-6 sm:p-8 shadow-sm" style={{ borderColor: 'var(--nwd-border)' }}>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <div className="relative mt-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <MailIcon />
                  </span>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-md border pl-10 pr-3 py-2 text-sm text-gray-900 outline-none focus:ring-2"
                    style={{ borderColor: 'var(--nwd-border)' }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="relative mt-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <LockIcon />
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-md border pl-10 pr-10 py-2 text-sm text-gray-900 outline-none focus:ring-2"
                    style={{ borderColor: 'var(--nwd-border)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {message && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || oauthProvider !== null}
                className="w-full flex justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-colors cursor-pointer hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--nwd-purple)' }}
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="h-px flex-1" style={{ background: 'var(--nwd-border)' }} />
              <span
                className="text-xs text-gray-400 uppercase tracking-wider"
                style={{ fontFamily: 'var(--font-geist-mono)' }}
              >
                Or continue with
              </span>
              <div className="h-px flex-1" style={{ background: 'var(--nwd-border)' }} />
            </div>

            {/* Social sign-in */}
            <div className="grid grid-cols-3 gap-3">
              {SOCIAL_PROVIDERS.map(({ name, provider, Icon }) => (
                <button
                  key={name}
                  type="button"
                  disabled={oauthProvider !== null || loading}
                  title={`Sign in with ${name}`}
                  aria-label={`Sign in with ${name}`}
                  onClick={() => handleOAuthSignIn(provider)}
                  className="flex items-center justify-center rounded-md border py-2.5 text-gray-600 transition-colors cursor-pointer hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ borderColor: 'var(--nwd-border)' }}
                >
                  {oauthProvider === provider ? (
                    <span className="text-xs">…</span>
                  ) : (
                    <Icon />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 px-4">
        <p
          className="text-xs tracking-wide"
          style={{ color: 'var(--nwd-purple)', opacity: 0.4, fontFamily: 'var(--font-geist-mono)' }}
        >
          NWD CENTRAL HUB
        </p>
      </footer>

    </div>
  )
}
