'use client'

import { useEffect, useRef } from 'react'

type ModalProps = {
  title: string
  onClose: () => void
  children: React.ReactNode
}

export default function Modal({ title, onClose, children }: ModalProps) {
  // Tracks whether the mousedown that led to this click actually started on
  // the backdrop itself — otherwise a text-selection drag that starts inside
  // the dialog and is released over the backdrop would dismiss the modal,
  // since the resulting click event's target is the backdrop either way.
  const mouseDownOnBackdropRef = useRef(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'color-mix(in srgb, black 40%, transparent)' }}
      onMouseDown={(e) => { mouseDownOnBackdropRef.current = e.target === e.currentTarget }}
      onClick={(e) => {
        if (e.target === e.currentTarget && mouseDownOnBackdropRef.current) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border bg-white p-6 shadow-xl"
        style={{ borderColor: 'var(--nwd-border)' }}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <h2 id="modal-title" className="text-lg font-bold text-gray-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-300 hover:text-gray-500 text-xl leading-none cursor-pointer flex-shrink-0"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
