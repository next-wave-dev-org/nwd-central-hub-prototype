'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import RouteGuard from '@/components/RouteGuard'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

type Project = {
  id: string
  title: string
  description: string
}

function ContractorContent() {
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

      if (!error) setProjects(data || [])
      setLoading(false)
    }

    fetchProjects()
  }, [profile])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'white' }}>

      <header className="bg-white border-b" style={{ borderColor: 'var(--nwd-border)' }}>
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Image
            src="/NextWaveDev_FINAL_small.png"
            alt="NextWaveDev logo"
            width={36}
            height={36}
            className="object-contain"
          />
          <div>
            <span className="font-semibold text-base tracking-tight" style={{ color: 'var(--nwd-purple)' }}>
              NextWaveDev
            </span>
            <span className="text-gray-400 mx-2 select-none">/</span>
            <span className="text-sm text-gray-500 font-medium">Contractor Dashboard</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-14">
        <div className="mb-12">
          <p
            className="text-xs font-semibold tracking-widest mb-2"
            style={{
              color: 'var(--nwd-teal)',
              fontFamily: 'var(--font-geist-mono)',
            }}
          >
            CONTRACTOR
          </p>

          <div className="flex items-end justify-between gap-4">
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">
              Active Projects
            </h1>

            {!loading && (
              <span className="mb-1 bg-stone-900 text-white text-xs font-semibold px-4 py-1.5 rounded-full">
                {projects.length} project{projects.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 mb-6">
          <a
            href="https://clockify.me"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
          >
            Log Hours
          </a>
        </div>

        <div className="h-0.5 bg-gradient-to-r from-stone-50 to-transparent rounded-full mb-10" />

        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-9 h-9 rounded-full border-[3px] border-stone-200 border-t-stone-900 animate-spin" />
            <p className="text-sm text-stone-400">Fetching your projects…</p>
          </div>
        )}

        {!loading && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <span className="text-5xl">📋</span>
            <p className="text-lg font-bold text-stone-800 mt-2">No active projects</p>
            <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
              You have no active projects assigned right now. Check back later.
            </p>
          </div>
        )}

        {!loading && projects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/login/projects/${project.id}`}
                className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-200 hover:-translate-y-1 flex flex-col"
              >
                <div className="h-1.5 bg-gradient-to-r from-stone-800 to-stone-500" />
                <div className="p-6 flex flex-col gap-3 flex-1">
                  <span className="self-start text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-0.5">
                    ● Active
                  </span>
                  <h2 className="text-lg font-bold text-stone-900 leading-snug tracking-tight">
                    {project.title}
                  </h2>
                  <p className="text-sm text-stone-500 leading-relaxed flex-1">
                    {project.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
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

export default function ContractorDashboardPage() {
  return (
    <RouteGuard allowedRoles={['contractor']}>
      <ContractorContent />
    </RouteGuard>
  )
}
