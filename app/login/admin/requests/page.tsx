'use client'

import { useEffect, useState } from 'react'
import RouteGuard from '@/components/RouteGuard'
import BackButton from '@/components/BackButton'
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

function AdminRequestsContent() {
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

    await fetchRequests()
    setActing(null)
  }

  return (
    <div className="min-h-screen" style={{ background: 'white' }}>

      <header className="bg-white border-b" style={{ borderColor: 'var(--nwd-border)' }}>
        <div className="max-w-3xl mx-auto px-6 py-4">
          <BackButton />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">

        <div className="mb-10">
          <p
            className="text-xs font-semibold tracking-widest mb-2"
            style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}
          >
            ADMIN
          </p>
          <h1 className="text-3xl font-bold text-gray-900 leading-tight">Pending Requests</h1>
          <p className="text-sm text-gray-400 mt-1">
            Contractors requesting access to projects
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg p-4 border text-sm flex items-start justify-between gap-2" style={{ background: 'color-mix(in srgb, #f43f5e 8%, white)', borderColor: '#fda4af', color: '#9f1239' }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 text-lg leading-none flex-shrink-0" aria-label="Dismiss">×</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-[3px] border-gray-200 border-t-gray-600 animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm">No pending requests at this time.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {requests.map((req) => (
              <div
                key={req.id}
                className="border rounded-lg p-5 flex flex-col gap-4"
                style={{ borderColor: 'var(--nwd-border)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">
                      {req.project?.title ?? 'Unknown Project'}
                    </p>
                    {req.project?.description && (
                      <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">
                        {req.project.description}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-semibold tracking-wider px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">
                    PENDING
                  </span>
                </div>

                <div className="text-sm text-gray-500 flex flex-col gap-0.5">
                  <span>
                    <span className="font-medium text-gray-700">
                      {req.contractor?.name ?? req.contractor?.email ?? req.contractor_id}
                    </span>
                    {req.contractor?.name && (
                      <span className="ml-1.5 text-gray-400">{req.contractor.email}</span>
                    )}
                  </span>
                  <span className="text-xs text-gray-300">
                    {new Date(req.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => approveRequest(req)}
                    disabled={acting === req.id}
                    className="px-4 py-1.5 rounded-full text-sm font-semibold bg-gray-900 text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    {acting === req.id ? 'Approving…' : 'Approve'}
                  </button>
                  <button
                    onClick={() => rejectRequest(req.id)}
                    disabled={acting === req.id}
                    className="px-4 py-1.5 rounded-full text-sm font-semibold border text-gray-600 hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-50"
                    style={{ borderColor: 'var(--nwd-border)' }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
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
