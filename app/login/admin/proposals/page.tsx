'use client'

import React, { useEffect, useState } from 'react'
import RouteGuard from '@/components/RouteGuard'
import Navbar from '@/components/Navbar'
import { supabase } from '@/lib/supabase'
import {
    type Proposal,
    canAdminReviewProposal,
} from '@/lib/proposals'
import { approveProposal, rejectProposal } from './actions'

type ProposalWithClient = Proposal & {
    client_name: string | null
    client_email: string | null
}

type ProposalJoinRow = {
    id: string
    title: string
    description: string | null
    budget: string | null
    status: ProposalWithClient['status']
    created_at: string | null
    profiles:
        | { name: string | null; email: string | null }[]
        | { name: string | null; email: string | null }
        | null
}

const PROPOSAL_SELECT = `
  id,
  title,
  description,
  budget,
  status,
  created_at,
  profiles!client_id (
    name,
    email
  )
`

function shapeProposals(rows: ProposalJoinRow[]): ProposalWithClient[] {
    return rows.map((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        return {
            id: row.id,
            title: row.title,
            description: row.description ?? undefined,
            budget: row.budget ?? undefined,
            status: row.status,
            createdAt: row.created_at ?? undefined,
            client_name: profile?.name ?? null,
            client_email: profile?.email ?? null,
        }
    })
}

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

