import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-stone-50">
      <h1 className="text-2xl font-bold text-stone-900">Access Denied</h1>
      <p className="text-stone-500 text-sm">You don&apos;t have permission to view this page.</p>
      <Link
        href="/"
        className="text-sm text-stone-700 underline underline-offset-4 hover:text-stone-900"
      >
        Return home
      </Link>
    </div>
  )
}
