'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'

type Project = {
  id: string
  title: string
  description: string
}

export default function ContractorPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'Contractor') {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
      .from('projects_table')
      .select('id, title, description')
      .eq('status', 'Active')
      .eq('contractor_id', user.id)

      if (error) {
        console.error(error)
      } else {
        setProjects(data || [])
      }

      setLoading(false)
    }

    checkUser()
  }, [router])

  return (
    <div className="min-h-screen bg-stone-800">
      <Navbar />

      <main className="max-w-5xl mx-auto px-6 py-14">

        {/* Header */}
        <div className="flex items-end justify-between mb-2">
          <h1 className="text-4xl font-black text-stone-50 tracking-tight leading-none">
            Active Projects
          </h1>

          {!loading && (
            <span className="mb-1 bg-stone-900 text-white text-xs font-semibold px-4 py-1.5 rounded-full">
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="h-0.5 bg-gradient-to-r from-stone-50 to-transparent rounded-full mt-4 mb-10" />

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-9 h-9 rounded-full border-[3px] border-stone-200 border-t-stone-900 animate-spin" />
            <p className="text-sm text-stone-400">Fetching your projects…</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <span className="text-5xl">📋</span>
            <p className="text-lg font-bold text-stone-800 mt-2">No active projects</p>
            <p className="text-sm text-stone-400 max-w-xs leading-relaxed">
              You have no active projects assigned right now. Check back later.
            </p>
          </div>
        )}

        {/* Project cards */}
        {!loading && projects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-200 hover:-translate-y-1 flex flex-col"
              >
                {/* Top accent bar */}
                <div className="h-1.5 bg-gradient-to-r from-stone-800 to-stone-500" />

                <div className="p-6 flex flex-col gap-3 flex-1">
                  {/* Status pill */}
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
      </main>
    </div>
  )
}