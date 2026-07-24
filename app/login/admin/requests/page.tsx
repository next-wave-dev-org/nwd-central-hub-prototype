'use client'

import React, { useEffect, useState } from 'react'
import RouteGuard from '@/components/RouteGuard'
import Navbar from '@/components/Navbar'
import { supabase } from '@/lib/supabase'

type RequestRow = {
  id: string
  status: string
  created_at: string
  contractor_id: string
  project_id: string
  contractor: { id: string; email: string; name: string } | null
  project: { id: string; title: string; description: string } | null
}

function PendingStatusBadge() {
  return (
    <span
      className="text-xs font-semibold tracking-wider px-2 py-0.5 rounded"
      style={{
        color: '#92400e',
        background: 'color-mix(in srgb, #f59e0b 15%, transparent)',
        fontFamily: 'var(--font-geist-mono)',
      }}
    >
      Pending
    </span>
  )
}

function AdminRequestsContent() {
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchRequests()
  }, [])

  async function fetchRequests() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('proposal_requests')
      .select(`
        id,
        status,
        created_at,
        contractor_id,
        project_id,
        contractor:profiles!contractor_id(id, email, name),
        project:projects!project_id(id, title, description)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setRequests((data as unknown as RequestRow[]) || [])
    setLoading(false)
  }

  async function approveRequest(req: RequestRow) {
    setActing(req.id)
    setError(null)

    const { error: updateError } = await supabase
      .from('proposal_requests')
      .update({ status: 'approved' })
      .eq('id', req.id)

    if (updateError) {
      setError(updateError.message)
      setActing(null)
      return
    }

    const { error: insertError } = await supabase
      .from('contractor_projects')
      .insert({ contractor_id: req.contractor_id, project_id: req.project_id })

    if (insertError) {
      setError(insertError.message)
      setActing(null)
      return
    }

    setExpandedId(null)
    await fetchRequests()
    setActing(null)
  }

  async function rejectRequest(requestId: string) {
    setActing(requestId)
    setError(null)

    const { error } = await supabase
      .from('proposal_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId)

    if (error) {
      setError(error.message)
      setActing(null)
      return
    }

    setExpandedId(null)
    await fetchRequests()
    setActing(null)
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'white' }}>

      <Navbar title="Pending Requests" />

      <main className="flex-1 px-6 py-10">
        <div className="max-w-5xl mx-auto flex flex-col gap-10">

          <section>
            <div className="flex items-end justify-between mb-6">
              <div>
                <p className="text-xs font-semibold tracking-widest mb-1" style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}>ADMIN</p>
                <h2 className="text-2xl font-bold text-gray-900">Pending Requests</h2>
              </div>
              {!loading && (
                <span
                  className="text-xs font-semibold tracking-wider px-3 py-1.5 rounded-lg"
                  style={{
                    color: requests.length > 0 ? '#d97706' : '#6b7280',
                    background: requests.length > 0
                      ? 'color-mix(in srgb, #d97706 12%, transparent)'
                      : 'color-mix(in srgb, #6b7280 10%, transparent)',
                    fontFamily: 'var(--font-geist-mono)',
                  }}
                >
                  {requests.length} pending
                </span>
              )}
            </div>

            {error && (
              <div className="mb-6 rounded-lg p-4 border text-sm flex items-start justify-between gap-2" style={{ background: 'color-mix(in srgb, #f43f5e 8%, white)', borderColor: '#fda4af', color: '#9f1239' }}>
                <span>{error}</span>
                <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 text-lg leading-none flex-shrink-0" aria-label="Dismiss">×</button>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading requests…</div>
            ) : requests.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">No pending requests at this time.</div>
            ) : (
              <div className="border rounded-lg overflow-x-auto" style={{ borderColor: 'var(--nwd-border)' }}>
                <table className="min-w-full divide-y" style={{ borderColor: 'var(--nwd-border)' }}>
                  <thead>
                    <tr style={{ background: 'var(--nwd-surface)' }}>
                      {['Project', 'Contractor', 'Status', 'Actions'].map((label) => (
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
                    {requests.map((req) => {
                      const isActing = acting === req.id
                      const anyActing = acting !== null
                      const isExpanded = expandedId === req.id

                      return (
                        <React.Fragment key={req.id}>
                          <tr
                            onClick={() => toggleExpand(req.id)}
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
                                {req.project?.title ?? 'Unknown Project'}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                              <div>{req.contractor?.name ?? req.contractor?.email ?? req.contractor_id}</div>
                              {req.contractor?.name && (
                                <div className="text-xs text-gray-400" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                                  {req.contractor.email}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <PendingStatusBadge />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  disabled={anyActing}
                                  onClick={() => approveRequest(req)}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:brightness-90 active:brightness-75 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
                                  style={{
                                    borderColor: 'var(--nwd-teal)',
                                    color: isActing ? '#6b7280' : 'var(--nwd-teal)',
                                    background: isActing
                                      ? 'color-mix(in srgb, #6b7280 8%, white)'
                                      : 'color-mix(in srgb, var(--nwd-teal) 8%, white)',
                                  }}
                                >
                                  {isActing ? 'Processing…' : 'Approve'}
                                </button>
                                <button
                                  type="button"
                                  disabled={anyActing}
                                  onClick={() => rejectRequest(req.id)}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:brightness-90 active:brightness-75 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
                                  style={{
                                    borderColor: '#f43f5e',
                                    color: isActing ? '#6b7280' : '#f43f5e',
                                    background: isActing
                                      ? 'color-mix(in srgb, #6b7280 8%, white)'
                                      : 'color-mix(in srgb, #f43f5e 8%, white)',
                                  }}
                                >
                                  {isActing ? 'Processing…' : 'Reject'}
                                </button>
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
                                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap mb-3">
                                  {req.project?.description?.trim() || (
                                    <span className="text-gray-400 italic">No description provided.</span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-400" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                                  Requested {new Date(req.created_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
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

export default function AdminRequestsPage() {
  return (
    <RouteGuard allowedRoles={['admin']}>
      <AdminRequestsContent />
    </RouteGuard>
  )
}
