export type UserRole = 'admin' | 'contractor' | 'client'

export type UserProfile = {
  id: string
  email: string
  name?: string
  role: UserRole
  is_temporary_password?: boolean
  email_notifications?: boolean
  created_at?: string
}
