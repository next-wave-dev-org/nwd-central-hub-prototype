export type UserRole = 'admin' | 'contractor' | 'client'

export type UserProfile = {
  id: string
  email: string
  role: UserRole
  name?: string
  is_temporary_password?: boolean
}
