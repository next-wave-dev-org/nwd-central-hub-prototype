'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Navbar from '@/components/Navbar'
import RouteGuard from '@/components/RouteGuard'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'

type Project = {
  id: string
  title: string
  description: string
  created_at: string
}

function ClientContent() {
  const { profile } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    fetchProjects()
  }, [profile])

  async function fetchProjects() {
    setLoading(true)
    const { data } = await supabase
      .from('projects')
      .select('id, title, description, created_at')
      .eq('client_id', profile!.id)
      .order('created_at', { ascending: false })

    setProjects((data as Project[]) || [])
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="max-w-5xl mx-auto px-6 py-14">
        <div className="flex items-end justify-between mb-2">
          <div>
            <p
              className="text-xs font-semibold tracking-widest mb-2"
              style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}
            >
              CLIENT
            </p>
            <h1 className="text-4xl font-bold text-gray-900 leading-tight">My Projects</h1>
          </div>
          {!loading && (
            <span className="mb-1 text-xs font-semibold px-4 py-1.5 rounded-full bg-gray-100 text-gray-600">
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="h-0.5 bg-gradient-to-r from-gray-200 to-transparent rounded-full mt-6 mb-10" />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-8 h-8 rounded-full border-[3px] border-gray-200 border-t-gray-600 animate-spin" />
            <p className="text-sm text-gray-400">Fetching your projects…</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <p className="text-lg font-bold text-gray-700">No projects yet</p>
            <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
              Your projects will appear here once a proposal has been approved.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
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
                  <p className="text-xs text-gray-300">
                    {new Date(project.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

const clientItems = [
  {
    href: '/login/client/proposals/new',
    label: 'Create Proposal',
    description: 'Submit a new project proposal',
    accent: 'var(--nwd-teal)',
    tag: 'NEW',
  },
  {
    href: '/login/client/proposals',
    label: 'My Proposals',
    description: 'View proposal submissions',
    accent: 'var(--nwd-purple)',
    tag: 'VIEW',
  },
]




export default function ClientDashboardPage() {
  return (
    <RouteGuard allowedRoles={['client']}>

      <Navbar />

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">
          Client Dashboard
        </h1>

        <div className="grid gap-4">
          <Link
            href="/login/client/proposals/new"
            className="block p-6 border rounded-lg shadow hover:shadow-md transition"
          >
            <h2 className="font-bold text-lg">Create New Proposal</h2>
            <p>Submit a new project proposal.</p>
          </Link>

          <Link
            href="/login/client/proposals"
            className="block p-6 border rounded-lg shadow hover:shadow-md transition"
          >
            <h2 className="font-bold text-lg">Proposal Submissions</h2>
            <p>View your submitted proposals.</p>
          </Link>

          <Link
            href="/login/client/projects"
            className="block p-6 border rounded-lg shadow hover:shadow-md transition"
          >
            <h2 className="font-bold text-lg">Active Projects</h2>
            <p>View active projects.</p>
          </Link>
        </div>
      </main>
    </RouteGuard>
  )
}
