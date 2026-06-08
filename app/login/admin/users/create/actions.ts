'use server'

import { randomInt } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendWelcomeEmail } from '@/lib/email/sendWelcomeEmail'
import type { UserRole } from '@/types/auth'

function generateTemporaryPassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const symbols = '!@#$%^&*'
  const all = uppercase + lowercase + numbers + symbols

  const required = [
    uppercase[randomInt(uppercase.length)],
    lowercase[randomInt(lowercase.length)],
    numbers[randomInt(numbers.length)],
    symbols[randomInt(symbols.length)],
  ]

  const remaining = Array.from({ length: 11 }, () => all[randomInt(all.length)])
  const chars = [...required, ...remaining]

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }

  return chars.join('')
}

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
    // Roll back the auth user so we don't leave an orphaned auth record
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
