'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'next/navigation'
import RouteGuard from '@/components/RouteGuard'
import Navbar from '@/components/Navbar'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

const MESSAGE_POLL_INTERVAL_MS = 8000

// Minimal, dependency-free formatter for project descriptions: paragraphs
// (blank-line separated, single newlines kept as line breaks), #/##/###
// headings, - / * bullet lists, 1. numbered lists, and **bold**/*italic*/
// [link](url) inline spans. Not a full CommonMark implementation — covers
// the subset real descriptions use without pulling in a markdown parser.
// Builds React nodes directly (never dangerouslySetInnerHTML), so text is
// safe by construction — no HTML injection risk from submitted content.
type DescriptionBlock =
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'p'; lines: string[] }

function parseDescriptionBlocks(source: string): DescriptionBlock[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: DescriptionBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') {
      i++
      continue
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/)
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length >= 3 ? 3 : 2, text: headingMatch[2].trim() })
      i++
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''))
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    const pLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i])
    ) {
      pLines.push(lines[i])
      i++
    }
    blocks.push({ type: 'p', lines: pLines })
  }

  return blocks
}

const INLINE_REGEX = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null

  INLINE_REGEX.lastIndex = 0
  while ((match = INLINE_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))

    if (match[1] !== undefined) {
      nodes.push(
        <a
          key={`${keyPrefix}-${key++}`}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
          style={{ color: 'var(--nwd-purple)' }}
        >
          {match[1]}
        </a>
      )
    } else if (match[3] !== undefined) {
      nodes.push(
        <strong key={`${keyPrefix}-${key++}`} className="font-semibold text-gray-900">
          {match[3]}
        </strong>
      )
    } else if (match[4] !== undefined) {
      nodes.push(<em key={`${keyPrefix}-${key++}`}>{match[4]}</em>)
    }

    lastIndex = INLINE_REGEX.lastIndex
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))

  return nodes
}

function DescriptionText({ text }: { text: string }) {
  const blocks = parseDescriptionBlocks(text)

  return (
    <>
      {blocks.map((block, bi) => {
        if (block.type === 'heading') {
          const className =
            block.level === 2
              ? 'text-sm font-semibold text-gray-900 mt-4 mb-2 first:mt-0'
              : 'text-sm font-semibold text-gray-900 mt-3 mb-1 first:mt-0'
          return block.level === 2 ? (
            <h3 key={bi} className={className}>{renderInline(block.text, `h${bi}`)}</h3>
          ) : (
            <h4 key={bi} className={className}>{renderInline(block.text, `h${bi}`)}</h4>
          )
        }

        if (block.type === 'ul') {
          return (
            <ul key={bi} className="list-disc list-inside mb-3 space-y-1 last:mb-0">
              {block.items.map((item, ii) => (
                <li key={ii}>{renderInline(item, `ul${bi}-${ii}`)}</li>
              ))}
            </ul>
          )
        }

        if (block.type === 'ol') {
          return (
            <ol key={bi} className="list-decimal list-inside mb-3 space-y-1 last:mb-0">
              {block.items.map((item, ii) => (
                <li key={ii}>{renderInline(item, `ol${bi}-${ii}`)}</li>
              ))}
            </ol>
          )
        }

        return (
          <p key={bi} className="mb-3 last:mb-0">
            {block.lines.flatMap((line, li) => {
              const inline = renderInline(line, `p${bi}-${li}`)
              return li === 0 ? inline : [<br key={`br-${bi}-${li}`} />, ...inline]
            })}
          </p>
        )
      })}
    </>
  )
}

type ContractorProject = {
  contractor_id: string
  profiles: { name: string | null; email: string | null } | null
}

type ClientProfile = {
  name: string | null
  email: string | null
}

type Project = {
  id: string
  title: string
  description: string | null
  budget: string | null
  status: string
  created_at: string
  github_project_url: string | null
  contractor_projects: ContractorProject[]
  client: ClientProfile | null
}

type ProjectMessage = {
  id: string
  content: string
  created_at: string
  sender_id: string
  profiles: { name: string | null; role: string | null } | null
}

