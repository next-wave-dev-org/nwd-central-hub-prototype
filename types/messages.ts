export type DirectMessage = {
  id: string
  content: string
  created_at: string
  read_at: string | null
  recipient_id: string
  sender_id: string
  thread_id: string | null
  profiles: { name: string | null } | null
}
