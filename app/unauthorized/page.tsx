'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function UnauthorizedPage() {
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-stone-50">
      <h1 className="text-2xl font-bold text-stone-900">Access Denied</h1>
      <p className="text-stone-500 text-sm">You don&apos;t have permission to view this page.</p>
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-sm text-stone-700 underline underline-offset-4 hover:text-stone-900"
        >
          Return home
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="text-sm text-stone-700 underline underline-offset-4 hover:text-stone-900 cursor-pointer"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
