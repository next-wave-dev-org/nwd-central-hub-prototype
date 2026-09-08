'use client'

import { useState } from 'react'
import Link from 'next/link'
import RouteGuard from '@/components/RouteGuard'
import Navbar from '@/components/Navbar'
import ToggleSwitch from '@/components/ToggleSwitch'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import type { MiniProfileVisibility } from '@/types/auth'

const DEFAULT_VISIBILITY: MiniProfileVisibility = {
  pronouns: true,
  company: true,
  region: true,
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  client: 'Client',
  contractor: 'Contractor',
}

const inputClass =
  'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900'

function ProfileContent() {
  const { profile, refreshProfile } = useAuth()

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pronouns, setPronouns] = useState('')
  const [company, setCompany] = useState('')
  const [region, setRegion] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Mini-profile visibility: render from the saved profile, with an optimistic
  // overlay only while a toggle write is in flight.
  const savedVisibility = profile?.mini_profile_visibility ?? DEFAULT_VISIBILITY
  const [pendingVisibility, setPendingVisibility] = useState<MiniProfileVisibility | null>(null)
  const visibility = pendingVisibility ?? savedVisibility
  const [visibilityError, setVisibilityError] = useState<string | null>(null)

  const handleEdit = () => {
    setName(profile?.name ?? '')
    setEmail(profile?.email ?? '')
    setPronouns(profile?.pronouns ?? '')
    setCompany(profile?.company ?? '')
    setRegion(profile?.region ?? '')
    setError('')
    setSuccess('')
    setEditing(true)
  }

  const handleCancel = () => {
    setError('')
    setEditing(false)
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!profile) return

    setSaving(true)
    setError('')
    setSuccess('')

    const trim = (v: string) => {
      const t = v.trim()
      return t.length ? t : null
    }
    const updates: Record<string, string | null> = {}
    if (name.trim() !== (profile.name ?? '')) updates.name = name.trim()
    if (trim(pronouns) !== (profile.pronouns ?? null)) updates.pronouns = trim(pronouns)
    if (trim(company) !== (profile.company ?? null)) updates.company = trim(company)
    if (trim(region) !== (profile.region ?? null)) updates.region = trim(region)

    if (Object.keys(updates).length > 0) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id)

      if (profileError) {
        setError(profileError.message)
        setSaving(false)
        return
      }
    }

    const emailChanged = email.trim() !== (profile.email ?? '')
    if (emailChanged) {
      const { error: emailError } = await supabase.auth.updateUser({ email: email.trim() })

      if (emailError) {
        setError(emailError.message)
        setSaving(false)
        return
      }
    }

    await refreshProfile()

    setSaving(false)
    setEditing(false)
    setSuccess(
      emailChanged
        ? 'Profile updated. Check your inbox to confirm your new email address.'
        : 'Profile updated successfully.'
    )
  }

  const handleVisibilityChange = async (field: keyof MiniProfileVisibility, value: boolean) => {
    if (!profile) return
    const next = { ...visibility, [field]: value }
    setPendingVisibility(next)
    setVisibilityError(null)

    const { error: visError } = await supabase
      .from('profiles')
      .update({ mini_profile_visibility: next })
      .eq('id', profile.id)

    if (visError) {
      setPendingVisibility(null)
      setVisibilityError(visError.message)
      return
    }

    await refreshProfile()
    setPendingVisibility(null)
  }

  const roleLabel = profile ? ROLE_LABELS[profile.role] ?? profile.role : ''

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'white' }}>
      <Navbar title="Profile" />

      <main className="flex-1 px-6 py-14">
        <div className="w-full max-w-md mx-auto">
          <div className="mb-8">
            <p
              className="text-xs font-semibold tracking-widest mb-2"
              style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}
            >
              ACCOUNT
            </p>
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">Profile</h1>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-8 rounded-lg shadow-md">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Account Details</h2>
                {!editing && (
                  <button
                    onClick={handleEdit}
                    className="text-sm font-medium transition-colors cursor-pointer"
                    style={{ color: 'var(--nwd-teal)' }}
                  >
                    Edit
                  </button>
                )}
              </div>

              {success && (
                <div className="rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-800 mb-4">
                  {success}
                </div>
              )}

              {error && (
                <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-4">
                  {error}
                </div>
              )}

              {editing ? (
                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Pronouns</label>
                    <input
                      type="text"
                      value={pronouns}
                      onChange={(e) => setPronouns(e.target.value)}
                      placeholder="e.g. she/her, they/them"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Company</label>
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Region</label>
                    <input
                      type="text"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder="e.g. Pacific Northwest, EMEA"
                      className={inputClass}
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={saving}
                      className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Name</dt>
                    <dd className="text-sm text-gray-900 mt-0.5">{profile?.name || 'Not set'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                    <dd className="text-sm text-gray-900 mt-0.5">{profile?.email}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Role</dt>
                    <dd className="text-sm text-gray-900 mt-0.5">{roleLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Pronouns</dt>
                    <dd className="text-sm text-gray-900 mt-0.5">{profile?.pronouns || 'Not set'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Company</dt>
                    <dd className="text-sm text-gray-900 mt-0.5">{profile?.company || 'Not set'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Region</dt>
                    <dd className="text-sm text-gray-900 mt-0.5">{profile?.region || 'Not set'}</dd>
                  </div>
                </dl>
              )}
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Mini Profile</h2>
              <p className="text-sm text-gray-400 mb-2">
                Choose which details appear on your profile card when others view it. Name and role
                are always shown.
              </p>

              <div className="divide-y divide-gray-100">
                <ToggleSwitch
                  label="Show pronouns"
                  description="Display your pronouns on your profile card"
                  checked={visibility.pronouns}
                  onChange={(v) => handleVisibilityChange('pronouns', v)}
                />
                <ToggleSwitch
                  label="Show company"
                  description="Display your company on your profile card"
                  checked={visibility.company}
                  onChange={(v) => handleVisibilityChange('company', v)}
                />
                <ToggleSwitch
                  label="Show region"
                  description="Display your region on your profile card"
                  checked={visibility.region}
                  onChange={(v) => handleVisibilityChange('region', v)}
                />
              </div>

              {visibilityError && (
                <p className="text-xs mt-2" style={{ color: '#9f1239' }}>{visibilityError}</p>
              )}
            </div>

            <Link
              href="/change-password"
              className="group flex items-center gap-5 rounded-lg px-5 py-4 border transition-colors hover:brightness-95"
              style={{ borderColor: 'var(--nwd-purple)', background: 'white' }}
            >
              <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: 'var(--nwd-purple)' }} />
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-gray-900">Change Password</span>
                <p className="text-sm text-gray-400">Update your account password</p>
              </div>
              <svg
                className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0"
                fill="none"
                viewBox="0 0 16 16"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
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

export default function ProfilePage() {
  return (
    <RouteGuard allowedRoles={['admin', 'client', 'contractor']}>
      <ProfileContent />
    </RouteGuard>
  )
}
