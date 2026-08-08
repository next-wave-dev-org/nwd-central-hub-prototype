'use client'

import { useState } from 'react'
import RouteGuard from '@/components/RouteGuard'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'

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

const LINKED_ACCOUNTS = [
  { name: 'Google', initial: 'G', color: '#EA4335' },
  { name: 'LinkedIn', initial: 'in', color: '#0A66C2' },
  { name: 'GitHub', initial: 'GH', color: '#24292F' },
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
  const { profile } = useAuth()

  const [timezone, setTimezone] = useState(TIMEZONES[0])
  const [emailNotifications, setEmailNotifications] = useState(profile?.email_notifications ?? true)
  const [emailNotificationsError, setEmailNotificationsError] = useState<string | null>(null)

  async function handleEmailNotificationsChange(value: boolean) {
    setEmailNotifications(value)
    setEmailNotificationsError(null)
    if (!profile?.id) return
    const { error } = await supabase.from('profiles').update({ email_notifications: value }).eq('id', profile.id)
    if (error) {
      setEmailNotifications(!value)
      setEmailNotificationsError(error.message)
    }
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
                  description="Direct messages and announcements via email"
                  checked={emailNotifications}
                  onChange={handleEmailNotificationsChange}
                />
              </div>
              {emailNotificationsError && (
                <p className="text-xs mt-2" style={{ color: '#9f1239' }}>{emailNotificationsError}</p>
              )}
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Linked Accounts</h2>
              <p className="text-sm text-gray-400 mb-4">Connect third-party accounts for single sign-on.</p>

              <div className="space-y-3">
                {LINKED_ACCOUNTS.map((account) => (
                  <div
                    key={account.name}
                    className="flex items-center justify-between px-4 py-3 border rounded-md"
                    style={{ borderColor: 'var(--nwd-border)' }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold text-white flex-shrink-0"
                        style={{ background: account.color }}
                      >
                        {account.initial}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{account.name}</span>
                    </div>
                    <button
                      disabled
                      title="Coming soon"
                      className="text-xs px-3 py-1.5 rounded border font-medium text-gray-400 border-gray-200 cursor-not-allowed"
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Coming soon — account linking will be available once OAuth support is added.
              </p>
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