function roleLabel(role: string | null | undefined): string {
  if (!role) return ''
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function ProjectWorkspaceContent() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [messages, setMessages] = useState<ProjectMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    const fetchProject = async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id, title, description, budget, status, created_at, github_project_url,
          contractor_projects(contractor_id, profiles(name, email)),
          client:profiles!projects_client_id_fkey(name, email)
        `)
        .eq('id', id)
        .single()

      if (error || !data) {
        setNotFound(true)
      } else {
        setProject(data as unknown as Project)
      }
      setLoading(false)
    }

    fetchProject()
  }, [id])

  useEffect(() => {
    if (!id) return

    let cancelled = false

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('project_messages')
        .select('id, content, created_at, sender_id, profiles!sender_id(name, role)')
        .eq('project_id', id)
        .order('created_at', { ascending: true })

      if (!cancelled && data) {
        setMessages(data as unknown as ProjectMessage[])
      }
    }

    fetchMessages()
    const intervalId = setInterval(fetchMessages, MESSAGE_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [id])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = newMessage.trim()
    if (!content || !profile?.id) return

    setSending(true)
    setSendError(null)

    const { error } = await supabase.from('project_messages').insert({
      project_id: id,
      sender_id: profile.id,
      content,
    })

    if (error) {
      setSendError(error.message)
      setSending(false)
      return
    }

    setNewMessage('')
    setSending(false)

    const { data } = await supabase
      .from('project_messages')
      .select('id, content, created_at, sender_id, profiles!sender_id(name, role)')
      .eq('project_id', id)
      .order('created_at', { ascending: true })

    if (data) {
      setMessages(data as unknown as ProjectMessage[])
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'white' }}>
      <Navbar title={loading ? 'Loading…' : notFound ? 'Not Found' : project?.title || ''} />

      <main className="flex-1 px-6 py-10">
        <div className="max-w-5xl mx-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-9 h-9 rounded-full border-[3px] border-gray-200 border-t-gray-600 animate-spin" />
              <p className="text-sm text-stone-400">Loading project…</p>
            </div>
          )}

          {!loading && notFound && (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
              <p className="text-lg font-bold text-stone-800">Project not found</p>
              <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
                This project does not exist or you do not have access to it.
              </p>
            </div>
          )}

          {!loading && project && (
            <>
              <div className="mb-8">
                <p
                  className="text-xs font-semibold tracking-widest mb-2"
                  style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}
                >
                  PROJECT
                </p>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold text-gray-900 leading-tight">{project.title}</h1>
                    <span
                      className="text-xs font-semibold tracking-wider px-2 py-0.5 rounded"
                      style={{
                        color: '#065f46',
                        background: 'color-mix(in srgb, #10b981 15%, transparent)',
                        fontFamily: 'var(--font-geist-mono)',
                      }}
                    >
                      {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                    </span>
                  </div>
                  {project.github_project_url && (
                    <a
                      href={project.github_project_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-colors"
                      style={{
                        color: 'var(--nwd-purple)',
                        borderColor: 'var(--nwd-purple)',
                        background: 'color-mix(in srgb, var(--nwd-purple) 6%, transparent)',
                      }}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                      </svg>
                      View Project Board
                    </a>
                  )}
                </div>
              </div>

              <div className="mb-5 bg-white rounded-lg border p-5" style={{ borderColor: 'var(--nwd-border)' }}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Messages</p>

                <div className="max-h-96 overflow-y-auto flex flex-col gap-4 mb-4 pr-1">
                  {messages.length === 0 ? (
                    <p className="text-sm text-gray-400">Join project to view messages</p>
                  ) : (
                    messages.map((message) => (
                      <div key={message.id} className="text-sm">
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="font-medium text-gray-900">
                            {message.profiles?.name ?? 'Unknown'}
                          </span>
                          {message.profiles?.role && (
                            <span
                              className="text-xs font-semibold tracking-wider uppercase"
                              style={{ color: 'var(--nwd-teal)', fontFamily: 'var(--font-geist-mono)' }}
                            >
                              {roleLabel(message.profiles.role)}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {new Date(message.created_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      </div>
                    ))
                  )}
                </div>

                {sendError && (
                  <div
                    className="mb-3 rounded-lg p-3 border text-sm flex items-start justify-between gap-2"
                    style={{ background: 'color-mix(in srgb, #f43f5e 8%, white)', borderColor: '#fda4af', color: '#9f1239' }}
                  >
                    <span>{sendError}</span>
                    <button onClick={() => setSendError(null)} className="text-rose-400 hover:text-rose-600 text-lg leading-none flex-shrink-0" aria-label="Dismiss">×</button>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Write a message…"
                    rows={3}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 bg-white text-gray-900"
                    style={{ borderColor: 'var(--nwd-border)', resize: 'vertical' }}
                  />
                  <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    className="self-end rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                    style={{ background: 'var(--nwd-teal)' }}
                  >
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-lg border p-5" style={{ borderColor: 'var(--nwd-border)' }}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</p>
                {project.description ? (
                  <div className="text-sm text-gray-900 leading-relaxed">
                    <DescriptionText text={project.description} />
                  </div>
                ) : (
                  <p className="text-sm text-gray-900">—</p>
                )}

                <div
                  className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5 pt-5 border-t"
                  style={{ borderColor: 'var(--nwd-border)' }}
                >
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Budget</p>
                    <p className="text-sm text-gray-900">{project.budget || '—'}</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Created</p>
                    <p className="text-sm text-gray-900">
                      {new Date(project.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Client</p>
                    {project.client ? (
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">{project.client.name ?? 'Unknown'}</span>
                        {project.client.email && (
                          <span className="text-gray-400 ml-2">{project.client.email}</span>
                        )}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400">No client assigned.</p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Assigned Contractors
                    </p>
                    {project.contractor_projects.length === 0 ? (
                      <p className="text-sm text-gray-400">No contractors assigned yet.</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {project.contractor_projects.map((cp) => (
                          <li key={cp.contractor_id} className="text-sm text-gray-900">
                            <span className="font-medium">{cp.profiles?.name ?? 'Unknown'}</span>
                            {cp.profiles?.email && (
                              <span className="text-gray-400 ml-2">{cp.profiles.email}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

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

export default function ProjectWorkspacePage() {
  return (
    <RouteGuard allowedRoles={['admin', 'client', 'contractor']}>
      <ProjectWorkspaceContent />
    </RouteGuard>
  )
}
