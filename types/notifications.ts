export type NotificationCategory = 'direct_message' | 'announcement' | 'system'

export type Notification = {
  id: string
  category: NotificationCategory
  title: string
  body: string
  link: string | null
  recipient_id: string
  sender_id: string | null
  thread_root_id: string | null
  pinned_at: string | null
  read_at: string | null
  created_at: string
  profiles: { name: string | null } | null
}
