'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import RouteGuard from '@/components/RouteGuard'
  
function AdminContent() {
  const [proposals, setProposals] = useState<any[]>([])

  useEffect(() => {
    fetchProposals()
  }, [])

  async function fetchProposals() {
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('status', 'pending')

    if (!error) setProposals(data || [])
  }

  async function approveProposal(proposal: any) {
    await supabase
      .from('proposals')
      .update({ status: 'approved' })
      .eq('id', proposal.id)

    await supabase
      .from('projects')
      .insert({
        proposal_id: proposal.id,
        title: proposal.title,
        description: proposal.description,
        client_id: proposal.client_id,
      })

    fetchProposals()
  }

  return (
    <div>
      <BackButton />

      <h1>Admin Dashboard</h1>

      {proposals.map((proposal) => (
        <div
          key={proposal.id}
          style={{ border: '1px solid gray', margin: '10px', padding: '10px' }}
        >
          <h3>{proposal.title}</h3>

          <p>{proposal.description}</p>

          <button onClick={() => approveProposal(proposal)}>
            Approve
          </button>
        </div>
      ))}
    </div>
  )
}

export default function AdminPage() {
  return (
    <RouteGuard allowedRoles={['admin']}>
      <AdminContent />
    </RouteGuard>
  )
}
