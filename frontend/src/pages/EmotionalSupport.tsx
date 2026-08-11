import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart3,
  HeartHandshake,
  Loader2,
  LogOut,
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
import { MoodPicker, type Mood } from '@/components/MoodPicker'
import { SpeakButton } from '@/components/SpeakButton'
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
  const scrollRef = useRef<HTMLDivElement>(null)

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

  const refreshConversations = () => {
    apiGet<Conversation[]>('/api/chat/conversations')
      .then(setConversations)
      .catch(() => setConversations([]))
  }

  const openConversation = async (id: string) => {
    setActiveId(id)
    setPreMood(null)
    setModeLabel(null)
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
        <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <HeartHandshake className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-semibold">Add your OpenAI key</h1>
              <p className="text-sm text-muted-foreground">One-time setup to start chatting.</p>
            </div>
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
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col border-r bg-secondary/30 md:flex">
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
            <Link to="/app/emotional-support/insights">
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
                  <MemorySection open={settingsOpen} />
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      {/* Chat area */}
      <main className="flex flex-1 flex-col">
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
              <div className="mt-16 text-center">
                <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <HeartHandshake className="h-7 w-7" />
                </span>
                <h2 className="text-xl font-semibold">How are you, really?</h2>
                <p className="mt-2 text-muted-foreground">
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

                <div className="mx-auto mt-6 flex max-w-md flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-lg border bg-card px-4 py-2.5 text-left text-sm hover:bg-accent"
                    >
                      {s}
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
                          'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm',
                          m.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground'
                        )}
                      >
                        {m.content || (isStreamingThis ? '…' : '')}
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
            className="mx-auto flex max-w-2xl items-end gap-2"
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
              placeholder="Type what's on your mind…"
              rows={1}
              className="max-h-40"
            />
            <Button type="submit" size="icon" disabled={streaming || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </main>

      {/* End-of-session reflection: takeaway + how you're leaving */}
      <Dialog open={wrapOpen} onOpenChange={setWrapOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Before you go</DialogTitle>
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
