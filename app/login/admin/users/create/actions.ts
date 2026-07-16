'use server'

import { generateTemporaryPassword } from '@/lib/password'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendWelcomeEmail } from '@/lib/email/sendWelcomeEmail'
import type { UserRole } from '@/types/auth'

export type CreateUserResult =
  | { success: true; temporaryPassword: string }
  | { success: false; error: string }

export async function createUser(
  email: string,
  role: UserRole,
  name: string
): Promise<CreateUserResult> {
  const temporaryPassword = generateTemporaryPassword()

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    user_metadata: { role },
    email_confirm: true,
  })

  if (authError || !authData.user) {
    return { success: false, error: authError?.message ?? 'Failed to create user' }
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: authData.user.id,
    email,
    role,
    name,
    is_temporary_password: true,
  })

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return { success: false, error: profileError.message }
  }

  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login`

  await sendWelcomeEmail({
    email,
    temporaryPassword,
    loginUrl,
  })

  return { success: true, temporaryPassword }

   

}