function ProposalReviewContent() {
    const [proposals, setProposals] = useState<ProposalWithClient[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [processing, setProcessing] = useState<string | null>(null)
    const [toast, setToast] = useState<string | null>(null)
    const [expandedId, setExpandedId] = useState<string | null>(null)

    async function fetchProposals() {
        const { data, error } = await supabase
            .from('proposals')
            .select(PROPOSAL_SELECT)
            .eq('status', 'submitted')
            .order('created_at', { ascending: true })

        if (error) {
            setError(error.message)
            setLoading(false)
            return
        }

        setProposals(shapeProposals((data ?? []) as ProposalJoinRow[]))
        setLoading(false)
    }

    useEffect(() => {
        let active = true

        async function load() {
            const { data, error } = await supabase
                .from('proposals')
                .select(PROPOSAL_SELECT)
                .eq('status', 'submitted')
                .order('created_at', { ascending: true })

            if (!active) return

            if (error) {
                setError(error.message)
                setLoading(false)
                return
            }

            setProposals(shapeProposals((data ?? []) as ProposalJoinRow[]))
            setLoading(false)
        }

        void load()
        return () => { active = false }
    }, [])

    async function handleApprove(proposalId: string) {
        setProcessing(proposalId)
        const result = await approveProposal(proposalId)
        if (result.error) {
            setError(result.error)
        } else {
            setToast('Project created successfully.')
            setExpandedId(null)
            await fetchProposals()
        }
        setProcessing(null)
    }

    async function handleReject(proposalId: string) {
        setProcessing(proposalId)
        const result = await rejectProposal(proposalId)
        if (result.error) {
            setError(result.error)
        } else {
            setExpandedId(null)
            await fetchProposals()
        }
        setProcessing(null)
    }

    function toggleExpand(id: string) {
        setExpandedId((prev) => (prev === id ? null : id))
    }

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'white' }}>

            <Navbar
                breadcrumbs={[
                    { label: 'Admin Dashboard', href: '/login/admin' },
                    { label: 'Proposal Review' },
                ]}
            />

            <main className="flex-1 px-6 py-10">
                <div className="max-w-5xl mx-auto flex flex-col gap-10">

                    <section>
                        <div className="flex items-end justify-between mb-6">
                            <div>
                                <p className="text-xs font-semibold tracking-widest mb-1" style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}>REVIEW</p>
                                <h2 className="text-2xl font-bold text-gray-900">Proposal Review</h2>
                            </div>
                            {!loading && (
                                <span
                                    className="text-xs font-semibold tracking-wider px-3 py-1.5 rounded-lg"
                                    style={{
                                        color: proposals.length > 0 ? '#d97706' : '#6b7280',
                                        background: proposals.length > 0
                                            ? 'color-mix(in srgb, #d97706 12%, transparent)'
                                            : 'color-mix(in srgb, #6b7280 10%, transparent)',
                                        fontFamily: 'var(--font-geist-mono)',
                                    }}
                                >
                                    {proposals.length} pending
                                </span>
                            )}
                        </div>

                        {toast && (
                            <div className="mb-6 rounded-lg p-4 border" style={{ background: 'color-mix(in srgb, #10b981 8%, white)', borderColor: '#6ee7b7' }}>
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-emerald-800">{toast}</p>
                                    <button onClick={() => setToast(null)} className="text-emerald-600 hover:text-emerald-800 text-lg leading-none flex-shrink-0" aria-label="Dismiss">×</button>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="mb-6 rounded-lg p-4 border text-sm flex items-start justify-between gap-2" style={{ background: 'color-mix(in srgb, #f43f5e 8%, white)', borderColor: '#fda4af', color: '#9f1239' }}>
                                <span>{error}</span>
                                <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 text-lg leading-none flex-shrink-0" aria-label="Dismiss">×</button>
                            </div>
                        )}

                        {loading ? (
                            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading proposals…</div>
                        ) : proposals.length === 0 ? (
                            <div className="text-center py-16 text-gray-400 text-sm">No proposals awaiting review.</div>
                        ) : (
                            <div className="border rounded-lg overflow-x-auto" style={{ borderColor: 'var(--nwd-border)' }}>
                                <table className="min-w-full divide-y" style={{ borderColor: 'var(--nwd-border)' }}>
                                    <thead>
                                    <tr style={{ background: 'var(--nwd-surface)' }}>
                                        {['Title', 'Client', 'Budget', 'Status', 'Actions'].map((label) => (
                                            <th
                                                key={label}
                                                className={`px-4 py-3 text-xs font-semibold tracking-wider text-gray-500 whitespace-nowrap ${label === 'Actions' ? 'text-right' : 'text-left'}`}
                                                style={{ fontFamily: 'var(--font-geist-mono)' }}
                                            >
                                                {label}
                                            </th>
                                        ))}
                                    </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y" style={{ borderColor: 'var(--nwd-border)' }}>
                                    {proposals.map((proposal) => {
                                        const isReviewable = canAdminReviewProposal(proposal)
                                        const isProcessing = processing === proposal.id
                                        const anyProcessing = processing !== null
                                        const isExpanded = expandedId === proposal.id

                                        return (
                                            <React.Fragment key={proposal.id}>
                                                <tr
                                                    onClick={() => toggleExpand(proposal.id)}
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
                                                            {proposal.title}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                                                        <div>{proposal.client_name ?? 'Unknown'}</div>
                                                        <div className="text-xs text-gray-400" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                                                            {proposal.client_email}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                                                        {proposal.budget ? `$${proposal.budget}` : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <ProposalStatusBadge status={proposal.status} />
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                type="button"
                                                                disabled={!isReviewable || anyProcessing}
                                                                onClick={() => handleApprove(proposal.id)}
                                                                className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:brightness-90 active:brightness-75 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
                                                                style={{
                                                                    borderColor: 'var(--nwd-teal)',
                                                                    color: isProcessing ? '#6b7280' : 'var(--nwd-teal)',
                                                                    background: isProcessing
                                                                        ? 'color-mix(in srgb, #6b7280 8%, white)'
                                                                        : 'color-mix(in srgb, var(--nwd-teal) 8%, white)',
                                                                }}
                                                            >
                                                                {isProcessing ? 'Processing…' : 'Approve'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={!isReviewable || anyProcessing}
                                                                onClick={() => handleReject(proposal.id)}
                                                                className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:brightness-90 active:brightness-75 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
                                                                style={{
                                                                    borderColor: '#f43f5e',
                                                                    color: isProcessing ? '#6b7280' : '#f43f5e',
                                                                    background: isProcessing
                                                                        ? 'color-mix(in srgb, #6b7280 8%, white)'
                                                                        : 'color-mix(in srgb, #f43f5e 8%, white)',
                                                                }}
                                                            >
                                                                {isProcessing ? 'Processing…' : 'Reject'}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {isExpanded && (
                                                    <tr style={{ background: 'color-mix(in srgb, var(--nwd-teal) 5%, white)', borderTop: 'none' }}>
                                                        <td
                                                            colSpan={5}
                                                            className="px-6 py-4"
                                                            style={{ borderTop: '1px dashed color-mix(in srgb, var(--nwd-teal) 30%, transparent)' }}
                                                        >
                                                            <p className="text-xs font-semibold tracking-widest mb-2" style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}>
                                                                DESCRIPTION
                                                            </p>
                                                            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                                                                {proposal.description?.trim() || (
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

export default function ProposalReviewPage() {
    return (
        <RouteGuard allowedRoles={['admin']}>
            <ProposalReviewContent />
        </RouteGuard>
    )
}