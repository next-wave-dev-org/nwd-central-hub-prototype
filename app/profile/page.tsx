'use client'

import { useRef, useState } from 'react'
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

const AVATAR_BUCKET = 'avatars'
const AVATAR_PUBLIC_PREFIX = `/storage/v1/object/public/${AVATAR_BUCKET}/`
const MAX_AVATAR_BYTES = 2 * 1024 * 1024
// Kept in sync with the bucket's allowed_mime_types (see the Profile Avatar
// Migration in docs/database-schema.md) — this check is UX only, the bucket
// enforces both type and size server-side.
const AVATAR_EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
const AVATAR_ACCEPT = Object.keys(AVATAR_EXT_BY_TYPE).join(',')

// The stored avatar_url is a full public URL; recover the in-bucket object path
// so the previous file can be deleted after a replace.
function avatarStoragePath(url: string | null | undefined): string | null {
  if (!url) return null
  const i = url.indexOf(AVATAR_PUBLIC_PREFIX)
  return i === -1 ? null : decodeURIComponent(url.slice(i + AVATAR_PUBLIC_PREFIX.length))
}

function initialsFrom(name: string | undefined, email: string | undefined): string {
  const source = name?.trim() || email?.trim() || '?'
  const parts = source.split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2)
  return letters.toUpperCase()
}

