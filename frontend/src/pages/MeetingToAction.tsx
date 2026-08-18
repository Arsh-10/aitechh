import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarPlus,
  CheckCircle2,
  Circle,
  HelpCircle,
  ListChecks,
  Loader2,
  LogOut,
  Menu,
  Mic,
  MicOff,
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
import { UnderTheHood } from '@/components/UnderTheHood'
import { TypingDots } from '@/components/TypingDots'
import {
  analyzeMeeting,
  apiGet,
  deleteMeeting,
  downloadMeetingIcs,
  getMeeting,
  listMeetings,
  saveMeeting,
  streamMeetingChat,
  type ActionItem,
  type Meeting,
  type MeetingCard,
} from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// Browser Web Speech API — free, on-device dictation. Typed loosely (no DOM lib types).
const SpeechRecognition =
  typeof window !== 'undefined'
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    : undefined

function fmtDue(due: string): string {
  if (!due) return ''
  const d = new Date(due + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function MeetingToAction() {
  const { signOut, user } = useAuth()
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null)

  const [meetingId, setMeetingId] = useState<string | null>(null)
  const [card, setCard] = useState<MeetingCard | null>(null)
  const [mode, setMode] = useState<'actions' | 'chat'>('actions')
  const [icsNote, setIcsNote] = useState<string | null>(null)

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

  const refresh = () => listMeetings().then(setMeetings).catch(() => setMeetings([]))

  const reset = () => {
    setMeetingId(null)
    setCard(null)
    setText('')
    setTitle('')
    setError(null)
    setMessages([])
    setIcsNote(null)
    convId.current = null
    setSidebarOpen(false)
  }

  const open = async (m: Meeting) => {
    setSidebarOpen(false)
    setMeetingId(m.id)
    setCard(m.data)
    setMode('actions')
    setMessages([])
    setIcsNote(null)
    convId.current = m.conversation_id
    try {
      const full = await getMeeting(m.id)
      setMessages(full.messages)
      convId.current = full.meeting.conversation_id
    } catch {
      /* ignore */
    }
  }

  const toggleDictate = () => {
    if (!SpeechRecognition) return
    if (listening) {
      recRef.current?.stop()
      return
    }
    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = false
    rec.lang = 'en-US'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let t = ''
      for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript
      setText((prev) => (prev ? prev + ' ' : '') + t.trim())
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    rec.start()
    setListening(true)
  }

  const analyze = async () => {
    if (text.trim().length < 20) {
      setError('Paste (or dictate) a bit more of the meeting to work from.')
      return
    }
    if (listening) recRef.current?.stop()
    setAnalyzing(true)
    setError(null)
    try {
      const res = await analyzeMeeting({ text: text.trim(), title: title.trim() || undefined })
      if (res) {
        setMeetingId(res.id)
        setCard(res.card)
        setMode('actions')
        refresh()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that meeting.')
    } finally {
      setAnalyzing(false)
    }
  }

  const remove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteMeeting(id).catch(() => {})
    if (meetingId === id) reset()
    refresh()
  }

  const toggleDone = (idx: number) => {
    if (!card || !meetingId) return
    const next: MeetingCard = {
      ...card,
      action_items: card.action_items.map((a, i) => (i === idx ? { ...a, done: !a.done } : a)),
    }
    setCard(next)
    saveMeeting(meetingId, next).catch(() => {})
  }

  const exportIcs = async () => {
    if (!meetingId) return
    try {
      const n = await downloadMeetingIcs(meetingId)
      setIcsNote(n > 0 ? `Added ${n} dated action${n === 1 ? '' : 's'} to a calendar file.` : 'No dated actions to export yet.')
    } catch {
      setIcsNote('Could not export.')
    }
  }

  const send = async (msg: string) => {
    if (!msg.trim() || streaming) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: msg }, { role: 'assistant', content: '' }])
    setStreaming(true)
    try {
      await streamMeetingChat({ message: msg, conversation_id: convId.current, meeting_id: meetingId }, (evt) => {
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
      })
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
            <p className="mt-1 text-sm text-muted-foreground">One-time setup — the same key powers every aitech app.</p>
          </div>
          <ApiKeyForm status={keyStatus} onChange={setKeyStatus} />
          <Link to="/" className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground">
            ← Back to home
          </Link>
        </div>
      </div>
    )

  const dated = card?.action_items.some((a) => a.due) ?? false

  return (
    <div className="relative flex h-[100dvh]">
      <AuroraBackdrop />
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}
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
          <Button size="sm" variant="outline" onClick={reset}>
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
        <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Your meetings</div>
        <div className="flex-1 space-y-1 overflow-y-auto px-2 pt-1">
          {meetings.length === 0 && <p className="px-2 py-4 text-sm text-muted-foreground">No meetings yet.</p>}
          {meetings.map((m) => (
            <button
              key={m.id}
              onClick={() => open(m)}
              className={cn(
                'group flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent',
                meetingId === m.id && 'bg-accent text-accent-foreground'
              )}
            >
              <span className="min-w-0 flex-1 truncate">{m.title}</span>
              <Trash2
                className="h-4 w-4 shrink-0 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-70"
                onClick={(e) => remove(m.id, e)}
              />
            </button>
          ))}
        </div>
        <div className="px-3 pb-1">
          <UnderTheHood app="meeting-to-action" />
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
          <span className="font-semibold">Meeting → Action</span>
        </div>

        {card && (
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
            <span className="min-w-0 truncate font-medium">{card.title}</span>
            <div className="flex shrink-0 rounded-lg border p-0.5 text-sm">
              <button onClick={() => setMode('actions')} className={cn('rounded-md px-3 py-1', mode === 'actions' && 'bg-accent text-accent-foreground')}>
                Actions
              </button>
              <button onClick={() => setMode('chat')} className={cn('rounded-md px-3 py-1', mode === 'chat' && 'bg-accent text-accent-foreground')}>
                Ask
              </button>
            </div>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 py-6">
            {!card ? (
              <div className="mt-6">
                <div className="text-center">
                  <div className="mx-auto mb-2 flex justify-center"><Orb size={110} /></div>
                  <h2 className="font-display text-3xl font-medium">Turn talk into action</h2>
                  <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                    Paste a meeting transcript or your rough notes — or dictate them. You'll get action items with
                    owners and due dates, decisions, and open questions, ready for your calendar.
                  </p>
                </div>
                <div className="glass-panel mx-auto mt-7 max-w-xl space-y-3 rounded-2xl p-6">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Title (optional) — e.g. Weekly standup, Client call"
                    className="h-10 w-full rounded-md border border-input bg-background/60 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste the transcript or notes here…"
                    className="min-h-[220px]"
                  />
                  {SpeechRecognition && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={toggleDictate}
                      className={cn('w-full', listening && 'border-destructive text-destructive')}
                    >
                      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      {listening ? 'Stop dictation' : 'Dictate (free, on-device)'}
                    </Button>
                  )}
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button onClick={analyze} disabled={analyzing} className="w-full" size="lg">
                    {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {analyzing ? 'Pulling out the actions…' : 'Extract the actions'}
                  </Button>
                </div>
              </div>
            ) : mode === 'actions' ? (
              <div className="space-y-5">
                <div className="glass-panel rounded-2xl p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Summary</p>
                  <p className="mt-1.5 leading-relaxed">{card.summary}</p>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <ListChecks className="h-4 w-4" /> Action items
                    </p>
                    {dated && (
                      <Button size="sm" variant="outline" onClick={exportIcs}>
                        <CalendarPlus className="h-4 w-4" /> Add to calendar
                      </Button>
                    )}
                  </div>
                  {icsNote && <p className="mb-2 text-xs text-muted-foreground">{icsNote}</p>}
                  {card.action_items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No action items found.</p>
                  ) : (
                    <ul className="space-y-2">
                      {card.action_items.map((a, i) => (
                        <ActionRow key={i} a={a} onToggle={() => toggleDone(i)} />
                      ))}
                    </ul>
                  )}
                </div>

                {card.decisions?.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><CheckCircle2 className="h-4 w-4" /> Decisions</p>
                    <ul className="space-y-1.5">
                      {card.decisions.map((d, i) => (
                        <li key={i} className="flex gap-2 text-sm"><span className="text-primary">•</span><span>{d}</span></li>
                      ))}
                    </ul>
                  </div>
                )}

                {card.questions?.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><HelpCircle className="h-4 w-4" /> Open questions</p>
                    <ul className="space-y-1.5">
                      {card.questions.map((q, i) => (
                        <li key={i} className="flex gap-2 text-sm"><span className="text-primary">?</span><span>{q}</span></li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button variant="outline" className="w-full" onClick={() => setMode('chat')}>
                  Ask about this meeting
                </Button>
              </div>
            ) : (
              <div>
                {messages.length === 0 ? (
                  <div className="mt-10 text-center">
                    <div className="mx-auto mb-2 flex justify-center"><Orb size={100} /></div>
                    <h3 className="font-display text-2xl font-medium">Ask about “{card.title}”</h3>
                    <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
                      e.g. "What did I agree to?" — answered only from this meeting.
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

        {card && mode === 'chat' && (
          <div className="border-t bg-background p-4">
            <form
              onSubmit={(e) => { e.preventDefault(); send(input) }}
              className="mx-auto flex max-w-2xl items-end gap-2 glass-panel rounded-3xl p-2 pl-4 focus-within:ring-2 focus-within:ring-ring/40"
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
                placeholder="Ask about this meeting…"
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

function ActionRow({ a, onToggle }: { a: ActionItem; onToggle: () => void }) {
  return (
    <li className="glass-panel flex items-start gap-3 rounded-xl p-3">
      <button onClick={onToggle} aria-label={a.done ? 'Mark not done' : 'Mark done'} className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground">
        {a.done ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium leading-snug', a.done && 'text-muted-foreground line-through')}>{a.task}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {a.owner && <span>👤 {a.owner}</span>}
          {fmtDue(a.due) && <span>📅 {fmtDue(a.due)}</span>}
          <span
            className={cn(
              'rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
              a.priority === 'high' && 'border-transparent bg-primary text-primary-foreground'
            )}
          >
            {a.priority}
          </span>
        </div>
      </div>
    </li>
  )
}
