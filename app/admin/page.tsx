'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminPage() {
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

  async function approveProposal(proposalId: string) {
    // 1️⃣ Update proposal status
    await supabase
      .from('proposals')
      .update({ status: 'approved' })
      .eq('id', proposalId)

    // 2️⃣ Insert into projects
    await supabase
      .from('projects')
      .insert({
        proposal_id: proposalId,
      })

    // 3️⃣ Refresh list
    fetchProposals()
  }

  return (
    <div>
      <h1>Admin Dashboard</h1>

      {proposals.map((proposal) => (
        <div
          key={proposal.id}
          style={{ border: '1px solid gray', margin: '10px', padding: '10px' }}
        >
          <h3>{proposal.title}</h3>
          <p>{proposal.description}</p>

          <button onClick={() => approveProposal(proposal.id)}>
            Approve
          </button>
        </div>
      ))}
    </div>
  )
}