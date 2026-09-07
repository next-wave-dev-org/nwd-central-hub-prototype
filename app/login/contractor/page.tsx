'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import RouteGuard from '@/components/RouteGuard'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'

type Project = {
  id: string
  title: string
  description: string
  budget: string | null
  created_at: string | null
}

type RequestStatus = 'pending' | 'approved' | 'rejected'
type RequestMap = Record<string, RequestStatus>

type SortCol = 'title' | 'budget' | 'status' | 'created'
type SortDir = 'asc' | 'desc'

function budgetValue(budget: string | null): number {
  if (!budget) return -1
  const n = parseFloat(budget.replace(/[^0-9.-]/g, ''))
  return Number.isNaN(n) ? -1 : n
}

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol | null; sortDir: SortDir }) {
  const active = sortCol === col
  const color = active ? 'var(--nwd-teal)' : '#d1d5db'
  return (
    <svg className="inline-block ml-1 w-3 h-3 flex-shrink-0" viewBox="0 0 10 12" fill="none" aria-hidden>
      <path d="M5 1L2 4.5h6L5 1z" fill={active && sortDir === 'asc' ? color : '#d1d5db'} />
      <path d="M5 11L8 7.5H2L5 11z" fill={active && sortDir === 'desc' ? color : '#d1d5db'} />
    </svg>
  )
}

const ACTIVE_COLUMNS: { label: string; key: SortCol | null }[] = [
  { label: 'Title',   key: 'title' },
  { label: 'Budget',  key: 'budget' },
  { label: 'Status',  key: null },
  { label: 'Created', key: 'created' },
  { label: 'Actions', key: null },
]

const AVAILABLE_COLUMNS: { label: string; key: SortCol | null }[] = [
  { label: 'Title',   key: 'title' },
  { label: 'Budget',  key: 'budget' },
  { label: 'Status',  key: 'status' },
  { label: 'Created', key: 'created' },
  { label: 'Actions', key: null },
]

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

function ActiveStatusBadge() {
  return (
    <span
      className="text-xs font-semibold tracking-wider px-2 py-0.5 rounded"
      style={{
        color: '#059669',
        background: 'color-mix(in srgb, #059669 12%, transparent)',
        fontFamily: 'var(--font-geist-mono)',
      }}
    >
      Active
    </span>
  )
}

