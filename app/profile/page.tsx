'use client'

import { useState } from 'react'
import Link from 'next/link'
import RouteGuard from '@/components/RouteGuard'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'

function ProfileContent() {
  const { profile } = useAuth()

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleEdit = () => {
    setName(profile?.name ?? '')
    setEmail(profile?.email ?? '')
    setError('')
    setSuccess('')
    setEditing(true)
  }

  const handleCancel = () => {
    setName(profile?.name ?? '')
    setEmail(profile?.email ?? '')
    setError('')
    setEditing(false)
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!profile) return

    setSaving(true)
    setError('')
    setSuccess('')

    if (name !== (profile.name ?? '')) {
      const { error: nameError } = await supabase
        .from('profiles')
        .update({ name })
        .eq('id', profile.id)

      if (nameError) {
        setError(nameError.message)
        setSaving(false)
        return
      }
    }

    if (email !== (profile.email ?? '')) {
      const { error: emailError } = await supabase.auth.updateUser({ email })

      if (emailError) {
        setError(emailError.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    setEditing(false)
    setSuccess(
      email !== (profile.email ?? '')
        ? 'Profile updated. Check your inbox to confirm your new email address.'
        : 'Profile updated successfully.'
    )
  }

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

          <div className="bg-white p-8 rounded-lg shadow-md mb-6">
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
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
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
              </dl>
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
