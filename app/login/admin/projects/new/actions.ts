'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'

export type CreateProjectDirectInput = {
    title: string
    description?: string
    budget?: string
    clientId?: string | null
    contractorIds?: string[]
}

export type CreateProjectDirectResult =
    | { projectId: string }
    | { error: string }

export async function createProjectDirect(
    input: CreateProjectDirectInput
): Promise<CreateProjectDirectResult> {
    const { data: project, error: insertError } = await supabaseAdmin
        .from('projects')
        .insert({
            title: input.title,
            description: input.description || null,
            budget: input.budget || null,
            client_id: input.clientId || null,
            status: 'active',
            origin: 'admin',
        })
        .select('id')
        .single()

    if (insertError || !project) {
        return { error: insertError?.message ?? 'Failed to create project.' }
    }

    const contractorIds = input.contractorIds ?? []
    if (contractorIds.length > 0) {
        const { error: contractorError } = await supabaseAdmin
            .from('contractor_projects')
            .insert(contractorIds.map((contractorId) => ({
                contractor_id: contractorId,
                project_id: project.id,
            })))

        if (contractorError) {
            return { error: contractorError.message }
        }
    }

    return { projectId: project.id }
}