function ContractorContent() {
  const { profile } = useAuth()
  const [activeProjects, setActiveProjects] = useState<Project[]>([])
  const [availableProjects, setAvailableProjects] = useState<Project[]>([])
  const [requestMap, setRequestMap] = useState<RequestMap>({})
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeSortCol, setActiveSortCol] = useState<SortCol | null>(null)
  const [activeSortDir, setActiveSortDir] = useState<SortDir>('asc')
  const [availableSortCol, setAvailableSortCol] = useState<SortCol | null>(null)
  const [availableSortDir, setAvailableSortDir] = useState<SortDir>('asc')

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
        .select('id, title, description, budget, created_at'),
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

  function toggleActiveSort(col: SortCol) {
    if (activeSortCol === col) {
      setActiveSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setActiveSortCol(col)
      setActiveSortDir('asc')
    }
  }

  function toggleAvailableSort(col: SortCol) {
    if (availableSortCol === col) {
      setAvailableSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setAvailableSortCol(col)
      setAvailableSortDir('asc')
    }
  }

  const sortedActiveProjects = useMemo(() => {
    if (!activeSortCol) return activeProjects
    const result = [...activeProjects]
    result.sort((a, b) => {
      if (activeSortCol === 'budget') {
        const diff = budgetValue(a.budget) - budgetValue(b.budget)
        return activeSortDir === 'asc' ? diff : -diff
      }
      let av = '', bv = ''
      if (activeSortCol === 'title')   { av = a.title.toLowerCase(); bv = b.title.toLowerCase() }
      if (activeSortCol === 'created') { av = a.created_at ?? '';    bv = b.created_at ?? '' }
      return activeSortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
    return result
  }, [activeProjects, activeSortCol, activeSortDir])

  const sortedAvailableProjects = useMemo(() => {
    if (!availableSortCol) return availableProjects
    const result = [...availableProjects]
    result.sort((a, b) => {
      if (availableSortCol === 'budget') {
        const diff = budgetValue(a.budget) - budgetValue(b.budget)
        return availableSortDir === 'asc' ? diff : -diff
      }
      let av = '', bv = ''
      if (availableSortCol === 'title')   { av = a.title.toLowerCase();                        bv = b.title.toLowerCase() }
      if (availableSortCol === 'status')  { av = requestMap[a.id] ?? 'available';               bv = requestMap[b.id] ?? 'available' }
      if (availableSortCol === 'created') { av = a.created_at ?? '';                            bv = b.created_at ?? '' }
      return availableSortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
    return result
  }, [availableProjects, availableSortCol, availableSortDir, requestMap])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'white' }}>

      <Navbar title="Contractor Dashboard" />

      <main className="max-w-5xl mx-auto px-6 py-14 w-full flex flex-col gap-16">

        {error && (
          <div className="rounded-lg p-4 border text-sm flex items-start justify-between gap-2" style={{ background: 'color-mix(in srgb, #f43f5e 8%, white)', borderColor: '#fda4af', color: '#9f1239' }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 text-lg leading-none flex-shrink-0 cursor-pointer" aria-label="Dismiss">×</button>
          </div>
        )}

        {/* ── Active Projects ── */}
        <section>
          <div className="flex justify-end mb-4">
            <a
              href="https://clockify.me"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              Log Hours
            </a>
          </div>

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
            <div className="border rounded-lg overflow-x-auto" style={{ borderColor: 'var(--nwd-border)' }}>
              <table className="min-w-full divide-y" style={{ borderColor: 'var(--nwd-border)' }}>
                <thead>
                  <tr style={{ background: 'var(--nwd-surface)' }}>
                    {ACTIVE_COLUMNS.map(({ label, key }) => (
                      <th
                        key={label}
                        className={[
                          'px-4 py-3 text-xs font-semibold tracking-wider text-gray-500 whitespace-nowrap',
                          label === 'Actions' ? 'text-right' : 'text-left',
                          key ? 'cursor-pointer select-none hover:text-gray-700' : '',
                        ].join(' ')}
                        style={{ fontFamily: 'var(--font-geist-mono)' }}
                        onClick={() => key && toggleActiveSort(key)}
                      >
                        {label}
                        {key && <SortIcon col={key} sortCol={activeSortCol} sortDir={activeSortDir} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y" style={{ borderColor: 'var(--nwd-border)' }}>
                  {sortedActiveProjects.map((project) => {
                    const isExpanded = expandedId === project.id

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
                              <Link
                                href={`/login/projects/${project.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="hover:underline"
                              >
                                {project.title}
                              </Link>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                            {project.budget ? `$${project.budget}` : '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <ActiveStatusBadge />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                            {project.created_at
                              ? new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex justify-end">
                              <span className="text-xs text-gray-300">—</span>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr style={{ background: 'color-mix(in srgb, var(--nwd-teal) 5%, white)', borderTop: 'none' }}>
                            <td
                              colSpan={5}
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
                    {AVAILABLE_COLUMNS.map(({ label, key }) => (
                      <th
                        key={label}
                        className={[
                          'px-4 py-3 text-xs font-semibold tracking-wider text-gray-500 whitespace-nowrap',
                          label === 'Actions' ? 'text-right' : 'text-left',
                          key ? 'cursor-pointer select-none hover:text-gray-700' : '',
                        ].join(' ')}
                        style={{ fontFamily: 'var(--font-geist-mono)' }}
                        onClick={() => key && toggleAvailableSort(key)}
                      >
                        {label}
                        {key && <SortIcon col={key} sortCol={availableSortCol} sortDir={availableSortDir} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y" style={{ borderColor: 'var(--nwd-border)' }}>
                  {sortedAvailableProjects.map((project) => {
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
                              <Link
                                href={`/login/projects/${project.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="hover:underline"
                              >
                                {project.title}
                              </Link>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                            {project.budget ? `$${project.budget}` : '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <RequestStatusBadge status={status ?? 'available'} />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                            {project.created_at
                              ? new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : '—'}
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
                              colSpan={5}
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
