'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'

export async function approveProposal(proposalId: string) {
    // Fetch the proposal to get client_id, title, description, budget
    const { data: proposal, error: fetchError } = await supabaseAdmin
        .from('proposals')
        .select('id, client_id, title, description, budget')
        .eq('id', proposalId)
        .single()

    if (fetchError || !proposal) {
        return { error: fetchError?.message ?? 'Proposal not found.' }
    }

    // Update proposal status to approved
    const { error: updateError } = await supabaseAdmin
        .from('proposals')
        .update({ status: 'approved' })
        .eq('id', proposalId)

    if (updateError) {
        return { error: updateError.message }
    }

    // Insert project row
    const { data: project, error: insertError } = await supabaseAdmin
        .from('projects')
        .insert({
            proposal_id: proposal.id,
            client_id: proposal.client_id,
            title: proposal.title,
            description: proposal.description,
            budget: proposal.budget,
            status: 'active',
        })
        .select('id')
        .single()

    if (insertError) {
        return { error: insertError.message }
    }

    return { projectId: project.id }
}

export async function rejectProposal(proposalId: string) {
    const { error } = await supabaseAdmin
        .from('proposals')
        .update({ status: 'rejected' })
        .eq('id', proposalId)

    if (error) {
        return { error: error.message }
    }

    return { success: true }
}