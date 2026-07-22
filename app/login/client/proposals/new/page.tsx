'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import RouteGuard from '@/components/RouteGuard'
import Navbar from '@/components/Navbar'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

const WORD_LIMIT = 2000

function wordCount(text: string): number {
    return text.trim() === '' ? 0 : text.trim().split(/\s+/).length
}

function NewProposalContent() {
    const router = useRouter()
    const { profile } = useAuth()
    const [description, setDescription] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const words = wordCount(description)
    const overLimit = words > WORD_LIMIT

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (overLimit) return

        setIsSubmitting(true)
        setError(null)

        if (!profile?.id) {
            setError('You must be logged in to submit a proposal.')
            setIsSubmitting(false)
            return
        }

        const formData = new FormData(e.currentTarget as HTMLFormElement)

        const { error: insertError } = await supabase
            .from('proposals')
            .insert({
                client_id: profile.id,
                title: formData.get('title') as string,
                description,
                budget: formData.get('budget') as string,
                status: 'submitted',
            })

        if (insertError) {
            setError(insertError.message)
            setIsSubmitting(false)
            return
        }

        router.push('/login/client/proposals')
    }

    const inputCls =
        'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 bg-white text-gray-900'
    const inputStyle = { borderColor: 'var(--nwd-border)' }

    const counterColor =
        overLimit
            ? '#f43f5e'
            : words > WORD_LIMIT * 0.9
                ? '#d97706'
                : '#9ca3af'

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'white' }}>

            <Navbar title="New Proposal" />

            <main className="flex-1 px-6 py-10">
                <div className="max-w-2xl mx-auto">
                    <section>
                        <p className="text-xs font-semibold tracking-widest mb-1" style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}>NEW</p>
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Submit a Project Idea</h2>

                        {error && (
                            <div
                                className="mb-6 rounded-lg p-4 border text-sm flex items-start justify-between gap-2"
                                style={{ background: 'color-mix(in srgb, #f43f5e 8%, white)', borderColor: '#fda4af', color: '#9f1239' }}
                            >
                                <span>{error}</span>
                                <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 text-lg leading-none flex-shrink-0" aria-label="Dismiss">×</button>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-gray-700" htmlFor="title">
                                    Project Title
                                </label>
                                <input
                                    id="title"
                                    name="title"
                                    type="text"
                                    required
                                    placeholder="Enter a descriptive title"
                                    className={inputCls}
                                    style={inputStyle}
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-gray-700" htmlFor="description">
                                    Description
                                </label>
                                <textarea
                                    id="description"
                                    name="description"
                                    required
                                    rows={8}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="What is your project about?"
                                    className={inputCls}
                                    style={{ ...inputStyle, resize: 'vertical' }}
                                />
                                <div className="flex justify-end">
                  <span
                      className="text-xs tabular-nums"
                      style={{ fontFamily: 'var(--font-geist-mono)', color: counterColor }}
                  >
                    {words.toLocaleString()} / {WORD_LIMIT.toLocaleString()} words
                  </span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-gray-700" htmlFor="budget">
                                    Budget ($)
                                </label>
                                <input
                                    id="budget"
                                    name="budget"
                                    type="number"
                                    required
                                    placeholder="5000"
                                    className={inputCls}
                                    style={inputStyle}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting || overLimit}
                                className="w-full rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                                style={{ background: 'var(--nwd-teal)' }}
                            >
                                {isSubmitting ? 'Submitting…' : 'Submit Proposal'}
                            </button>

                        </form>
                    </section>
                </div>
            </main>

            <footer className="text-center py-6 px-4">
                <p className="text-xs tracking-wide" style={{ color: 'var(--nwd-purple)', opacity: 0.4, fontFamily: 'var(--font-geist-mono)' }}>
                    NWD CENTRAL HUB
                </p>
            </footer>

        </div>
    )
}

export default function NewProposalPage() {
    return (
        <RouteGuard allowedRoles={['client']}>
            <NewProposalContent />
        </RouteGuard>
    )
}