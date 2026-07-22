'use client'

import Image from 'next/image'
import Link from 'next/link'
import UserMenu from '@/components/UserMenu'
import { useAuth } from '@/components/AuthProvider'
import { dashboardHref } from '@/lib/navigation'

type NavbarProps = {
  /** The current page, shown after the brand as "NextWaveDev / Title". */
  title: string
  /**
   * Set false where the role dashboard is unreachable — e.g. the forced
   * temporary-password change, which RouteGuard bounces straight back to.
   */
  linkBrand?: boolean
}

export default function Navbar({ title, linkBrand = true }: NavbarProps) {
  const { profile } = useAuth()
  const brandHref = linkBrand ? dashboardHref(profile?.role) : undefined

  const brand = (
    <>
      <Image
        src="/NextWaveDev_FINAL_small.png"
        alt="NextWaveDev logo"
        width={36}
        height={36}
        className="object-contain flex-shrink-0"
      />
      <span
        className="hidden sm:inline font-semibold text-base tracking-tight flex-shrink-0"
        style={{ color: 'var(--nwd-purple)' }}
      >
        NextWaveDev
      </span>
    </>
  )

  return (
    <header className="bg-white">
      {/* The divider lives on the centered container (not the full-bleed
          <header>) so it reads as a contained divider aligned to the content
          column — this sidesteps the reserved scrollbar gutter entirely, which
          page content can't paint into. scrollbar-gutter: stable (globals.css)
          keeps this centered line from shifting between scrolling and
          non-scrolling pages. */}
      <div className="w-[90%] mx-auto border-b" style={{ borderColor: 'var(--nwd-border)' }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center min-w-0 flex-1">
            {/* Logo and wordmark are one target back to the user's own
                dashboard. gap-3 lives on the link so the spacing between the
                two halves is unchanged whether or not it's clickable. */}
            {brandHref ? (
              <Link
                href={brandHref}
                className="flex items-center gap-3 flex-shrink-0 hover:opacity-80 transition-opacity"
                aria-label="Go to dashboard"
              >
                {brand}
              </Link>
            ) : (
              <div className="flex items-center gap-3 flex-shrink-0">{brand}</div>
            )}
            <div className="flex items-center min-w-0">
              <span className="text-gray-400 mx-2 select-none flex-shrink-0">/</span>
              <span className="text-sm font-medium truncate" style={{ color: 'var(--nwd-teal)' }}>
                {title}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  )
}
