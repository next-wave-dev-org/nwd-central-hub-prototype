export type UserRole = 'Admin' | 'Contractor' | 'Client'

export type UserProfile = {
  id: string
  email: string
  role: UserRole
}
