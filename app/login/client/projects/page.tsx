'use client'

import { useEffect, useState } from 'react'
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
  contractors: Contractor[]
}

type ContractorProjectRow = {
  project_id: string
  contractor: Contractor | Contractor[] | null
}

export default function ClientProjectsPage() {
  const { profile } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return

    const fetchProjects = async () => {
      setError(null)

      const { data: projectRows, error: projectsError } = await supabase
        .from('projects')
        .select('id, title, description')
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

  return (
    <RouteGuard allowedRoles={['client']}>
      <Navbar />

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">
          Client Active Projects
        </h1>

        {error && (
          <div className="mb-6 rounded-lg p-4 border text-sm flex items-start justify-between gap-2" style={{ background: 'color-mix(in srgb, #f43f5e 8%, white)', borderColor: '#fda4af', color: '#9f1239' }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 text-lg leading-none flex-shrink-0" aria-label="Dismiss">×</button>
          </div>
        )}

        {loading && (
          <p className="text-gray-500">Loading projects...</p>
        )}

        {!loading && projects.length === 0 && (
          <div className="p-6 border rounded-lg">
            <p>No active projects found.</p>
          </div>
        )}

        {!loading && projects.length > 0 && (
          <div className="grid gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="p-6 border rounded-lg shadow hover:shadow-md transition"
              >
                <h2 className="text-lg font-bold mb-2">
                  {project.title}
                </h2>

                <p className="text-gray-600">
                  {project.description}
                </p>

                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs font-semibold text-gray-400 tracking-wide mb-2">TEAM</p>
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
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </RouteGuard>
  )
}
