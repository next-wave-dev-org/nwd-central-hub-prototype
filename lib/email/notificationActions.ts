'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { createActionSupabaseClient } from '@/lib/supabase-server'
import { sendNotificationEmail } from '@/lib/email/sendNotificationEmail'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL

// Takes only a direct_messages row id — recipients and content are re-derived
// server-side from that row (RLS-checked as the calling user) rather than
// trusted from the client, so a caller can't email arbitrary people/content.
export async function notifyDirectMessageByEmail(messageId: string) {
  const supabase = await createActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: message } = await supabase
    .from('direct_messages')
    .select('id, sender_id, thread_id, title, content')
    .eq('id', messageId)
    .single()

  // RLS already limits this SELECT to thread participants/admins, but only
  // the actual sender of this specific message should trigger its email.
  if (!message || message.sender_id !== user.id) return

  const threadRootId = message.thread_id ?? message.id

  const { data: participants } = await supabase
    .from('direct_message_participants')
    .select('profile_id')
    .eq('thread_root_id', threadRootId)

  const recipientIds = (participants ?? [])
    .map((p) => p.profile_id as string)
    .filter((id) => id !== user.id)

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
        subject: `New message: ${message.title}`,
        heading: message.title,
        body: message.content,
        link: `${APP_URL}/notifications`,
      })
    )
  )
}

// Takes only an announcements row id — target roles and content are
// re-derived server-side from that row rather than trusted from the client.
export async function notifyAnnouncementByEmail(announcementId: string) {
  const supabase = await createActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: announcement } = await supabase
    .from('announcements')
    .select('id, sender_id, title, body, target_roles')
    .eq('id', announcementId)
    .single()

  // RLS already restricts SELECT to admins; also confirm this caller sent it.
  if (!announcement || announcement.sender_id !== user.id) return

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, email, email_notifications, role')
    .in('role', announcement.target_roles)

  const targets = (data ?? []).filter(
    (r) => r.id !== user.id && r.email_notifications !== false && r.email
  )

  await Promise.allSettled(
    targets.map((r) =>
      sendNotificationEmail({
        to: r.email,
        subject: `New announcement: ${announcement.title}`,
        heading: announcement.title,
        body: announcement.body,
        link: `${APP_URL}/notifications`,
      })
    )
  )
}
