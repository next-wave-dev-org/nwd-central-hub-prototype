'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import RouteGuard from '@/components/RouteGuard'
import Navbar from '@/components/Navbar'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { type Proposal } from '@/lib/proposals'

type ProposalStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

const STATUS_STYLES: Record<ProposalStatus, { color: string; label: string }> = {
    draft:     { color: '#6b7280', label: 'Draft' },
    submitted: { color: '#d97706', label: 'Submitted' },
    approved:  { color: 'var(--nwd-teal)', label: 'Approved' },
    rejected:  { color: '#f43f5e', label: 'Rejected' },
}

function ProposalStatusBadge({ status }: { status: string }) {
    const style = STATUS_STYLES[status as ProposalStatus] ?? STATUS_STYLES.draft
    return (
        <span
            className="text-xs font-semibold tracking-wider px-2 py-0.5 rounded"
            style={{
                color: style.color,
                background: `color-mix(in srgb, ${style.color} 12%, transparent)`,
                fontFamily: 'var(--font-geist-mono)',
            }}
        >
      {style.label}
    </span>
    )
}

function SubmissionsContent() {
    const { profile } = useAuth()
    const [proposals, setProposals] = useState<Proposal[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [expandedId, setExpandedId] = useState<string | null>(null)

    useEffect(() => {
        if (!profile?.id) return

        async function fetchProposals() {
            const { data, error } = await supabase
                .from('proposals')
                .select('id, title, description, budget, status, createdAt:created_at')
                .eq('client_id', profile!.id)
                .order('created_at', { ascending: false })

            if (error) {
                setError(error.message)
            } else {
                setProposals((data as Proposal[]) || [])
            }
            setLoading(false)
        }

        void fetchProposals()
    }, [profile])

    function toggleExpand(id: string) {
        setExpandedId((prev) => (prev === id ? null : id))
    }

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'white' }}>

            <Navbar title="Proposals" />

            <main className="flex-1 px-6 py-10">
                <div className="max-w-5xl mx-auto flex flex-col gap-10">

                    <section>
                        <div className="flex items-end justify-between mb-6">
                            <div>
                                <p className="text-xs font-semibold tracking-widest mb-1" style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}>PROPOSALS</p>
                                <h2 className="text-2xl font-bold text-gray-900">My Submissions</h2>
                            </div>
                            <Link
                                href="/login/client/proposals/new"
                                className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                                style={{ background: 'var(--nwd-teal)' }}
                            >
                                + New Proposal
                            </Link>
                        </div>

                        {error && (
                            <div className="mb-6 rounded-lg p-4 border text-sm" style={{ background: 'color-mix(in srgb, #f43f5e 8%, white)', borderColor: '#fda4af', color: '#9f1239' }}>
                                {error}
                            </div>
                        )}

                        {loading ? (
                            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading proposals…</div>
                        ) : proposals.length === 0 ? (
                            <div className="text-center py-16 text-gray-400 text-sm">
                                No proposals yet. Create your first one above.
                            </div>
                        ) : (
                            <div className="border rounded-lg overflow-x-auto" style={{ borderColor: 'var(--nwd-border)' }}>
                                <table className="min-w-full divide-y" style={{ borderColor: 'var(--nwd-border)' }}>
                                    <thead>
                                    <tr style={{ background: 'var(--nwd-surface)' }}>
                                        {['Title', 'Budget', 'Status', 'Submitted'].map((label) => (
                                            <th
                                                key={label}
                                                className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-gray-500 whitespace-nowrap"
                                                style={{ fontFamily: 'var(--font-geist-mono)' }}
                                            >
                                                {label}
                                            </th>
                                        ))}
                                    </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y" style={{ borderColor: 'var(--nwd-border)' }}>
                                    {proposals.map((item) => {
                                        const isExpanded = expandedId === item.id
                                        const submittedAt = item.createdAt
                                            ? new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                            : '—'

                                        return (
                                            <React.Fragment key={item.id}>
                                                <tr
                                                    onClick={() => toggleExpand(item.id)}
                                                    className="cursor-pointer transition-colors"
                                                    style={{ background: isExpanded ? 'color-mix(in srgb, var(--nwd-teal) 5%, white)' : undefined }}
                                                    onMouseEnter={(e) => {
                                                        if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'var(--nwd-surface)'
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        ;(e.currentTarget as HTMLElement).style.background = isExpanded
                                                            ? 'color-mix(in srgb, var(--nwd-teal) 5%, white)'
                                                            : ''
                                                    }}
                                                >
                                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            <svg
                                                                className="w-3 h-3 flex-shrink-0 transition-transform"
                                                                style={{
                                                                    color: isExpanded ? 'var(--nwd-teal)' : '#d1d5db',
                                                                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                                                }}
                                                                fill="none" viewBox="0 0 8 12" stroke="currentColor" strokeWidth="2"
                                                            >
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2 2l4 4-4 4" />
                                                            </svg>
                                                            {item.title}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                                                        {item.budget ? `$${item.budget}` : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <ProposalStatusBadge status={item.status} />
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                                                        {submittedAt}
                                                    </td>
                                                </tr>

                                                {isExpanded && (
                                                    <tr style={{ background: 'color-mix(in srgb, var(--nwd-teal) 5%, white)', borderTop: 'none' }}>
                                                        <td
                                                            colSpan={4}
                                                            className="px-6 py-4"
                                                            style={{ borderTop: '1px dashed color-mix(in srgb, var(--nwd-teal) 30%, transparent)' }}
                                                        >
                                                            <p className="text-xs font-semibold tracking-widest mb-2" style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}>
                                                                DESCRIPTION
                                                            </p>
                                                            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                                                                {item.description?.trim() || (
                                                                    <span className="text-gray-400 italic">No description provided.</span>
                                                                )}
                                                            </p>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        )
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        )}
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

export default function SubmissionsPage() {
    return (
        <RouteGuard allowedRoles={['client']}>
            <SubmissionsContent />
        </RouteGuard>
    )
}