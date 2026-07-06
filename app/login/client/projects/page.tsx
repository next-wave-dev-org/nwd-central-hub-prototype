'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import RouteGuard from '@/components/RouteGuard'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'

type Project = {
  id: string
  title: string
  description: string
}

function ClientProjectsContent() {
  const { profile } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return

    const fetchProjects = async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, description')
        .eq('status', 'active')
        .eq('client_id', profile.id)

      if (!error) {
        setProjects(data || [])
      }

      setLoading(false)
    }

    fetchProjects()
  }, [profile])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'white' }}>

      <header className="bg-white border-b" style={{ borderColor: 'var(--nwd-border)' }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
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
            <Link href="/login/client" className="text-sm text-gray-500 font-medium hover:text-gray-700 transition-colors">
              Client Dashboard
            </Link>
            <span className="text-gray-400 mx-2 select-none">/</span>
            <span className="text-sm font-medium" style={{ color: 'var(--nwd-teal)' }}>Active Projects</span>
          </div>
          <Link
            href="/login/client"
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 3L5 8l5 5" />
            </svg>
            Back
          </Link>
        </div>
      </header>

      <main className="flex-1 px-6 py-10">
        <div className="max-w-5xl mx-auto">

          <div className="mb-8">
            <p
              className="text-xs font-semibold tracking-widest mb-2"
              style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}
            >
              CLIENT
            </p>
            <div className="flex items-end justify-between gap-4">
              <h1 className="text-3xl font-bold text-gray-900 leading-tight">Active Projects</h1>
              {!loading && (
                <span
                  className="text-xs font-semibold tracking-wider px-3 py-1.5 rounded-lg"
                  style={{
                    color: projects.length > 0 ? 'var(--nwd-teal)' : '#6b7280',
                    background: projects.length > 0
                      ? 'color-mix(in srgb, var(--nwd-teal) 12%, transparent)'
                      : 'color-mix(in srgb, #6b7280 10%, transparent)',
                    fontFamily: 'var(--font-geist-mono)',
                  }}
                >
                  {projects.length} project{projects.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-9 h-9 rounded-full border-[3px] border-gray-200 border-t-gray-600 animate-spin" />
              <p className="text-sm text-stone-400">Loading projects…</p>
            </div>
          )}

          {!loading && projects.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
              <p className="text-lg font-bold text-stone-800">No active projects</p>
              <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
                You have no active projects yet.
              </p>
            </div>
          )}

          {!loading && projects.length > 0 && (
            <div className="grid gap-4">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/login/projects/${project.id}`}
                  className="block p-6 border rounded-lg shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer"
                  style={{ borderColor: 'var(--nwd-border)' }}
                >
                  <h2 className="text-lg font-bold text-gray-900 mb-1">{project.title}</h2>
                  <p className="text-sm text-gray-500">{project.description}</p>
                </Link>
              ))}
            </div>
          )}

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

export default function ClientProjectsPage() {
  return (
    <RouteGuard allowedRoles={['client']}>
      <ClientProjectsContent />
    </RouteGuard>
  )
}
