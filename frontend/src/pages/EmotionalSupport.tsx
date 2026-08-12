import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
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
import { MemorySection } from '@/components/MemorySection'
import { VoiceSettings } from '@/components/VoiceSettings'
import { Markdown } from '@/components/Markdown'
import { MoodPicker, type Mood } from '@/components/MoodPicker'
import { Orb } from '@/components/Orb'
import { SpeakButton } from '@/components/SpeakButton'
import { ThemeToggle } from '@/components/ThemeToggle'
import { TypingDots } from '@/components/TypingDots'
import { apiGet, apiSend, saveMood, streamChat, wrapSession } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}
interface Conversation {
  id: string
  title: string
}

const SUGGESTIONS = [
  "I'm feeling overwhelmed and don't know where to start.",
  'Help me untangle what I\'m feeling right now.',
  'I had a hard day. Can I just talk it through?',
]

export default function EmotionalSupport() {
  const { signOut, user } = useAuth()
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false) // mobile drawer
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Mood + session-wrap state.
  const [preMood, setPreMood] = useState<Mood | null>(null)
  const preSavedForConv = useRef<string | null>(null)
  const [wrapOpen, setWrapOpen] = useState(false)
  const [wrapping, setWrapping] = useState(false)
  const [modeLabel, setModeLabel] = useState<string | null>(null)
  const [takeaway, setTakeaway] = useState<string | null>(null)
  const [postMood, setPostMood] = useState<Mood | null>(null)
  const [postSaved, setPostSaved] = useState(false)

  // Load key status + conversations on mount.
  useEffect(() => {
    apiGet<KeyStatus>('/api/keys')
      .then(setKeyStatus)
      .catch(() => setKeyStatus({ has_key: false }))
    refreshConversations()
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Auto-grow the composer as the user types (capped by max-height).
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  const refreshConversations = () => {
    apiGet<Conversation[]>('/api/chat/conversations')
      .then(setConversations)
      .catch(() => setConversations([]))
  }

  const openConversation = async (id: string) => {
    setActiveId(id)
    setPreMood(null)
    setModeLabel(null)
    setSidebarOpen(false)
    try {
      const data = await apiGet<{ messages: Message[] }>(`/api/chat/conversations/${id}`)
      setMessages(data.messages)
    } catch {
      setMessages([])
    }
  }

  const newChat = () => {
    setActiveId(null)
    setMessages([])
    setInput('')
    setPreMood(null)
    setModeLabel(null)
    setSidebarOpen(false)
  }

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await apiSend(`/api/chat/conversations/${id}`, 'DELETE').catch(() => {})
    if (activeId === id) newChat()
    refreshConversations()
  }

  const send = async (text: string) => {
    if (!text.trim() || streaming) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }])
    setStreaming(true)

    let createdId: string | null = null
    try {
      await streamChat({ message: text, conversation_id: activeId }, (evt) => {
        if (evt.conversation_id && !activeId) createdId = evt.conversation_id
        if (evt.mode_label) setModeLabel(evt.mode_label)
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
            copy[copy.length - 1] = {
              role: 'assistant',
              content: `⚠️ ${evt.error}`,
            }
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
      if (createdId) {
        setActiveId(createdId)
        refreshConversations()
        // Pair the "arriving" mood with the new conversation for the delta.
        if (preMood && preSavedForConv.current !== createdId) {
          preSavedForConv.current = createdId
          saveMood({ conversation_id: createdId, phase: 'pre', score: preMood.score, label: preMood.label }).catch(
            () => {}
          )
        }
      }
    }
  }

  const endAndReflect = async () => {
    if (!activeId) return
    setWrapOpen(true)
    setWrapping(true)
    setTakeaway(null)
    setPostMood(null)
    setPostSaved(false)
    try {
      const res = await wrapSession(activeId)
      setTakeaway(res?.takeaway ?? null)
    } catch {
      setTakeaway(null)
    } finally {
      setWrapping(false)
    }
  }

  const savePostMood = async (m: Mood) => {
    setPostMood(m)
    if (activeId) {
      await saveMood({ conversation_id: activeId, phase: 'post', score: m.score, label: m.label }).catch(
        () => {}
      )
    }
    setPostSaved(true)
  }

  const finishReflection = () => {
    setWrapOpen(false)
    refreshConversations()
    newChat()
  }

  if (keyStatus === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    )
  }

  // Gate: no key yet.
  if (!keyStatus.has_key) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/30 px-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-lift">
          <div className="mb-6 flex flex-col items-center text-center">
            <Orb size={96} />
            <h1 className="font-display mt-2 text-2xl font-medium">Add your OpenAI key</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              A one-time setup, then you're in. It's encrypted and only ever used for you.
            </p>
          </div>
          <ApiKeyForm status={keyStatus} onChange={setKeyStatus} />
          <Link
            to="/"
            className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[100dvh] bg-background">
      {/* Mobile overlay behind the drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar — static column on desktop, fixed drawer on mobile.
          Uses hidden/fixed rather than transforms for reliability. */}
      <aside
        className={cn(
          'w-72 shrink-0 flex-col border-r bg-secondary/30',
          'md:static md:z-auto md:flex', // desktop: always a visible static column
          sidebarOpen ? 'fixed inset-y-0 left-0 z-40 flex' : 'hidden'
        )}
      >
        <div className="flex items-center justify-between p-4">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> aitech
          </Link>
          <Button size="sm" variant="outline" onClick={newChat}>
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
        <div className="px-3 pb-2">
          <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
            <Link to="/app/emotional-support/insights" onClick={() => setSidebarOpen(false)}>
              <BarChart3 className="h-4 w-4" /> Your insights
            </Link>
          </Button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto px-2">
          {conversations.length === 0 && (
            <p className="px-2 py-4 text-sm text-muted-foreground">No conversations yet.</p>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => openConversation(c.id)}
              className={cn(
                'group flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent',
                activeId === c.id && 'bg-accent text-accent-foreground'
              )}
            >
              <span className="truncate">{c.title}</span>
              <Trash2
                className="h-4 w-4 shrink-0 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-70"
                onClick={(e) => deleteConversation(c.id, e)}
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
                <DialogDescription>
                  Signed in as {user?.email}. Manage your OpenAI key and memory below.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[70vh] space-y-6 overflow-y-auto">
                <ApiKeyForm status={keyStatus} onChange={setKeyStatus} />
                <div className="border-t pt-5">
                  <VoiceSettings open={settingsOpen} />
                </div>
                <div className="border-t pt-5">
                  <MemorySection open={settingsOpen} />
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      {/* Chat area */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header — hamburger to open the drawer */}
        <div className="flex items-center gap-3 border-b p-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold">Reflection Companion</span>
        </div>
        {/* Top bar: adaptive-mode indicator + end-session action */}
        {activeId && messages.length > 0 && (
          <div className="flex items-center justify-between border-b px-4 py-2">
            {modeLabel ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {modeLabel}
              </span>
            ) : (
              <span />
            )}
            <Button size="sm" variant="outline" onClick={endAndReflect} disabled={streaming}>
              <Sparkles className="h-4 w-4" /> End &amp; reflect
            </Button>
          </div>
        )}
        {/* Disclaimer */}
        <div className="border-b bg-accent/50 px-4 py-2 text-center text-xs text-accent-foreground">
          A reflective companion — not a therapist or a substitute for professional care. In
          crisis, contact your local emergency number (UAE 998 · US/Canada 988 · UK 116 123).
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 py-6">
            {messages.length === 0 ? (
              <div className="mt-10 text-center">
                <div className="mx-auto mb-2 flex justify-center">
                  <Orb size={120} />
                </div>
                <h2 className="font-display text-3xl font-medium">How are you, really?</h2>
                <p className="mx-auto mt-3 max-w-sm text-muted-foreground">
                  This is a private space to slow down and reflect. Start where you are.
                </p>

                {/* Arriving mood — optional, pairs with this session for your trend */}
                <div className="mx-auto mt-8 max-w-md rounded-xl border bg-card p-4">
                  <p className="mb-3 text-sm font-medium">How are you arriving today?</p>
                  <MoodPicker value={preMood?.score} onSelect={setPreMood} size="lg" />
                  {preMood && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Noted — {preMood.label.toLowerCase()}. Start whenever you're ready.
                    </p>
                  )}
                </div>

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
                    <div
                      key={i}
                      className={cn(
                        'flex flex-col',
                        m.role === 'user' ? 'items-end' : 'items-start'
                      )}
                    >
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
                      {/* Read-aloud, ChatGPT-style, on finished assistant replies */}
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

        {/* Composer */}
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
              placeholder="Type what's on your mind…"
              rows={1}
              className="max-h-40 resize-none border-0 bg-transparent p-0 py-2.5 shadow-none focus-visible:ring-0"
            />
            <Button
              type="submit"
              size="icon"
              disabled={streaming || !input.trim()}
              className="h-10 w-10 shrink-0 rounded-full"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="mx-auto mt-2 max-w-2xl px-1 text-center text-[11px] text-muted-foreground/70">
            Press Enter to send · Shift+Enter for a new line
          </p>
        </div>
      </main>

      {/* End-of-session reflection: takeaway + how you're leaving */}
      <Dialog open={wrapOpen} onOpenChange={setWrapOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Before you go</DialogTitle>
            <DialogDescription>A moment to close this session.</DialogDescription>
          </DialogHeader>

          {wrapping ? (
            <div className="flex items-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Reflecting on your conversation…
            </div>
          ) : (
            <div className="space-y-6">
              {takeaway && (
                <div className="rounded-xl border bg-accent/50 p-4">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-accent-foreground">
                    <Sparkles className="h-3.5 w-3.5" /> Your takeaway
                  </p>
                  <p className="text-sm">{takeaway}</p>
                </div>
              )}
              <div>
                <p className="mb-3 text-sm font-medium">How are you leaving this session?</p>
                <MoodPicker value={postMood?.score} onSelect={savePostMood} size="lg" />
              </div>
              <Button className="w-full" onClick={finishReflection} disabled={!postSaved}>
                {postSaved ? 'Done' : 'Pick how you feel to finish'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
