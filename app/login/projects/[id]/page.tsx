'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import RouteGuard from '@/components/RouteGuard'
import BackButton from '@/components/BackButton'
import { supabase } from '@/lib/supabase'

type ContractorProject = {
  contractor_id: string
  profiles: { name: string | null; email: string | null } | null
}

type Project = {
  id: string
  title: string
  description: string | null
  budget: string | null
  status: string
  created_at: string
  contractor_projects: ContractorProject[]
}

function ProjectWorkspaceContent() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return

    const fetchProject = async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id, title, description, budget, status, created_at,
          contractor_projects(contractor_id, profiles(name, email))
        `)
        .eq('id', id)
        .single()

      if (error || !data) {
        setNotFound(true)
      } else {
        setProject(data as unknown as Project)
      }
      setLoading(false)
    }

    fetchProject()
  }, [id])

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
          <div>
            <span className="font-semibold text-base tracking-tight" style={{ color: 'var(--nwd-purple)' }}>
              NextWaveDev
            </span>
            <span className="text-gray-400 mx-2 select-none">/</span>
            <span className="text-sm text-gray-500 font-medium">Project Workspace</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-14 w-full">
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-9 h-9 rounded-full border-[3px] border-gray-200 border-t-gray-600 animate-spin" />
            <p className="text-sm text-stone-400">Loading project…</p>
          </div>
        )}

        {!loading && notFound && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <p className="text-lg font-bold text-stone-800">Project not found</p>
            <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
              This project does not exist or you do not have access to it.
            </p>
            <BackButton />
          </div>
        )}

        {!loading && project && (
          <>
            <BackButton />

            <p
              className="text-xs font-semibold tracking-widest mb-2"
              style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}
            >
              PROJECT
            </p>

            <div className="flex items-center gap-3 mb-10">
              <h1 className="text-3xl font-bold text-gray-900 leading-tight">{project.title}</h1>
              <span
                className="text-xs font-semibold tracking-wider px-2 py-0.5 rounded"
                style={{
                  color: '#065f46',
                  background: 'color-mix(in srgb, #10b981 15%, transparent)',
                  fontFamily: 'var(--font-geist-mono)',
                }}
              >
                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white rounded-lg border p-5" style={{ borderColor: 'var(--nwd-border)' }}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</p>
                <p className="text-sm text-gray-900 leading-relaxed">{project.description || '—'}</p>
              </div>

              <div className="bg-white rounded-lg border p-5" style={{ borderColor: 'var(--nwd-border)' }}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Budget</p>
                <p className="text-sm text-gray-900">{project.budget || '—'}</p>
              </div>

              <div className="bg-white rounded-lg border p-5" style={{ borderColor: 'var(--nwd-border)' }}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Created</p>
                <p className="text-sm text-gray-900">
                  {new Date(project.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>

              <div className="bg-white rounded-lg border p-5" style={{ borderColor: 'var(--nwd-border)' }}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Assigned Contractors
                </p>
                {project.contractor_projects.length === 0 ? (
                  <p className="text-sm text-gray-400">No contractors assigned yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {project.contractor_projects.map((cp) => (
                      <li key={cp.contractor_id} className="text-sm text-gray-900">
                        <span className="font-medium">{cp.profiles?.name ?? 'Unknown'}</span>
                        {cp.profiles?.email && (
                          <span className="text-gray-400 ml-2">{cp.profiles.email}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
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

export default function ProjectWorkspacePage() {
  return (
    <RouteGuard allowedRoles={['admin', 'client', 'contractor']}>
      <ProjectWorkspaceContent />
    </RouteGuard>
  )
}
