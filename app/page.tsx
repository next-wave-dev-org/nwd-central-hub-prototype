import Link from 'next/link'
import Image from 'next/image'



export default function Home() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'white' }}>

      {/* Header */}
      <header className="bg-white border-b" style={{ borderColor: 'var(--nwd-border)' }}>
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Image
            src="/NextWaveDev_FINAL_small.png"
            alt="NextWaveDev logo"
            width={36}
            height={36}
            className="object-contain"
          />
          <div>
            <span className="font-semibold text-base tracking-tight" style={{ color: 'var(--nwd-purple)' }}>
              NextWaveDev
            </span>
            <span className="text-gray-400 mx-2 select-none">/</span>
            <span className="text-sm text-gray-500 font-medium">Central Hub</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-14">
        <div className="w-full max-w-md">

          {/* Page heading */}
          <div className="mb-10">
            <p
              className="text-xs font-semibold tracking-widest mb-2"
              style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}
            >
              PORTAL
            </p>
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">
              Sign in to continue
            </h1>
          </div>

          {/* Sign In Button */}
          <div className="mt-6">
            <Link
              href="/login"
              className="block w-full rounded-lg px-6 py-5 text-center font-semibold text-white text-lg"
              style={{
                background: 'var(--nwd-purple)',
              }}
            >
              Sign In
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 px-4">
        <p
          className="text-xs tracking-wide"
          style={{ color: 'var(--nwd-purple)', opacity: 0.4, fontFamily: 'var(--font-geist-mono)' }}
        >
          NWD CENTRAL HUB
        </p>
      </footer>

    </div>
  )
}