// Loose, permissive floors that mirror the CHECK constraints in the Profile
// Security Fields Migration (docs/database-schema.md). Intentionally not strict
// RFC validation — just enough to catch typos before the write.
const RECOVERY_EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const PRIMARY_PHONE_RE = /^[0-9+()\-.\s]{7,20}$/

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

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const avatarUrl = profile?.avatar_url ?? null

  // Security card — its own edit/save state so saving it doesn't clear the
  // Account Details banners (and vice versa).
  const [securityEditing, setSecurityEditing] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [primaryPhone, setPrimaryPhone] = useState('')
  const [securitySaving, setSecuritySaving] = useState(false)
  const [securityError, setSecurityError] = useState('')
  const [securitySuccess, setSecuritySuccess] = useState('')

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

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file after an error
    if (!file || !profile) return

    setAvatarError('')

    const ext = AVATAR_EXT_BY_TYPE[file.type]
    if (!ext) {
      setAvatarError('Use a PNG, JPG, WebP, or GIF image.')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('Image must be 2 MB or smaller.')
      return
    }

    setAvatarBusy(true)

    const prevPath = avatarStoragePath(avatarUrl)
    const newPath = `${profile.id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(newPath, file, { contentType: file.type })

    if (uploadError) {
      setAvatarError(uploadError.message)
      setAvatarBusy(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(newPath)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', profile.id)

    if (updateError) {
      await supabase.storage.from(AVATAR_BUCKET).remove([newPath]) // don't orphan the upload
      setAvatarError(updateError.message)
      setAvatarBusy(false)
      return
    }

    if (prevPath && prevPath !== newPath) {
      await supabase.storage.from(AVATAR_BUCKET).remove([prevPath]) // best effort
    }

    await refreshProfile()
    setAvatarBusy(false)
  }

  const handleAvatarRemove = async () => {
    if (!profile || !avatarUrl) return
    setAvatarError('')
    setAvatarBusy(true)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', profile.id)

    if (updateError) {
      setAvatarError(updateError.message)
      setAvatarBusy(false)
      return
    }

    const path = avatarStoragePath(avatarUrl)
    if (path) await supabase.storage.from(AVATAR_BUCKET).remove([path]) // best effort

    await refreshProfile()
    setAvatarBusy(false)
  }

  const handleSecurityEdit = () => {
    setRecoveryEmail(profile?.recovery_email ?? '')
    setPrimaryPhone(profile?.primary_phone ?? '')
    setSecurityError('')
    setSecuritySuccess('')
    setSecurityEditing(true)
  }

  const handleSecurityCancel = () => {
    setSecurityError('')
    setSecurityEditing(false)
  }

  const handleSecuritySave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!profile) return

    const trimmedEmail = recoveryEmail.trim()
    const trimmedPhone = primaryPhone.trim()

    if (trimmedEmail && !RECOVERY_EMAIL_RE.test(trimmedEmail)) {
      setSecurityError('Enter a valid recovery email address.')
      return
    }
    if (trimmedEmail && trimmedEmail.toLowerCase() === (profile.email ?? '').toLowerCase()) {
      setSecurityError('Recovery email must be different from your login email.')
      return
    }
    if (trimmedPhone && !PRIMARY_PHONE_RE.test(trimmedPhone)) {
      setSecurityError('Enter a valid phone number (7–20 digits, spaces, and + ( ) - . only).')
      return
    }

    const nextEmail = trimmedEmail || null
    const nextPhone = trimmedPhone || null
    const updates: Record<string, string | null> = {}
    if (nextEmail !== (profile.recovery_email ?? null)) updates.recovery_email = nextEmail
    if (nextPhone !== (profile.primary_phone ?? null)) updates.primary_phone = nextPhone

    if (Object.keys(updates).length === 0) {
      setSecurityEditing(false)
      return
    }

    setSecuritySaving(true)
    setSecurityError('')
    setSecuritySuccess('')

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile.id)

    if (updateError) {
      setSecurityError(updateError.message)
      setSecuritySaving(false)
      return
    }

    await refreshProfile()
    setSecuritySaving(false)
    setSecurityEditing(false)
    setSecuritySuccess('Security details updated.')
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

              <div className="flex items-center gap-4 mb-6">
                {avatarUrl ? (
                  <span className="block w-20 h-20 rounded-full overflow-hidden border border-gray-200 flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element -- 80px avatar from Supabase Storage; the image optimizer adds a proxy round-trip for no gain */}
                    <img
                      src={avatarUrl}
                      alt="Profile photo"
                      className="w-full h-full object-cover"
                    />
                  </span>
                ) : (
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-xl font-semibold text-white flex-shrink-0"
                    style={{ background: 'var(--nwd-purple)' }}
                  >
                    {initialsFrom(profile?.name, profile?.email)}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={avatarBusy}
                      className="text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ color: 'var(--nwd-teal)' }}
                    >
                      {avatarBusy ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Upload photo'}
                    </button>
                    {avatarUrl && !avatarBusy && (
                      <button
                        type="button"
                        onClick={handleAvatarRemove}
                        className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">PNG, JPG, WebP, or GIF. Max 2&nbsp;MB.</p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={AVATAR_ACCEPT}
                  onChange={handleAvatarSelect}
                  className="hidden"
                />
              </div>

              {avatarError && (
                <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-4">
                  {avatarError}
                </div>
              )}

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
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Security</h2>
                {!securityEditing && (
                  <button
                    onClick={handleSecurityEdit}
                    className="text-sm font-medium transition-colors cursor-pointer"
                    style={{ color: 'var(--nwd-teal)' }}
                  >
                    Edit
                  </button>
                )}
              </div>

              <p className="text-sm text-gray-400 mb-4">
                A recovery email and phone number help us verify it&apos;s you if you lose access to
                your account.
              </p>

              {securitySuccess && (
                <div className="rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-800 mb-4">
                  {securitySuccess}
                </div>
              )}

              {securityError && (
                <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-4">
                  {securityError}
                </div>
              )}

              {securityEditing ? (
                <form onSubmit={handleSecuritySave} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Recovery Email</label>
                    <input
                      type="email"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Primary Phone</label>
                    <input
                      type="tel"
                      value={primaryPhone}
                      onChange={(e) => setPrimaryPhone(e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      className={inputClass}
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={securitySaving}
                      className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {securitySaving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSecurityCancel}
                      disabled={securitySaving}
                      className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Recovery Email</dt>
                    <dd className="text-sm text-gray-900 mt-0.5">
                      {profile?.recovery_email || 'Not set'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Primary Phone</dt>
                    <dd className="text-sm text-gray-900 mt-0.5">
                      {profile?.primary_phone || 'Not set'}
                    </dd>
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
