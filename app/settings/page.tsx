'use client'

import { useEffect, useState } from 'react'
import type { UserIdentity } from '@supabase/supabase-js'
import RouteGuard from '@/components/RouteGuard'
import Navbar from '@/components/Navbar'
import { supabase } from '@/lib/supabase'
import { GoogleIcon, GithubIcon, LinkedInIcon } from '@/components/SocialIcons'

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Australia/Sydney',
]

type OAuthProvider = 'google' | 'linkedin_oidc' | 'github'

const LINKED_ACCOUNTS: { name: string; provider: OAuthProvider; Icon: () => React.JSX.Element }[] = [
  { name: 'Google', provider: 'google', Icon: GoogleIcon },
  { name: 'LinkedIn', provider: 'linkedin_oidc', Icon: LinkedInIcon },
  { name: 'GitHub', provider: 'github', Icon: GithubIcon },
]

function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description: string
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="min-w-0 pr-4">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 cursor-pointer"
        style={{ background: checked ? 'var(--nwd-teal)' : '#d1d5db' }}
      >
        <span
          className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
          style={{ transform: checked ? 'translateX(22px)' : 'translateX(4px)' }}
        />
      </button>
    </div>
  )
}

function SettingsContent() {

  const [timezone, setTimezone] = useState(TIMEZONES[0])
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(false)
  const [smsNotifications, setSmsNotifications] = useState(false)

  const [identities, setIdentities] = useState<UserIdentity[]>([])
  const [identitiesLoading, setIdentitiesLoading] = useState(true)
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider | null>(null)
  const [linkedAccountsError, setLinkedAccountsError] = useState('')
  const [linkedAccountsMessage, setLinkedAccountsMessage] = useState('')

  const loadIdentities = async () => {
    setIdentitiesLoading(true)
    const { data, error } = await supabase.auth.getUserIdentities()
    if (error) {
      setLinkedAccountsError(error.message)
    } else {
      setIdentities(data.identities)
    }
    setIdentitiesLoading(false)
  }

  useEffect(() => {
    const init = async () => {
      await loadIdentities()

      const params = new URLSearchParams(window.location.search)
      const error = params.get('error')
      if (error) {
        setLinkedAccountsError(error)
        window.history.replaceState(null, '', '/settings')
      }
    }
    init()
  }, [])

  const handleConnect = async (provider: OAuthProvider) => {
    setLinkedAccountsError('')
    setLinkedAccountsMessage('')
    setPendingProvider(provider)

    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
      },
    })

    if (error) {
      setLinkedAccountsError(error.message)
      setPendingProvider(null)
    }
    // On success the browser navigates to the provider — nothing else to do here.
  }

  const handleDisconnect = async (identity: UserIdentity) => {
    setLinkedAccountsError('')
    setLinkedAccountsMessage('')
    setPendingProvider(identity.provider as OAuthProvider)

    const { error } = await supabase.auth.unlinkIdentity(identity)

    if (error) {
      setLinkedAccountsError(error.message)
    } else {
      setLinkedAccountsMessage(`Disconnected ${identity.provider}.`)
      await loadIdentities()
    }
    setPendingProvider(null)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'white' }}>
      <Navbar title="Settings" />

      <main className="flex-1 px-6 py-14">
        <div className="w-full max-w-md mx-auto">
          <div className="mb-8">
            <p
              className="text-xs font-semibold tracking-widest mb-2"
              style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}
            >
              ACCOUNT
            </p>
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">Settings</h1>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-8 rounded-lg shadow-md">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Timezone</h2>
              <p className="text-sm text-gray-400 mb-4">Used to display dates and times across the app.</p>

              <label className="block text-sm font-medium text-gray-700">Preferred timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-2">Coming soon — timezone preferences aren&apos;t saved yet.</p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Notifications</h2>
              <p className="text-sm text-gray-400 mb-2">Choose how you want to be notified.</p>

              <div className="divide-y divide-gray-100">
                <ToggleSwitch
                  label="Email notifications"
                  description="Project and account updates via email"
                  checked={emailNotifications}
                  onChange={setEmailNotifications}
                />
                <ToggleSwitch
                  label="Push notifications"
                  description="Alerts sent to your browser or device"
                  checked={pushNotifications}
                  onChange={setPushNotifications}
                />
                <ToggleSwitch
                  label="SMS notifications"
                  description="Text messages for urgent updates"
                  checked={smsNotifications}
                  onChange={setSmsNotifications}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">Coming soon — notification preferences aren&apos;t saved yet.</p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Linked Accounts</h2>
              <p className="text-sm text-gray-400 mb-4">Connect third-party accounts for single sign-on.</p>

              {linkedAccountsMessage && (
                <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800 mb-4">
                  {linkedAccountsMessage}
                </div>
              )}

              {linkedAccountsError && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-4">
                  {linkedAccountsError}
                </div>
              )}

              <div className="space-y-3">
                {LINKED_ACCOUNTS.map((account) => {
                  const identity = identities.find((i) => i.provider === account.provider)
                  const isPending = pendingProvider === account.provider
                  const canDisconnect = identities.length > 1

                  return (
                    <div
                      key={account.name}
                      className="flex items-center justify-between px-4 py-3 border rounded-md"
                      style={{ borderColor: 'var(--nwd-border)' }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full border text-gray-600 flex-shrink-0" style={{ borderColor: 'var(--nwd-border)' }}>
                          <account.Icon />
                        </span>
                        <div>
                          <span className="text-sm font-medium text-gray-900">{account.name}</span>
                          {identity && (
                            <p className="text-xs text-gray-400">Connected</p>
                          )}
                        </div>
                      </div>
                      {identity ? (
                        <button
                          onClick={() => handleDisconnect(identity)}
                          disabled={identitiesLoading || isPending || !canDisconnect}
                          title={canDisconnect ? 'Disconnect this account' : 'Cannot disconnect your only sign-in method'}
                          className="text-xs px-3 py-1.5 rounded border font-medium text-red-600 border-red-200 hover:bg-red-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isPending ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleConnect(account.provider)}
                          disabled={identitiesLoading || pendingProvider !== null}
                          className="text-xs px-3 py-1.5 rounded border font-medium cursor-pointer hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ borderColor: 'var(--nwd-border)', color: 'var(--nwd-teal)' }}
                        >
                          {isPending ? 'Connecting…' : 'Connect'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

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

export default function SettingsPage() {
  return (
    <RouteGuard allowedRoles={['admin', 'client', 'contractor']}>
      <SettingsContent />
    </RouteGuard>
  )
}
