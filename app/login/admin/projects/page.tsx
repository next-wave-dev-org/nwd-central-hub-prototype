'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import RouteGuard from '@/components/RouteGuard'
import Navbar from '@/components/Navbar'
import { supabase } from '@/lib/supabase'

type Project = {
  id: string
  title: string
  description: string
  origin: 'client' | 'admin'
}

function OriginBadge({ origin }: { origin: 'client' | 'admin' }) {
  const isAdmin = origin === 'admin'
  return (
    <span
      className="text-xs font-semibold tracking-wider px-2 py-0.5 rounded"
      style={{
        color: isAdmin ? 'var(--nwd-teal)' : 'var(--nwd-purple)',
        background: isAdmin
          ? 'color-mix(in srgb, var(--nwd-teal) 12%, transparent)'
          : 'color-mix(in srgb, var(--nwd-purple) 12%, transparent)',
        fontFamily: 'var(--font-geist-mono)',
      }}
    >
      {isAdmin ? 'ADMIN-CREATED' : 'CLIENT PROPOSAL'}
    </span>
  )
}

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProjects = async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, description, origin')
        .eq('status', 'active')

      if (!error) {
        setProjects(data || [])
      }

      setLoading(false)
    }

    fetchProjects()
  }, [])

  return (
    <RouteGuard allowedRoles={['admin']}>
      <Navbar />

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">
          Admin Active Projects
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
              <Link
                key={project.id}
                href={`/login/projects/${project.id}`}
                className="block p-6 border rounded-lg shadow hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-lg font-bold">
                    {project.title}
                  </h2>
                  <OriginBadge origin={project.origin} />
                </div>

                <p className="text-gray-600">
                  {project.description}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </RouteGuard>
  )
}