export type UserRole = 'admin' | 'contractor' | 'client'

export type MiniProfileVisibility = {
  pronouns: boolean
  company: boolean
  region: boolean
}

export type UserProfile = {
  id: string
  email: string
  name?: string
  role: UserRole
  is_temporary_password?: boolean
  email_notifications?: boolean
  created_at?: string
  pronouns?: string | null
  company?: string | null
  region?: string | null
  mini_profile_visibility?: MiniProfileVisibility
}
