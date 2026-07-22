'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import RouteGuard from '@/components/RouteGuard'
import Navbar from '@/components/Navbar'
import { getUsers } from '@/app/login/admin/users/actions'
import { createProjectDirect } from './actions'
import type { UserProfile } from '@/types/auth'

function CreateProjectContent() {
    const router = useRouter()

    const [users, setUsers] = useState<UserProfile[]>([])
    const [loadingUsers, setLoadingUsers] = useState(true)
    const [usersError, setUsersError] = useState<string | null>(null)

    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [budget, setBudget] = useState('')
    const [clientId, setClientId] = useState('')
    const [contractorIds, setContractorIds] = useState<string[]>([])

    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function loadUsers() {
            const result = await getUsers()
            if (result.success) {
                setUsers(result.users)
            } else {
                setUsersError(result.error)
            }
            setLoadingUsers(false)
        }
        loadUsers()
    }, [])

    const clients = useMemo(() => users.filter((u) => u.role === 'client'), [users])
    const contractors = useMemo(() => users.filter((u) => u.role === 'contractor'), [users])

    function handleContractorToggle(id: string) {
        setContractorIds((prev) =>
            prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
        )
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSubmitting(true)
        setError(null)

        const result = await createProjectDirect({
            title,
            description: description || undefined,
            budget: budget || undefined,
            clientId: clientId || null,
            contractorIds,
        })

        if ('error' in result) {
            setError(result.error)
            setSubmitting(false)
            return
        }

        router.push(`/login/projects/${result.projectId}`)
    }

    const inputCls =
        'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 bg-white text-gray-900'
    const inputStyle = { borderColor: 'var(--nwd-border)' }

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'white' }}>

            <Navbar title="Create Project" />

            <main className="flex-1 px-6 py-10">
                <div className="max-w-2xl mx-auto">
                    <section>
                        <h2 className="text-2xl font-bold text-gray-900 mb-1">Create Project</h2>
                        <p className="text-sm text-gray-400 mb-6">
                            Start a project directly — no client proposal required. Assign a client and contractors now, or leave them unassigned for later.
                        </p>

                        {error && (
                            <div
                                className="mb-6 rounded-lg p-4 border text-sm flex items-start justify-between gap-2"
                                style={{ background: 'color-mix(in srgb, #f43f5e 8%, white)', borderColor: '#fda4af', color: '#9f1239' }}
                            >
                                <span>{error}</span>
                                <button type="button" onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 text-lg leading-none flex-shrink-0 cursor-pointer" aria-label="Dismiss">×</button>
                            </div>
                        )}

                        {usersError && (
                            <div
                                className="mb-6 rounded-lg p-4 border text-sm"
                                style={{ background: 'color-mix(in srgb, #f43f5e 8%, white)', borderColor: '#fda4af', color: '#9f1239' }}
                            >
                                Could not load users: {usersError}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-gray-700" htmlFor="title">
                                    Project Title
                                </label>
                                <input
                                    id="title"
                                    type="text"
                                    required
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
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
                                    rows={6}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="What is this project about?"
                                    className={inputCls}
                                    style={{ ...inputStyle, resize: 'vertical' }}
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-gray-700" htmlFor="budget">
                                    Budget ($)
                                </label>
                                <input
                                    id="budget"
                                    type="number"
                                    value={budget}
                                    onChange={(e) => setBudget(e.target.value)}
                                    placeholder="5000"
                                    className={inputCls}
                                    style={inputStyle}
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-gray-700" htmlFor="client">
                                    Client
                                </label>
                                <select
                                    id="client"
                                    value={clientId}
                                    onChange={(e) => setClientId(e.target.value)}
                                    disabled={loadingUsers}
                                    className={inputCls}
                                    style={inputStyle}
                                >
                                    <option value="">No client (internal work)</option>
                                    {clients.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name ?? c.email}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-gray-700">
                                    Contractors
                                </label>
                                {loadingUsers ? (
                                    <p className="text-sm text-gray-400">Loading…</p>
                                ) : contractors.length === 0 ? (
                                    <p className="text-sm text-gray-400">No contractors available.</p>
                                ) : (
                                    <div className="border rounded-lg divide-y max-h-56 overflow-y-auto" style={inputStyle}>
                                        {contractors.map((c) => (
                                            <label
                                                key={c.id}
                                                className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-900 cursor-pointer hover:bg-gray-50"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={contractorIds.includes(c.id)}
                                                    onChange={() => handleContractorToggle(c.id)}
                                                    className="cursor-pointer"
                                                />
                                                <span>{c.name ?? c.email}</span>
                                                {c.name && <span className="text-gray-400 text-xs">{c.email}</span>}
                                            </label>
                                        ))}
                                    </div>
                                )}
                                <p className="text-xs text-gray-400">Select any number of contractors, or leave unassigned.</p>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-60 cursor-pointer"
                                style={{ background: 'var(--nwd-teal)' }}
                            >
                                {submitting ? 'Creating…' : 'Create Project'}
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

export default function CreateProjectPage() {
    return (
        <RouteGuard allowedRoles={['admin']}>
            <CreateProjectContent />
        </RouteGuard>
    )
}
