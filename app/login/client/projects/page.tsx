'use client'

import { useEffect, useState } from 'react'
import RouteGuard from '@/components/RouteGuard'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'

type Project = {
  id: string
  title: string
  description: string
}

export default function ClientProjectsPage() {
  const { profile } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return

    const fetchProjects = async () => {
      const { data, error } = await supabase
        .from('projects_table')
        .select('id, title, description')
        .eq('status', 'Active')
        .eq('client_id', profile.id)

      if (!error) {
        setProjects(data || [])
      }

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
              </div>
            ))}
          </div>
        )}
      </main>
    </RouteGuard>
  )
}