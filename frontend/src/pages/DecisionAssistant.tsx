import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  LogOut,
  Menu,
  Plus,
  RotateCcw,
  Scale,
  Send,
  Settings,
  Sparkles,
  Target,
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
  apiGet,
  deleteDecision,
  getDecision,
  listDecisions,
  recordOutcome,
  streamDecisionChat,
  wrapDecision,
  type Decision,
  type DecisionCard as CardType,
} from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'Should I take the new job offer or stay where I am?',
  'Should we move to a new city?',
  'Should I go freelance or keep my full-time job?',
]

export default function DecisionAssistant() {
  const { signOut, user } = useAuth()
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null)
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [activeId, setActiveId] = useState<string | null>(null) // conversation id
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Decision card + revisit
  const [cardOpen, setCardOpen] = useState(false)
  const [wrapping, setWrapping] = useState(false)
  const [card, setCard] = useState<CardType | null>(null)
  const [activeDecisionId, setActiveDecisionId] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    apiGet<KeyStatus>('/api/keys').then(setKeyStatus).catch(() => setKeyStatus({ has_key: false }))
    refreshDecisions()
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  const refreshDecisions = () => {
    listDecisions().then(setDecisions).catch(() => setDecisions([]))
  }

  const newDecision = () => {
    setActiveId(null)
    setMessages([])
    setInput('')
    setActiveDecisionId(null)
    setCard(null)
    setSidebarOpen(false)
  }

  const openDecision = async (d: Decision) => {
    setSidebarOpen(false)
    setActiveDecisionId(d.id)
    setActiveId(d.conversation_id)
    setCard(d.card)
    try {
      const data = await getDecision(d.id)
      setMessages(data.messages)
    } catch {
      setMessages([])
    }
  }

  const removeDecision = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteDecision(id).catch(() => {})
    if (activeDecisionId === id) newDecision()
    refreshDecisions()
  }

  const send = async (text: string) => {
    if (!text.trim() || streaming) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }])
    setStreaming(true)
    let createdId: string | null = null
    try {
      await streamDecisionChat({ message: text, conversation_id: activeId }, (evt) => {
        if (evt.conversation_id && !activeId) createdId = evt.conversation_id
        if (evt.delta) {
          setMessages((m) => {
            const copy = [...m]
            copy[copy.length - 1] = {
              role: 'assistant',
              content: copy[copy.length - 1].content + evt.delta,
            }
            return copy
          })
        }
        if (evt.error) {
          setMessages((m) => {
            const copy = [...m]
            copy[copy.length - 1] = { role: 'assistant', content: `⚠️ ${evt.error}` }
            return copy
          })
        }
      })
    } catch (e) {
      setMessages((m) => {
        const copy = [...m]
        copy[copy.length - 1] = {
          role: 'assistant',
          content: `⚠️ ${e instanceof Error ? e.message : 'Request failed.'}`,
        }
        return copy
      })
    } finally {
      setStreaming(false)
      if (createdId) setActiveId(createdId)
    }
  }

  const getDecisionCard = async () => {
    if (!activeId) return
    setCardOpen(true)
    setWrapping(true)
    try {
      const res = await wrapDecision(activeId)
      setCard(res?.card ?? null)
      if (res?.id) setActiveDecisionId(res.id)
      refreshDecisions()
    } catch {
      setCard(null)
    } finally {
      setWrapping(false)
    }
  }

  if (keyStatus === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>
    )
  }

  // Shared OpenAI key gate (same key powers every mini-app).
  if (!keyStatus.has_key) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/30 px-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-lift">
          <div className="mb-6 flex flex-col items-center text-center">
            <Orb size={96} />
            <h1 className="font-display mt-2 text-2xl font-medium">Add your OpenAI key</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              One-time setup — the same key powers every aitech app.
            </p>
          </div>
          <ApiKeyForm status={keyStatus} onChange={setKeyStatus} />
          <Link to="/" className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground">
            ← Back to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[100dvh] bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
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
          <Button size="sm" variant="outline" onClick={newDecision}>
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
        <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Past decisions
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto px-2 pt-1">
          {decisions.length === 0 && (
            <p className="px-2 py-4 text-sm text-muted-foreground">No decisions yet.</p>
          )}
          {decisions.map((d) => (
            <button
              key={d.id}
              onClick={() => openDecision(d)}
              className={cn(
                'group flex w-full items-start justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent',
                activeDecisionId === d.id && 'bg-accent text-accent-foreground'
              )}
            >
              <span className="min-w-0">
                <span className="block truncate">{d.title}</span>
                {d.outcome_rating != null && (
                  <span className="text-[11px] text-muted-foreground">revisited · {d.outcome_rating}/5</span>
                )}
              </span>
              <Trash2
                className="mt-0.5 h-4 w-4 shrink-0 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-70"
                onClick={(e) => removeDecision(d.id, e)}
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
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold">Decision Assistant</span>
        </div>

        {activeId && messages.length > 1 && (
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Scale className="h-3.5 w-3.5" /> Thinking it through
            </span>
            <Button size="sm" variant="outline" onClick={getDecisionCard} disabled={streaming}>
              <Sparkles className="h-4 w-4" /> Get my decision card
            </Button>
          </div>
        )}

        <div className="border-b bg-accent/50 px-4 py-2 text-center text-xs text-accent-foreground">
          A thinking partner for hard choices — not financial, legal, or medical advice.
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 py-6">
            {messages.length === 0 ? (
              <div className="mt-10 text-center">
                <div className="mx-auto mb-2 flex justify-center">
                  <Orb size={120} />
                </div>
                <h2 className="font-display text-3xl font-medium">What are you deciding?</h2>
                <p className="mx-auto mt-3 max-w-sm text-muted-foreground">
                  Tell me the choice you're weighing. I'll help you think it through clearly —
                  options, what matters, the trade-offs, and the blind spots.
                </p>
                <div className="mx-auto mt-7 flex max-w-md flex-col gap-2.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="group flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 text-left text-sm shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift"
                    >
                      <span>{s}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((m, i) => {
                  const isLast = i === messages.length - 1
                  const isStreamingThis = streaming && isLast && m.role === 'assistant'
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
                        {m.role === 'assistant' ? (
                          m.content ? (
                            <Markdown>{m.content}</Markdown>
                          ) : isStreamingThis ? (
                            <TypingDots />
                          ) : (
                            ''
                          )
                        ) : (
                          m.content
                        )}
                      </div>
                      {m.role === 'assistant' && m.content && !isStreamingThis && (
                        <SpeakButton text={m.content} className="mt-1" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="border-t bg-background p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className="mx-auto flex max-w-2xl items-end gap-2 rounded-3xl border bg-card p-2 pl-4 shadow-soft transition-shadow focus-within:shadow-lift focus-within:ring-2 focus-within:ring-ring/40"
          >
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send(input)
                }
              }}
              placeholder="Describe the decision you're weighing…"
              rows={1}
              className="max-h-40 resize-none border-0 bg-transparent p-0 py-2.5 shadow-none focus-visible:ring-0"
            />
            <Button type="submit" size="icon" disabled={streaming || !input.trim()} className="h-10 w-10 shrink-0 rounded-full">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </main>

      {/* Decision card + revisit */}
      <Dialog open={cardOpen} onOpenChange={setCardOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Your decision card</DialogTitle>
            <DialogDescription>A clear summary of how you're thinking about this.</DialogDescription>
          </DialogHeader>
          {wrapping ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Summarising your decision…
            </div>
          ) : card ? (
            <DecisionCardView
              card={card}
              decisionId={activeDecisionId}
              onSaved={() => {
                refreshDecisions()
                setCardOpen(false)
              }}
            />
          ) : (
            <p className="py-6 text-sm text-muted-foreground">Couldn't build a card yet — talk a bit more, then try again.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DecisionCardView({
  card,
  decisionId,
  onSaved,
}: {
  card: CardType
  decisionId: string | null
  onSaved: () => void
}) {
  const [showOutcome, setShowOutcome] = useState(false)
  const [outcome, setOutcome] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const conf = Math.max(1, Math.min(5, Math.round(card.confidence || 0)))

  const save = async () => {
    if (!decisionId || !outcome.trim()) return
    setSaving(true)
    try {
      await recordOutcome(decisionId, { outcome: outcome.trim(), rating: rating ?? undefined })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-accent/40 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-accent-foreground">Leaning toward</p>
        <p className="mt-1 text-lg font-semibold">{card.leaning || 'Undecided'}</p>
        {card.rationale && <p className="mt-1 text-sm text-muted-foreground">{card.rationale}</p>}
      </div>

      {card.options?.length > 0 && (
        <Section icon={Scale} title="Options considered">
          <div className="flex flex-wrap gap-1.5">
            {card.options.map((o) => (
              <span key={o} className="rounded-full border bg-card px-2.5 py-1 text-xs">{o}</span>
            ))}
          </div>
        </Section>
      )}

      {card.criteria?.length > 0 && (
        <Section icon={Target} title="What matters to you">
          <div className="flex flex-wrap gap-1.5">
            {card.criteria.map((c) => (
              <span key={c} className="rounded-full border bg-secondary/50 px-2.5 py-1 text-xs text-muted-foreground">{c}</span>
            ))}
          </div>
        </Section>
      )}

      {card.key_risk && (
        <Section icon={AlertTriangle} title="Watch out for">
          <p className="text-sm text-muted-foreground">{card.key_risk}</p>
        </Section>
      )}

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Clarity</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={cn('h-2.5 w-2.5 rounded-full', n <= conf ? 'bg-primary' : 'bg-border')} />
          ))}
        </div>
      </div>

      {/* Revisit — record what actually happened */}
      {decisionId && (
        <div className="border-t pt-4">
          {!showOutcome ? (
            <Button variant="outline" size="sm" onClick={() => setShowOutcome(true)}>
              <RotateCcw className="h-4 w-4" /> Record what happened
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium">How did it turn out?</p>
              <Textarea
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="What did you decide, and how did it work out?"
                rows={3}
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Did it work?</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className={cn(
                      'h-8 w-8 rounded-md border text-sm',
                      rating === n ? 'border-primary bg-accent text-primary' : 'hover:bg-accent'
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <Button onClick={save} disabled={saving || !outcome.trim()} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save outcome
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Scale
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </p>
      {children}
    </div>
  )
}
