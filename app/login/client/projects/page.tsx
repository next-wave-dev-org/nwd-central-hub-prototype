'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import RouteGuard from '@/components/RouteGuard'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'

type Contractor = {
  id: string
  name: string | null
  email: string
}

type Project = {
  id: string
  title: string
  description: string
  budget: string | null
  created_at: string | null
  contractors: Contractor[]
}

type ContractorProjectRow = {
  project_id: string
  contractor: Contractor | Contractor[] | null
}

type SortCol = 'title' | 'budget' | 'created'
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

function ActiveStatusBadge() {
  return (
    <span
      className="text-xs font-semibold tracking-wider px-2 py-0.5 rounded"
      style={{
        color: '#065f46',
        background: 'color-mix(in srgb, #10b981 15%, transparent)',
        fontFamily: 'var(--font-geist-mono)',
      }}
    >
      Active
    </span>
  )
}

const COLUMNS: { label: string; key: SortCol | null }[] = [
  { label: 'Title',   key: 'title' },
  { label: 'Budget',  key: 'budget' },
  { label: 'Status',  key: null },
  { label: 'Team',    key: null },
  { label: 'Created', key: 'created' },
]

function ClientProjectsContent() {
  const { profile } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState<SortCol | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  useEffect(() => {
    if (!profile) return

    const fetchProjects = async () => {
      setError(null)

      const { data: projectRows, error: projectsError } = await supabase
        .from('projects')
        .select('id, title, description, budget, created_at')
        .eq('status', 'active')
        .eq('client_id', profile.id)

      if (projectsError) {
        setError(projectsError.message)
        setLoading(false)
        return
      }

      const projectIds = (projectRows || []).map((p) => p.id)
      const contractorsByProject: Record<string, Contractor[]> = {}

      if (projectIds.length > 0) {
        const { data: cpRows, error: cpError } = await supabase
          .from('contractor_projects')
          .select('project_id, contractor:profiles!contractor_id(id, name, email)')
          .in('project_id', projectIds)

        if (cpError) {
          setError(cpError.message)
          setLoading(false)
          return
        }

        for (const row of (cpRows as ContractorProjectRow[]) || []) {
          const contractor = Array.isArray(row.contractor) ? row.contractor[0] : row.contractor
          if (!contractor) continue
          if (!contractorsByProject[row.project_id]) contractorsByProject[row.project_id] = []
          contractorsByProject[row.project_id].push(contractor)
        }
      }

      setProjects(
        (projectRows || []).map((p) => ({
          ...p,
          contractors: contractorsByProject[p.id] || [],
        }))
      )
      setLoading(false)
    }

    fetchProjects()
  }, [profile])

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  function toggleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const sortedProjects = useMemo(() => {
    if (!sortCol) return projects
    const result = [...projects]
    result.sort((a, b) => {
      if (sortCol === 'budget') {
        const diff = budgetValue(a.budget) - budgetValue(b.budget)
        return sortDir === 'asc' ? diff : -diff
      }
      let av = '', bv = ''
      if (sortCol === 'title')   { av = a.title.toLowerCase(); bv = b.title.toLowerCase() }
      if (sortCol === 'created') { av = a.created_at ?? '';    bv = b.created_at ?? '' }
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
    return result
  }, [projects, sortCol, sortDir])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'white' }}>

      <Navbar title="Active Projects" />

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

          {error && (
            <div className="mb-6 rounded-lg p-4 border text-sm flex items-start justify-between gap-2" style={{ background: 'color-mix(in srgb, #f43f5e 8%, white)', borderColor: '#fda4af', color: '#9f1239' }}>
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 text-lg leading-none flex-shrink-0 cursor-pointer" aria-label="Dismiss">×</button>
            </div>
          )}

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
            <div className="border rounded-lg overflow-x-auto" style={{ borderColor: 'var(--nwd-border)' }}>
              <table className="min-w-full divide-y" style={{ borderColor: 'var(--nwd-border)' }}>
                <thead>
                  <tr style={{ background: 'var(--nwd-surface)' }}>
                    {COLUMNS.map(({ label, key }) => (
                      <th
                        key={label}
                        className={[
                          'px-4 py-3 text-left text-xs font-semibold tracking-wider text-gray-500 whitespace-nowrap',
                          key ? 'cursor-pointer select-none hover:text-gray-700' : '',
                        ].join(' ')}
                        style={{ fontFamily: 'var(--font-geist-mono)' }}
                        onClick={() => key && toggleSort(key)}
                      >
                        {label}
                        {key && <SortIcon col={key} sortCol={sortCol} sortDir={sortDir} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y" style={{ borderColor: 'var(--nwd-border)' }}>
                  {sortedProjects.map((project) => {
                    const isExpanded = expandedId === project.id
                    const teamPreview = project.contractors.length === 0
                      ? '—'
                      : project.contractors.map((c) => c.name || c.email).join(', ')

                    return (
                      <React.Fragment key={project.id}>
                        <tr
                          onClick={() => toggleExpand(project.id)}
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
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-[16rem] truncate">
                            {teamPreview}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                            {project.created_at
                              ? new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : '—'}
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
                              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap mb-4">
                                {project.description?.trim() || (
                                  <span className="text-gray-400 italic">No description provided.</span>
                                )}
                              </p>

                              <p className="text-xs font-semibold tracking-widest mb-2" style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}>
                                TEAM
                              </p>
                              {project.contractors.length === 0 ? (
                                <p className="text-sm text-gray-400">No contractors assigned yet.</p>
                              ) : (
                                <ul className="flex flex-col gap-1">
                                  {project.contractors.map((c) => (
                                    <li key={c.id} className="text-sm text-gray-700">
                                      {c.name || c.email}
                                    </li>
                                  ))}
                                </ul>
                              )}
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
