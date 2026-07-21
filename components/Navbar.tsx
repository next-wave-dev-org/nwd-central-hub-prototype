'use client'

import Image from 'next/image'
import Link from 'next/link'
import UserMenu from '@/components/UserMenu'

export type NavbarBreadcrumb = {
  label: string
  href?: string
}

type NavbarProps = {
  breadcrumbs: NavbarBreadcrumb[]
  onBack?: () => void
}

export default function Navbar({ breadcrumbs, onBack }: NavbarProps) {
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
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Image
              src="/NextWaveDev_FINAL_small.png"
              alt="NextWaveDev logo"
              width={36}
              height={36}
              className="object-contain flex-shrink-0"
            />
            <div className="flex items-center min-w-0">
              <span
                className="hidden sm:inline font-semibold text-base tracking-tight flex-shrink-0"
                style={{ color: 'var(--nwd-purple)' }}
              >
                NextWaveDev
              </span>
              {breadcrumbs.map((crumb, i) => {
                const isLast = i === breadcrumbs.length - 1
                const isBackTarget = !isLast && i === breadcrumbs.length - 2 && !crumb.href && !!onBack

                return (
                  <span
                    key={i}
                    className={`items-center ${isLast ? 'flex min-w-0' : 'hidden sm:flex flex-shrink-0'}`}
                  >
                    {/* On mobile only the current (last) crumb shows; its
                        separator stays so it reads "logo / Current Page". */}
                    <span className="text-gray-400 mx-2 select-none flex-shrink-0">/</span>
                    {isLast ? (
                      <span className="text-sm font-medium truncate" style={{ color: 'var(--nwd-teal)' }}>
                        {crumb.label}
                      </span>
                    ) : crumb.href ? (
                      <Link
                        href={crumb.href}
                        className="text-sm text-gray-500 font-medium hover:text-gray-700 transition-colors"
                      >
                        {crumb.label}
                      </Link>
                    ) : isBackTarget ? (
                      <button
                        type="button"
                        onClick={onBack}
                        className="text-sm text-gray-500 font-medium hover:text-gray-700 transition-colors cursor-pointer"
                      >
                        {crumb.label}
                      </button>
                    ) : (
                      <span className="text-sm text-gray-500 font-medium">{crumb.label}</span>
                    )}
                  </span>
                )
              })}
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
