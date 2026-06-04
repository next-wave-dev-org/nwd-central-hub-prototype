'use client'

import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
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
  const [activeProjects, setActiveProjects] = useState<Project[]>([])
  const [availableProjects, setAvailableProjects] = useState<Project[]>([])
  const [requestMap, setRequestMap] = useState<RequestMap>({})
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    fetchData()
  }, [profile])

  async function fetchData() {
    setLoading(true)

    const [{ data: cpRows }, { data: allProjects }, { data: requests }] = await Promise.all([
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
    const { error } = await supabase
      .from('proposal_requests')
      .insert({ contractor_id: profile!.id, project_id: projectId, status: 'pending' })

    if (!error) {
      setRequestMap((prev) => ({ ...prev, [projectId]: 'pending' }))
    }
    setRequesting(null)
  }

  return (
    <div className="min-h-screen bg-stone-800">
      <Navbar />

      <main className="max-w-5xl mx-auto px-6 py-14 flex flex-col gap-16">

        {/* ── Active Projects ── */}
        <section>
          <div className="flex items-end justify-between mb-2">
            <h1 className="text-4xl font-black text-stone-50 tracking-tight leading-none">
              Active Projects
            </h1>
            {!loading && (
              <span className="mb-1 bg-stone-900 text-white text-xs font-semibold px-4 py-1.5 rounded-full">
                {activeProjects.length} project{activeProjects.length !== 1 ? 's' : ''}
              </span>
            )}
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

          {loading ? (
            <LoadingSpinner />
          ) : activeProjects.length === 0 ? (
            <EmptyState message="You have no active projects assigned right now. Check back later." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeProjects.map((project) => (
                <div
                  key={project.id}
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
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Available Projects ── */}
        <section>
          <div className="flex items-end justify-between mb-2">
            <h2 className="text-3xl font-black text-stone-300 tracking-tight leading-none">
              Available Projects
            </h2>
            {!loading && (
              <span className="mb-1 bg-stone-700 text-stone-300 text-xs font-semibold px-4 py-1.5 rounded-full">
                {availableProjects.length} available
              </span>
            )}
          </div>

          <div className="h-0.5 bg-gradient-to-r from-stone-500 to-transparent rounded-full mt-4 mb-10" />

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
                    className="bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col"
                  >
                    <div className="h-1.5 bg-gradient-to-r from-stone-400 to-stone-200" />
                    <div className="p-6 flex flex-col gap-3 flex-1">
                      <h3 className="text-lg font-bold text-stone-900 leading-snug tracking-tight">
                        {project.title}
                      </h3>
                      <p className="text-sm text-stone-500 leading-relaxed flex-1">
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
                          className="self-start text-xs font-semibold bg-stone-900 text-white px-4 py-1.5 rounded-full hover:bg-stone-700 transition-colors disabled:opacity-50"
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
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-9 h-9 rounded-full border-[3px] border-stone-200 border-t-stone-900 animate-spin" />
      <p className="text-sm text-stone-400">Fetching…</p>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <p className="text-sm text-stone-400 max-w-xs leading-relaxed">{message}</p>
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
