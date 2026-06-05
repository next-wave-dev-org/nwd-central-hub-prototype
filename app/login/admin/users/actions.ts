'use server'

import { generateTemporaryPassword } from '@/lib/password'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendWelcomeEmail } from '@/lib/email/sendWelcomeEmail'
import type { UserProfile } from '@/types/auth'

export type GetUsersResult =
  | { success: true; users: UserProfile[] }
  | { success: false; error: string }

export async function getUsers(): Promise<GetUsersResult> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, name, role, is_temporary_password, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, users: data as UserProfile[] }
}

export type ResetPasswordResult =
  | { success: true; temporaryPassword: string }
  | { success: false; error: string }

export async function resetUserPassword(
  userId: string,
  userEmail: string
): Promise<ResetPasswordResult> {
  const temporaryPassword = generateTemporaryPassword()

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: temporaryPassword,
  })

  if (authError) {
    return { success: false, error: authError.message }
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ is_temporary_password: true })
    .eq('id', userId)

  if (profileError) {
    return { success: false, error: profileError.message }
  }

  await sendWelcomeEmail({
    email: userEmail,
    temporaryPassword,
    loginUrl: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
  })

  return { success: true, temporaryPassword }
}

export type DeleteUserResult =
  | { success: true }
  | { success: false; error: string }

export async function deleteUser(userId: string): Promise<DeleteUserResult> {
  try {
    console.log('[deleteUser] attempting auth deletion for', userId)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    console.log('[deleteUser] auth result:', authError ?? 'ok')

    if (authError && !authError.message.toLowerCase().includes('not found')) {
      return { success: false, error: `Auth error: ${authError.message}` }
    }

    console.log('[deleteUser] attempting profile deletion for', userId)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)
    console.log('[deleteUser] profile result:', profileError ?? 'ok')

    if (profileError) {
      return { success: false, error: `Profile error: ${profileError.message}` }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[deleteUser] exception:', message)
    return { success: false, error: message }
  }
}
