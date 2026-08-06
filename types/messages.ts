export type DirectMessage = {
  id: string
  content: string
  created_at: string
  read_at: string | null
  recipient_id: string
  sender_id: string
  profiles: { name: string | null } | null
}
