import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
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
import { AuroraBackdrop } from '@/components/AuroraBackdrop'
import { Markdown } from '@/components/Markdown'
import { Orb } from '@/components/Orb'
import { SpeakButton } from '@/components/SpeakButton'
import { ThemeToggle } from '@/components/ThemeToggle'
import { TypingDots } from '@/components/TypingDots'
import {
  apiGet,
  deleteDeck,
  dueCards,
  generateDeck,
  getDeck,
  listDecks,
  reviewCard,
  streamStudyTutor,
  type Grade,
  type StudyCard,
  type StudyDeck,
} from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const GRADES: { grade: Grade; label: string; hint: string; cls: string }[] = [
  { grade: 'again', label: 'Again', hint: 'blanked', cls: 'border-destructive/40 text-destructive hover:bg-destructive/10' },
  { grade: 'hard', label: 'Hard', hint: 'struggled', cls: 'hover:bg-accent' },
  { grade: 'good', label: 'Good', hint: 'got it', cls: 'hover:bg-accent' },
  { grade: 'easy', label: 'Easy', hint: 'too easy', cls: 'border-primary/40 text-primary hover:bg-accent' },
]

export default function StudyCompanion() {
  const { signOut, user } = useAuth()
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null)
  const [decks, setDecks] = useState<StudyDeck[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // create-set state
  const [material, setMaterial] = useState('')
  const [genTitle, setGenTitle] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  // active deck + mode
  const [deck, setDeck] = useState<StudyDeck | null>(null)
  const [mode, setMode] = useState<'review' | 'tutor'>('review')

  // review state
  const [queue, setQueue] = useState<StudyCard[]>([])
  const [revealed, setRevealed] = useState(false)
  const [reviewedCount, setReviewedCount] = useState(0)
  const [loadingDeck, setLoadingDeck] = useState(false)

  // tutor state
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const convId = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiGet<KeyStatus>('/api/keys').then(setKeyStatus).catch(() => setKeyStatus({ has_key: false }))
    refreshDecks()
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const refreshDecks = () => listDecks().then(setDecks).catch(() => setDecks([]))

  const newSet = () => {
    setDeck(null)
    setMaterial('')
    setGenTitle('')
    setGenError(null)
    setQueue([])
    setMessages([])
    convId.current = null
    setSidebarOpen(false)
  }

  const openDeck = async (d: StudyDeck) => {
    setSidebarOpen(false)
    setLoadingDeck(true)
    setMode('review')
    setMessages([])
    convId.current = null
    try {
      const [full, due] = await Promise.all([getDeck(d.id), dueCards(d.id)])
      setDeck(full.deck)
      setQueue(due)
      setRevealed(false)
      setReviewedCount(0)
    } catch {
      /* ignore */
    } finally {
      setLoadingDeck(false)
    }
  }

  const create = async () => {
    if (material.trim().length < 10) {
      setGenError('Paste a bit more material to make good cards.')
      return
    }
    setGenerating(true)
    setGenError(null)
    try {
      const res = await generateDeck({ material: material.trim(), title: genTitle.trim() || undefined })
      refreshDecks()
      if (res?.deck) await openDeck(res.deck)
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Could not create the set.')
    } finally {
      setGenerating(false)
    }
  }

  const grade = async (g: Grade) => {
    const card = queue[0]
    if (!card) return
    reviewCard(card.id, g).catch(() => {})
    setReviewedCount((n) => n + 1)
    setRevealed(false)
    // 'again' → re-show later this session; else drop from the queue
    setQueue((q) => (g === 'again' ? [...q.slice(1), card] : q.slice(1)))
    refreshDecks()
  }

  const removeDeck = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteDeck(id).catch(() => {})
    if (deck?.id === id) newSet()
    refreshDecks()
  }

  const send = async (text: string) => {
    if (!text.trim() || streaming) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }])
    setStreaming(true)
    try {
      await streamStudyTutor(
        { message: text, conversation_id: convId.current, deck_id: deck?.id ?? null },
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
        <div className="glass-panel w-full max-w-md rounded-2xl p-8">
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

  const current = queue[0]

  return (
    <div className="relative flex h-[100dvh]">
      <AuroraBackdrop />
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={cn(
          'w-72 shrink-0 flex-col border-r border-border/50 bg-background/45 backdrop-blur-xl',
          'md:static md:z-auto md:flex',
          sidebarOpen ? 'fixed inset-y-0 left-0 z-40 flex' : 'hidden'
        )}
      >
        <div className="flex items-center justify-between p-4">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> aitech
          </Link>
          <Button size="sm" variant="outline" onClick={newSet}>
            <Plus className="h-4 w-4" /> New set
          </Button>
        </div>
        <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Your study sets
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto px-2 pt-1">
          {decks.length === 0 && <p className="px-2 py-4 text-sm text-muted-foreground">No sets yet.</p>}
          {decks.map((d) => (
            <button
              key={d.id}
              onClick={() => openDeck(d)}
              className={cn(
                'group flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent',
                deck?.id === d.id && 'bg-accent text-accent-foreground'
              )}
            >
              <span className="min-w-0 flex-1 truncate">{d.title}</span>
              {(d.due_count ?? 0) > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {d.due_count}
                </span>
              )}
              <Trash2
                className="h-4 w-4 shrink-0 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-70"
                onClick={(e) => removeDeck(d.id, e)}
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
          <span className="font-semibold">Study Companion</span>
        </div>

        {/* Deck header with Review/Tutor tabs */}
        {deck && (
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
            <span className="min-w-0 truncate font-medium">{deck.title}</span>
            <div className="flex shrink-0 rounded-lg border p-0.5 text-sm">
              <button
                onClick={() => setMode('review')}
                className={cn('rounded-md px-3 py-1', mode === 'review' && 'bg-accent text-accent-foreground')}
              >
                Review
              </button>
              <button
                onClick={() => setMode('tutor')}
                className={cn('rounded-md px-3 py-1', mode === 'tutor' && 'bg-accent text-accent-foreground')}
              >
                Tutor
              </button>
            </div>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 py-6">
            {/* CREATE-SET view */}
            {!deck ? (
              <div className="mt-6">
                <div className="text-center">
                  <div className="mx-auto mb-2 flex justify-center">
                    <Orb size={110} />
                  </div>
                  <h2 className="font-display text-3xl font-medium">What are you studying?</h2>
                  <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                    Paste your notes, an article, or a topic. I'll turn it into active-recall cards
                    and schedule reviews so it actually sticks.
                  </p>
                </div>
                <div className="glass-panel mx-auto mt-7 max-w-xl space-y-3 rounded-2xl p-6">
                  <input
                    value={genTitle}
                    onChange={(e) => setGenTitle(e.target.value)}
                    placeholder="Title (optional) — e.g. Cell biology, Chapter 3"
                    className="h-10 w-full rounded-md border border-input bg-background/60 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Textarea
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    placeholder="Paste your material here (notes, an article, a topic to learn)…"
                    className="min-h-[220px]"
                  />
                  {genError && <p className="text-sm text-destructive">{genError}</p>}
                  <Button onClick={create} disabled={generating} className="w-full" size="lg">
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {generating ? 'Building your cards…' : 'Create study set'}
                  </Button>
                </div>
              </div>
            ) : loadingDeck ? (
              <div className="mt-20 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : mode === 'review' ? (
              /* REVIEW view */
              <div className="mt-4">
                {current ? (
                  <div>
                    <p className="mb-3 text-center text-xs text-muted-foreground">
                      {queue.length} to review {reviewedCount > 0 && `· ${reviewedCount} done`}
                    </p>
                    <div className="glass-panel rounded-2xl p-6">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Question</p>
                      <p className="mt-2 text-lg font-medium leading-relaxed">{current.question}</p>
                      {revealed && (
                        <div className="mt-5 border-t pt-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-primary">Answer</p>
                          <p className="mt-2 leading-relaxed">{current.answer}</p>
                          {current.explanation && (
                            <p className="mt-3 text-sm text-muted-foreground">{current.explanation}</p>
                          )}
                        </div>
                      )}
                    </div>
                    {!revealed ? (
                      <Button className="mt-4 w-full" size="lg" onClick={() => setRevealed(true)}>
                        Show answer
                      </Button>
                    ) : (
                      <div className="mt-4 grid grid-cols-4 gap-2">
                        {GRADES.map((g) => (
                          <button
                            key={g.grade}
                            onClick={() => grade(g.grade)}
                            className={cn('rounded-xl border py-3 text-sm font-medium transition-colors', g.cls)}
                          >
                            {g.label}
                            <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">{g.hint}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-16 text-center">
                    <div className="mx-auto mb-3 flex justify-center">
                      <Orb size={96} />
                    </div>
                    <h3 className="font-display text-2xl font-medium">You're all caught up 🎉</h3>
                    <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
                      Nothing due right now. Spaced repetition will resurface these cards right before
                      you'd forget them — come back when they're due.
                    </p>
                    <Button variant="outline" className="mt-6" onClick={() => setMode('tutor')}>
                      <MessageCircle className="h-4 w-4" /> Ask the tutor instead
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              /* TUTOR view */
              <div>
                {messages.length === 0 ? (
                  <div className="mt-10 text-center">
                    <div className="mx-auto mb-2 flex justify-center">
                      <Orb size={100} />
                    </div>
                    <h3 className="font-display text-2xl font-medium">Ask about “{deck.title}”</h3>
                    <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
                      I know your material — ask me to explain anything, or to quiz you on a concept.
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
                                : 'glass-panel rounded-bl-md text-card-foreground'
                            )}
                          >
                            {m.role === 'assistant' ? (
                              m.content ? <Markdown>{m.content}</Markdown> : streamingThis ? <TypingDots /> : ''
                            ) : (
                              m.content
                            )}
                          </div>
                          {m.role === 'assistant' && m.content && !streamingThis && (
                            <SpeakButton text={m.content} className="mt-1" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Composer only in tutor mode */}
        {deck && mode === 'tutor' && (
          <div className="border-t bg-background p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                send(input)
              }}
              className="mx-auto flex max-w-2xl items-end gap-2 glass-panel rounded-3xl p-2 pl-4 focus-within:ring-2 focus-within:ring-ring/40"
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send(input)
                  }
                }}
                placeholder="Ask the tutor…"
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
