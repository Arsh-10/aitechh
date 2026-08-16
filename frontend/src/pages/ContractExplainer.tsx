import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  HelpCircle,
  ListChecks,
  Loader2,
  LogOut,
  Menu,
  Plus,
  Send,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ApiKeyForm, type KeyStatus } from '@/components/KeyManager'
import { Markdown } from '@/components/Markdown'
import { Orb } from '@/components/Orb'
import { SpeakButton } from '@/components/SpeakButton'
import { ThemeToggle } from '@/components/ThemeToggle'
import { TypingDots } from '@/components/TypingDots'
import {
  analyzeContract,
  apiGet,
  deleteContract,
  getContract,
  listContracts,
  streamContractChat,
  type ContractAnalysis,
  type ContractDoc,
} from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ContractExplainer() {
  const { signOut, user } = useAuth()
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null)
  const [docs, setDocs] = useState<ContractDoc[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [docId, setDocId] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null)
  const [mode, setMode] = useState<'analysis' | 'chat'>('analysis')

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const convId = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiGet<KeyStatus>('/api/keys').then(setKeyStatus).catch(() => setKeyStatus({ has_key: false }))
    refresh()
  }, [])
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const refresh = () => listContracts().then(setDocs).catch(() => setDocs([]))

  const reset = () => {
    setDocId(null)
    setAnalysis(null)
    setText('')
    setTitle('')
    setError(null)
    setMessages([])
    convId.current = null
    setSidebarOpen(false)
  }

  const open = async (d: ContractDoc) => {
    setSidebarOpen(false)
    setDocId(d.id)
    setAnalysis(d.data)
    setMode('analysis')
    setMessages([])
    convId.current = d.conversation_id
    try {
      const full = await getContract(d.id)
      setMessages(full.messages)
      convId.current = full.document.conversation_id
    } catch {
      /* ignore */
    }
  }

  const analyze = async () => {
    if (text.trim().length < 20) {
      setError('Paste a bit more of the document to analyse.')
      return
    }
    setAnalyzing(true)
    setError(null)
    try {
      const res = await analyzeContract({ text: text.trim(), title: title.trim() || undefined })
      if (res) {
        setDocId(res.id)
        setAnalysis(res.analysis)
        setMode('analysis')
        refresh()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not analyse the document.')
    } finally {
      setAnalyzing(false)
    }
  }

  const remove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteContract(id).catch(() => {})
    if (docId === id) reset()
    refresh()
  }

  const send = async (msg: string) => {
    if (!msg.trim() || streaming) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: msg }, { role: 'assistant', content: '' }])
    setStreaming(true)
    try {
      await streamContractChat(
        { message: msg, conversation_id: convId.current, document_id: docId },
        (evt) => {
          if (evt.conversation_id && !convId.current) convId.current = evt.conversation_id
          if (evt.delta)
            setMessages((m) => {
              const c = [...m]
              c[c.length - 1] = { role: 'assistant', content: c[c.length - 1].content + evt.delta }
              return c
            })
          if (evt.error)
            setMessages((m) => {
              const c = [...m]
              c[c.length - 1] = { role: 'assistant', content: `⚠️ ${evt.error}` }
              return c
            })
        }
      )
    } catch (e) {
      setMessages((m) => {
        const c = [...m]
        c[c.length - 1] = { role: 'assistant', content: `⚠️ ${e instanceof Error ? e.message : 'Request failed.'}` }
        return c
      })
    } finally {
      setStreaming(false)
    }
  }

  if (keyStatus === null)
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>

  if (!keyStatus.has_key)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/30 px-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-lift">
          <div className="mb-6 flex flex-col items-center text-center">
            <Orb size={96} />
            <h1 className="font-display mt-2 text-2xl font-medium">Add your OpenAI key</h1>
            <p className="mt-1 text-sm text-muted-foreground">One-time setup — the same key powers every aitech app.</p>
          </div>
          <ApiKeyForm status={keyStatus} onChange={setKeyStatus} />
          <Link to="/" className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground">
            ← Back to home
          </Link>
        </div>
      </div>
    )

  return (
    <div className="flex h-[100dvh] bg-background">
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside
        className={cn(
          'w-72 shrink-0 flex-col border-r bg-secondary/30',
          'md:static md:z-auto md:flex',
          sidebarOpen ? 'fixed inset-y-0 left-0 z-40 flex' : 'hidden'
        )}
      >
        <div className="flex items-center justify-between p-4">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> aitech
          </Link>
          <Button size="sm" variant="outline" onClick={reset}>
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
        <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Your documents</div>
        <div className="flex-1 space-y-1 overflow-y-auto px-2 pt-1">
          {docs.length === 0 && <p className="px-2 py-4 text-sm text-muted-foreground">No documents yet.</p>}
          {docs.map((d) => (
            <button
              key={d.id}
              onClick={() => open(d)}
              className={cn(
                'group flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent',
                docId === d.id && 'bg-accent text-accent-foreground'
              )}
            >
              <span className="min-w-0 flex-1 truncate">{d.title}</span>
              <Trash2
                className="h-4 w-4 shrink-0 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-70"
                onClick={(e) => remove(d.id, e)}
              />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t p-3">
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="flex-1 justify-start">
                <Settings className="h-4 w-4" /> Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
                <DialogDescription>Signed in as {user?.email}. Manage your OpenAI key.</DialogDescription>
              </DialogHeader>
              <ApiKeyForm status={keyStatus} onChange={setKeyStatus} />
            </DialogContent>
          </Dialog>
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b p-3 md:hidden">
          <button onClick={() => setSidebarOpen(true)} aria-label="Open menu" className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold">Contract Explainer</span>
        </div>

        {analysis && (
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
            <span className="min-w-0 truncate font-medium">{analysis.title}</span>
            <div className="flex shrink-0 rounded-lg border p-0.5 text-sm">
              <button onClick={() => setMode('analysis')} className={cn('rounded-md px-3 py-1', mode === 'analysis' && 'bg-accent text-accent-foreground')}>
                Analysis
              </button>
              <button onClick={() => setMode('chat')} className={cn('rounded-md px-3 py-1', mode === 'chat' && 'bg-accent text-accent-foreground')}>
                Ask
              </button>
            </div>
          </div>
        )}

        <div className="border-b bg-accent/50 px-4 py-2 text-center text-xs text-accent-foreground">
          Helps you understand documents — not legal advice. For anything important, consult a professional.
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 py-6">
            {!analysis ? (
              <div className="mt-6">
                <div className="text-center">
                  <div className="mx-auto mb-2 flex justify-center"><Orb size={110} /></div>
                  <h2 className="font-display text-3xl font-medium">Understand before you sign</h2>
                  <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                    Paste a contract, lease, offer letter, or terms. I'll explain it in plain English,
                    flag the risky clauses, and give you questions to ask.
                  </p>
                </div>
                <div className="mx-auto mt-7 max-w-xl space-y-3">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Title (optional) — e.g. Apartment lease, Job offer"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste the document text here…"
                    className="min-h-[240px]"
                  />
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button onClick={analyze} disabled={analyzing} className="w-full" size="lg">
                    {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {analyzing ? 'Reading it closely…' : 'Explain this document'}
                  </Button>
                </div>
              </div>
            ) : mode === 'analysis' ? (
              <div className="space-y-5">
                <div className="rounded-2xl border bg-card p-5 shadow-soft">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">In plain English</p>
                  <p className="mt-1.5 leading-relaxed">{analysis.summary}</p>
                </div>

                {analysis.key_points?.length > 0 && (
                  <Block icon={ListChecks} title="Key terms">
                    <ul className="space-y-1.5">
                      {analysis.key_points.map((k, i) => (
                        <li key={i} className="flex gap-2 text-sm"><span className="text-primary">•</span><span>{k}</span></li>
                      ))}
                    </ul>
                  </Block>
                )}

                {analysis.red_flags?.length > 0 && (
                  <Block icon={AlertTriangle} title="Watch out for" danger>
                    <ul className="space-y-2.5">
                      {analysis.red_flags.map((r, i) => (
                        <li key={i} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                          <p className="font-medium">🚩 {r.clause}</p>
                          <p className="mt-0.5 text-muted-foreground">{r.why}</p>
                        </li>
                      ))}
                    </ul>
                  </Block>
                )}

                {analysis.questions?.length > 0 && (
                  <Block icon={HelpCircle} title="Questions to ask before signing">
                    <ul className="space-y-1.5">
                      {analysis.questions.map((q, i) => (
                        <li key={i} className="flex gap-2 text-sm"><span className="text-primary">?</span><span>{q}</span></li>
                      ))}
                    </ul>
                  </Block>
                )}

                <Button variant="outline" className="w-full" onClick={() => setMode('chat')}>
                  Ask a question about this document
                </Button>
              </div>
            ) : (
              /* ASK view */
              <div>
                {messages.length === 0 ? (
                  <div className="mt-10 text-center">
                    <div className="mx-auto mb-2 flex justify-center"><Orb size={100} /></div>
                    <h3 className="font-display text-2xl font-medium">Ask about “{analysis.title}”</h3>
                    <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
                      e.g. "What happens if I break the lease early?" — I'll answer from the document.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((m, i) => {
                      const isLast = i === messages.length - 1
                      const streamingThis = streaming && isLast && m.role === 'assistant'
                      return (
                        <div key={i} className={cn('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
                          <div
                            className={cn(
                              'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                              m.role === 'user'
                                ? 'whitespace-pre-wrap rounded-br-md bg-primary text-primary-foreground shadow-soft'
                                : 'rounded-bl-md border bg-card text-card-foreground shadow-soft'
                            )}
                          >
                            {m.role === 'assistant' ? (m.content ? <Markdown>{m.content}</Markdown> : streamingThis ? <TypingDots /> : '') : m.content}
                          </div>
                          {m.role === 'assistant' && m.content && !streamingThis && <SpeakButton text={m.content} className="mt-1" />}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {analysis && mode === 'chat' && (
          <div className="border-t bg-background p-4">
            <form
              onSubmit={(e) => { e.preventDefault(); send(input) }}
              className="mx-auto flex max-w-2xl items-end gap-2 rounded-3xl border bg-card p-2 pl-4 shadow-soft focus-within:ring-2 focus-within:ring-ring/40"
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
                placeholder="Ask about this document…"
                rows={1}
                className="max-h-40 resize-none border-0 bg-transparent p-0 py-2.5 shadow-none focus-visible:ring-0"
              />
              <Button type="submit" size="icon" disabled={streaming || !input.trim()} className="h-10 w-10 shrink-0 rounded-full">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}

function Block({
  icon: Icon,
  title,
  danger,
  children,
}: {
  icon: typeof ListChecks
  title: string
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <p className={cn('mb-2 flex items-center gap-1.5 text-sm font-medium', danger && 'text-destructive')}>
        <Icon className="h-4 w-4" /> {title}
      </p>
      {children}
    </div>
  )
}
