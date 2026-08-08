'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendNotificationEmail } from '@/lib/email/sendNotificationEmail'
import type { UserRole } from '@/types/auth'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL

export async function notifyDirectMessageByEmail(recipientIds: string[], title: string, body: string) {
  if (recipientIds.length === 0) return

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('email, email_notifications')
    .in('id', recipientIds)

  const targets = (data ?? []).filter((r) => r.email_notifications !== false && r.email)

  await Promise.allSettled(
    targets.map((r) =>
      sendNotificationEmail({
        to: r.email,
        subject: `New message: ${title}`,
        heading: title,
        body,
        link: `${APP_URL}/notifications`,
      })
    )
  )
}

export async function notifyAnnouncementByEmail(targetRoles: UserRole[], title: string, body: string) {
  if (targetRoles.length === 0) return

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('email, email_notifications, role')
    .in('role', targetRoles)

  const targets = (data ?? []).filter((r) => r.email_notifications !== false && r.email)

  await Promise.allSettled(
    targets.map((r) =>
      sendNotificationEmail({
        to: r.email,
        subject: `New announcement: ${title}`,
        heading: title,
        body,
        link: `${APP_URL}/notifications`,
      })
    )
  )
}
