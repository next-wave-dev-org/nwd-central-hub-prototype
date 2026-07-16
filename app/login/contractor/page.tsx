'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import RouteGuard from '@/components/RouteGuard'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'

type Project = {
  id: string
  title: string
  description: string
}

type RequestStatus = 'pending' | 'approved' | 'rejected'
type RequestMap = Record<string, RequestStatus>

function ContractorContent() {
  const { profile } = useAuth()
  const router = useRouter()
  const [activeProjects, setActiveProjects] = useState<Project[]>([])
  const [availableProjects, setAvailableProjects] = useState<Project[]>([])
  const [requestMap, setRequestMap] = useState<RequestMap>({})
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    fetchData()
  }, [profile])

  async function fetchData() {
    setLoading(true)
    setError(null)

    const [
      { data: cpRows, error: cpError },
      { data: allProjects, error: projectsError },
      { data: requests, error: requestsError },
    ] = await Promise.all([
      supabase
        .from('contractor_projects')
        .select('project_id')
        .eq('contractor_id', profile!.id),
      supabase
        .from('projects')
        .select('id, title, description'),
      supabase
        .from('proposal_requests')
        .select('project_id, status')
        .eq('contractor_id', profile!.id),
    ])

    const queryError = cpError || projectsError || requestsError
    if (queryError) {
      setError(queryError.message)
      setLoading(false)
      return
    }

    const joinedIds = new Set((cpRows || []).map((r: any) => r.project_id))
    const all = (allProjects || []) as Project[]

    const map: RequestMap = {}
    for (const req of requests || []) {
      map[req.project_id] = req.status
    }

    setActiveProjects(all.filter((p) => joinedIds.has(p.id)))
    setAvailableProjects(all.filter((p) => !joinedIds.has(p.id)))
    setRequestMap(map)
    setLoading(false)
  }

  async function requestAccess(projectId: string) {
    setRequesting(projectId)
    setError(null)
    const { error } = await supabase
      .from('proposal_requests')
      .insert({ contractor_id: profile!.id, project_id: projectId, status: 'pending' })

    if (error) {
      setError(error.message)
    } else {
      setRequestMap((prev) => ({ ...prev, [projectId]: 'pending' }))
    }
    setRequesting(null)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'white' }}>

      <header className="bg-white border-b" style={{ borderColor: 'var(--nwd-border)' }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
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

          <div className="flex items-center gap-3">
            <a
              href="https://clockify.me"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              Log Hours
            </a>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-14 w-full flex flex-col gap-16">

        {error && (
          <div className="rounded-lg p-4 border text-sm flex items-start justify-between gap-2" style={{ background: 'color-mix(in srgb, #f43f5e 8%, white)', borderColor: '#fda4af', color: '#9f1239' }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 text-lg leading-none flex-shrink-0" aria-label="Dismiss">×</button>
          </div>
        )}

        {/* ── Active Projects ── */}
        <section>
          <div className="flex items-end justify-between mb-2">
            <div>
              <p
                className="text-xs font-semibold tracking-widest mb-2"
                style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}
              >
                CONTRACTOR
              </p>
              <h1 className="text-3xl font-bold text-gray-900 leading-tight">Active Projects</h1>
            </div>
            {!loading && (
              <span className="mb-1 text-xs font-semibold px-4 py-1.5 rounded-full bg-gray-100 text-gray-600">
                {activeProjects.length} project{activeProjects.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="h-0.5 bg-gradient-to-r from-gray-200 to-transparent rounded-full mt-4 mb-10" />

          {loading ? (
            <LoadingSpinner />
          ) : activeProjects.length === 0 ? (
            <EmptyState message="You have no active projects assigned right now. Check back later." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeProjects.map((project) => (
                <div
                  key={project.id}
                  className="border rounded-2xl overflow-hidden flex flex-col"
                  style={{ borderColor: 'var(--nwd-border)' }}
                >
                  <div className="h-1.5 bg-gradient-to-r from-gray-700 to-gray-400" />
                  <div className="p-6 flex flex-col gap-3 flex-1">
                    <span className="self-start text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-0.5">
                      ● Active
                    </span>
                    <h2 className="text-lg font-bold text-gray-900 leading-snug tracking-tight">
                      {project.title}
                    </h2>
                    <p className="text-sm text-gray-500 leading-relaxed flex-1">
                      {project.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Available Projects ── */}
        <section>
          <div className="flex items-end justify-between mb-2">
            <h2 className="text-2xl font-bold text-gray-700 leading-tight">Available Projects</h2>
            {!loading && (
              <span className="mb-1 text-xs font-semibold px-4 py-1.5 rounded-full bg-gray-100 text-gray-400">
                {availableProjects.length} available
              </span>
            )}
          </div>

          <div className="h-0.5 bg-gradient-to-r from-gray-200 to-transparent rounded-full mt-4 mb-10" />

          {loading ? (
            <LoadingSpinner />
          ) : availableProjects.length === 0 ? (
            <EmptyState message="No projects available to join right now." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableProjects.map((project) => {
                const status = requestMap[project.id]
                return (
                  <div
                    key={project.id}
                    className="border rounded-2xl overflow-hidden flex flex-col"
                    style={{ borderColor: 'var(--nwd-border)' }}
                  >
                    <div className="h-1.5 bg-gradient-to-r from-gray-300 to-gray-100" />
                    <div className="p-6 flex flex-col gap-3 flex-1">
                      <h3 className="text-lg font-bold text-gray-900 leading-snug tracking-tight">
                        {project.title}
                      </h3>
                      <p className="text-sm text-gray-500 leading-relaxed flex-1">
                        {project.description}
                      </p>

                      {status === 'pending' ? (
                        <span className="self-start text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                          ● Request Pending
                        </span>
                      ) : status === 'approved' ? (
                        <span className="self-start text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                          ✓ Approved
                        </span>
                      ) : status === 'rejected' ? (
                        <span className="self-start text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-3 py-1">
                          ✕ Rejected
                        </span>
                      ) : (
                        <button
                          onClick={() => requestAccess(project.id)}
                          disabled={requesting === project.id}
                          className="self-start text-xs font-semibold px-4 py-1.5 rounded-full border transition-colors disabled:opacity-50"
                          style={{
                            borderColor: 'var(--nwd-purple)',
                            color: 'var(--nwd-purple)',
                          }}
                        >
                          {requesting === project.id ? 'Requesting…' : 'Request Access'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

      </main>

      <footer className="text-center py-6 px-4 mt-auto">
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

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-8 h-8 rounded-full border-[3px] border-gray-200 border-t-gray-600 animate-spin" />
      <p className="text-sm text-gray-400">Fetching…</p>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <p className="text-sm text-gray-400 max-w-xs leading-relaxed">{message}</p>
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
