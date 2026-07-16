'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import RouteGuard from '@/components/RouteGuard'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'

type Project = {
  id: string
  title: string
  description: string
  budget: string | null
}

type RequestStatus = 'pending' | 'approved' | 'rejected'
type RequestMap = Record<string, RequestStatus>

const REQUEST_STATUS_STYLES: Record<'available' | RequestStatus, { color: string; label: string }> = {
  available: { color: '#6b7280', label: 'Available' },
  pending:   { color: '#d97706', label: 'Pending' },
  approved:  { color: 'var(--nwd-teal)', label: 'Approved' },
  rejected:  { color: '#f43f5e', label: 'Rejected' },
}

function RequestStatusBadge({ status }: { status: 'available' | RequestStatus }) {
  const style = REQUEST_STATUS_STYLES[status]
  return (
    <span
      className="text-xs font-semibold tracking-wider px-2 py-0.5 rounded"
      style={{
        color: style.color,
        background: `color-mix(in srgb, ${style.color} 12%, transparent)`,
        fontFamily: 'var(--font-geist-mono)',
      }}
    >
      {style.label}
    </span>
  )
}

function ContractorContent() {
  const { profile } = useAuth()
  const router = useRouter()
  const [activeProjects, setActiveProjects] = useState<Project[]>([])
  const [availableProjects, setAvailableProjects] = useState<Project[]>([])
  const [requestMap, setRequestMap] = useState<RequestMap>({})
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
        .select('id, title, description, budget'),
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
              className="text-sm text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
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
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 text-lg leading-none flex-shrink-0 cursor-pointer" aria-label="Dismiss">×</button>
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
            <div className="border rounded-lg overflow-x-auto" style={{ borderColor: 'var(--nwd-border)' }}>
              <table className="min-w-full divide-y" style={{ borderColor: 'var(--nwd-border)' }}>
                <thead>
                  <tr style={{ background: 'var(--nwd-surface)' }}>
                    {['Title', 'Budget', 'Status', 'Actions'].map((label) => (
                      <th
                        key={label}
                        className={`px-4 py-3 text-xs font-semibold tracking-wider text-gray-500 whitespace-nowrap ${label === 'Actions' ? 'text-right' : 'text-left'}`}
                        style={{ fontFamily: 'var(--font-geist-mono)' }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y" style={{ borderColor: 'var(--nwd-border)' }}>
                  {availableProjects.map((project) => {
                    const status = requestMap[project.id]
                    const isExpanded = expandedId === project.id
                    const isRequesting = requesting === project.id

                    return (
                      <React.Fragment key={project.id}>
                        <tr
                          onClick={() => setExpandedId((prev) => (prev === project.id ? null : project.id))}
                          className="cursor-pointer transition-colors"
                          style={{ background: isExpanded ? 'color-mix(in srgb, var(--nwd-teal) 5%, white)' : undefined }}
                          onMouseEnter={(e) => {
                            if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'var(--nwd-surface)'
                          }}
                          onMouseLeave={(e) => {
                            ;(e.currentTarget as HTMLElement).style.background = isExpanded
                              ? 'color-mix(in srgb, var(--nwd-teal) 5%, white)'
                              : ''
                          }}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <svg
                                className="w-3 h-3 flex-shrink-0 transition-transform"
                                style={{
                                  color: isExpanded ? 'var(--nwd-teal)' : '#d1d5db',
                                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                }}
                                fill="none" viewBox="0 0 8 12" stroke="currentColor" strokeWidth="2"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2 2l4 4-4 4" />
                              </svg>
                              {project.title}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                            {project.budget ? `$${project.budget}` : '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <RequestStatusBadge status={status ?? 'available'} />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                              {status ? (
                                <span className="text-xs text-gray-300">—</span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isRequesting}
                                  onClick={() => requestAccess(project.id)}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition-all hover:brightness-90 active:brightness-75 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
                                  style={{
                                    borderColor: 'var(--nwd-purple)',
                                    color: isRequesting ? '#6b7280' : 'var(--nwd-purple)',
                                    background: isRequesting
                                      ? 'color-mix(in srgb, #6b7280 8%, white)'
                                      : 'color-mix(in srgb, var(--nwd-purple) 8%, white)',
                                  }}
                                >
                                  {isRequesting ? 'Requesting…' : 'Request Access'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr style={{ background: 'color-mix(in srgb, var(--nwd-teal) 5%, white)', borderTop: 'none' }}>
                            <td
                              colSpan={4}
                              className="px-6 py-4"
                              style={{ borderTop: '1px dashed color-mix(in srgb, var(--nwd-teal) 30%, transparent)' }}
                            >
                              <p className="text-xs font-semibold tracking-widest mb-2" style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}>
                                DESCRIPTION
                              </p>
                              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                                {project.description?.trim() || (
                                  <span className="text-gray-400 italic">No description provided.</span>
                                )}
                              </p>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
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
