import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Brain,
  Check,
  HeartHandshake,
  KeyRound,
  Lock,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Volume2,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import { GitHubIcon } from '@/components/icons'
import { Aurora } from '@/components/Aurora'
import { AuroraBackdrop } from '@/components/AuroraBackdrop'
import { Orb } from '@/components/Orb'
import { Reveal } from '@/components/Reveal'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { MINI_APPS } from '@/lib/apps'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

const GITHUB_URL = 'https://github.com/Arsh-10/aitechh'

export default function Landing() {
  const { user } = useAuth()
  const appHref = '/app/emotional-support'

  return (
    <div className="relative min-h-screen">
      <AuroraBackdrop />
      {/* ── Nav ────────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 glass">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#privacy" className="transition-colors hover:text-foreground">Privacy</a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">
              GitHub
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <Button size="sm" asChild>
                <Link to={appHref}>Open app</Link>
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" asChild className="hidden sm:inline-flex">
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to={appHref}>Try it free</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[hsl(258_42%_9%)] text-white">
        <Aurora />
        <div className="container relative grid min-h-[92vh] items-center gap-12 pb-20 pt-32 md:grid-cols-[1.1fr_0.9fr] md:pt-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--gold))]" />
              Open source · your API key · your data
            </span>
            <h1 className="font-display mt-6 text-5xl font-medium leading-[1.05] tracking-tight md:text-7xl">
              Small AI tools,
              <br />
              built to <span className="text-gradient animate-shimmer">help</span>.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/70">
              aitech is a growing collection of open-source AI apps — each built to help with
              something real in your life. You run them with your own key, so your data and
              costs stay yours. A new one ships roughly every week.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild className="shadow-glow">
                <Link to={appHref}>
                  Try the first app <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                  <GitHubIcon className="h-4 w-4" /> Star on GitHub
                </a>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/55">
              {['No ads, ever', 'Encrypted & private', 'Free to run yourself'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-[hsl(var(--aurora-3))]" /> {t}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-center md:justify-end">
            <div className="animate-float">
              <Orb size={300} />
            </div>
          </div>
        </div>
        {/* fade into the light section */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />
      </section>

      {/* ── Flagship app: Reflection Companion ─────────────── */}
      <section className="container py-24">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
              <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-primary" />
              Live now · our first app
            </span>
            <h2 className="font-display mt-5 text-4xl font-medium leading-[1.1] md:text-5xl">
              A calmer place to <span className="text-gradient">think</span>.
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
              The <strong className="font-semibold text-foreground">Reflection Companion</strong>{' '}
              is a private space to reflect — it listens, adapts to what you're going through,
              and helps you notice your own patterns over time. You bring your own key, so it
              stays yours.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {['Sitting with heartbreak', 'Untangling work stress', 'Finding some calm'].map((m) => (
                <span key={m} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {m}
                </span>
              ))}
            </div>
            <Button size="lg" asChild className="mt-8">
              <Link to={appHref}>
                Start reflecting <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </Reveal>

          {/* Mini chat mock */}
          <Reveal delay={120} className="flex justify-center">
            <div className="glass-panel w-full max-w-md rounded-3xl p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Untangling work stress
                </span>
                <span className="text-xs text-muted-foreground">Reflection Companion</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-end">
                  <p className="max-w-[80%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                    I have three deadlines and I'm completely drowning.
                  </p>
                </div>
                <div className="flex flex-col items-start">
                  <p className="max-w-[85%] rounded-2xl bg-secondary px-4 py-2.5 text-sm text-secondary-foreground">
                    That's a lot to hold at once. Let's take it out of your head for a second —
                    of the three, which one feels genuinely the tightest?
                  </p>
                  <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Volume2 className="h-3.5 w-3.5" /> 1.5x
                  </span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────── */}
      <section id="how" className="container py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">How it works</p>
          <h2 className="font-display mt-3 text-3xl font-medium md:text-4xl">
            Three quiet steps to begin
          </h2>
        </Reveal>
        <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-3">
          {[
            { n: '01', icon: HeartHandshake, t: 'Create your space', d: 'Sign up in seconds. Your account is just yours — no social feed, no noise.' },
            { n: '02', icon: KeyRound, t: 'Bring your key', d: 'Add your own OpenAI key once. It’s encrypted before it’s ever stored, and you can delete it anytime.' },
            { n: '03', icon: Sparkles, t: 'Just start where you are', d: 'Say what’s on your mind. It meets you there — and remembers, so tomorrow picks up where you left off.' },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 120}>
              <div className="group h-full rounded-2xl glass-panel p-7 transition-shadow hover:shadow-lift">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-2xl text-muted-foreground/40">{s.n}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Feature bento ──────────────────────────────────── */}
      <section id="features" className="border-y bg-secondary/20 py-24">
        <div className="container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">Why it’s different</p>
            <h2 className="font-display mt-3 text-3xl font-medium md:text-4xl">
              Not another chatbot in a box
            </h2>
            <p className="mt-4 text-muted-foreground">
              A generic assistant forgets you the moment you close the tab. aitech is built to
              understand <em>you</em> — and to show you something you couldn’t see alone.
            </p>
          </Reveal>

          <div className="mx-auto mt-14 grid max-w-5xl auto-rows-[1fr] gap-5 md:grid-cols-3">
            {/* Big: adaptive */}
            <Reveal className="md:col-span-2">
              <BentoCard
                icon={Brain}
                title="It adapts to what you’re going through"
                body="Heartbreak, work stress, a spiral of anxiety, or a flat grey day — it detects the moment and shifts its tone, pace, and approach to match. You feel understood, not processed."
                accent
              >
                <div className="mt-5 flex flex-wrap gap-2">
                  {['Sitting with heartbreak', 'Untangling work stress', 'Finding some calm', 'Feeling less alone'].map((m) => (
                    <span key={m} className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {m}
                    </span>
                  ))}
                </div>
              </BentoCard>
            </Reveal>

            <Reveal delay={80}>
              <BentoCard icon={TrendingUp} title="See your patterns" body="A private dashboard: your mood over time, before→after each session, recurring themes, and the takeaways worth keeping." />
            </Reveal>

            <Reveal delay={80}>
              <BentoCard icon={Brain} title="It remembers you" body="A private, evolving picture of what matters to you — so it carries context across sessions instead of starting cold." />
            </Reveal>

            <Reveal delay={160}>
              <BentoCard icon={Volume2} title="Talk and listen" body="Read replies aloud with a free on-device voice and adjustable speed — no extra cost, works offline." />
            </Reveal>

            <Reveal delay={160}>
              <BentoCard icon={ShieldCheck} title="Care when it matters" body="If something serious comes up, it responds gently and always surfaces real, region-aware help." />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Privacy statement ──────────────────────────────── */}
      <section id="privacy" className="container py-28">
        <Reveal className="mx-auto max-w-3xl text-center">
          <span className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
            <Lock className="h-6 w-6" />
          </span>
          <h2 className="font-display text-3xl font-medium leading-tight md:text-5xl">
            Your key. Your words.
            <br />
            <span className="text-gradient">Yours to keep — or delete.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            For something this personal, trust isn’t a feature — it’s the whole point. Your
            OpenAI key is encrypted before it’s stored and never leaves the server in plain
            text. Every line of aitech is open source, so you never have to take our word for it.
          </p>
          <div className="mt-10 grid gap-4 text-left sm:grid-cols-3">
            {[
              { icon: KeyRound, t: 'Bring your own key', d: 'You control usage and cost.' },
              { icon: Lock, t: 'Encrypted at rest', d: 'Never stored in plain text.' },
              { icon: GitHubIcon, t: 'Fully open source', d: 'Read it. Run it yourself.' },
            ].map((f) => (
              <div key={f.t} className="rounded-2xl glass-panel p-5">
                <f.icon className="h-5 w-5 text-primary" />
                <p className="mt-3 font-medium">{f.t}</p>
                <p className="text-sm text-muted-foreground">{f.d}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Mini-apps ──────────────────────────────────────── */}
      <section className="border-y bg-secondary/20 py-24">
        <div className="container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">The collection</p>
            <h2 className="font-display mt-3 text-3xl font-medium md:text-4xl">A new mini-app every week</h2>
            <p className="mt-4 text-muted-foreground">
              Small, focused AI tools that solve one real thing well. Reflection Companion is
              live — more on the way.
            </p>
          </Reveal>
          <div className="mx-auto mt-12 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {MINI_APPS.map((app, i) => {
              const Icon = app.icon
              const card = (
                <div className={cn(
                  'group relative h-full overflow-hidden rounded-2xl glass-panel p-6 transition-all',
                  app.status === 'live' && 'hover:-translate-y-1 hover:shadow-lift'
                )}>
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 flex items-center gap-2 font-semibold">
                    {app.name}
                    {app.status === 'soon' && (
                      <span className="rounded-full border px-2 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                        soon
                      </span>
                    )}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{app.tagline}</p>
                  {app.status === 'live' && (
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                      Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  )}
                </div>
              )
              return (
                <Reveal key={app.slug} delay={i * 70} className="h-full">
                  {app.path && app.status === 'live' ? <Link to={app.path} className="block h-full">{card}</Link> : <div className="h-full opacity-70">{card}</div>}
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Pull quote ─────────────────────────────────────── */}
      <section className="container py-28">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="font-display text-2xl font-medium leading-snug md:text-4xl">
            “You don’t have a shortage of things to do.
            <br className="hidden md:block" /> You have a shortage of quiet moments to
            <span className="text-gradient"> understand yourself</span>.”
          </p>
          <p className="mt-6 text-sm text-muted-foreground">— why aitech exists</p>
        </Reveal>
      </section>

      {/* ── FAQ ────────────────────────────────────────────── */}
      <section className="border-t bg-secondary/20 py-24">
        <div className="container mx-auto max-w-2xl">
          <Reveal className="text-center">
            <h2 className="font-display text-3xl font-medium md:text-4xl">Good questions</h2>
          </Reveal>
          <div className="mt-10">
            <Faq />
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[hsl(258_42%_9%)] py-24 text-white">
        <Aurora />
        <Reveal className="container relative text-center">
          <h2 className="font-display text-4xl font-medium leading-tight md:text-6xl">
            Start where you are.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-white/70">
            No pressure, no performance. Just a quiet place to think — whenever you need it.
          </p>
          <Button size="lg" asChild className="mt-9 shadow-glow">
            <Link to={appHref}>
              Try the Reflection Companion <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </Reveal>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t">
        <div className="container flex flex-col items-center justify-between gap-4 py-10 text-sm text-muted-foreground sm:flex-row">
          <Logo className="text-foreground" />
          <p>Open-source AI, built for people.</p>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground">
            <GitHubIcon className="h-4 w-4" /> Star on GitHub
          </a>
        </div>
      </footer>
    </div>
  )
}

function BentoCard({
  icon: Icon,
  title,
  body,
  accent,
  children,
}: {
  icon: typeof Brain
  title: string
  body: string
  accent?: boolean
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex h-full flex-col rounded-2xl glass-panel p-7 transition-shadow hover:shadow-lift',
        accent && 'bg-gradient-to-br from-card to-accent/40'
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-5 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      {children}
    </div>
  )
}

const FAQS = [
  {
    q: 'Do I need an OpenAI API key?',
    a: 'Yes — you bring your own key, which means you control your data and your costs. A full reflection session costs about a cent or two on gpt-4o-mini. Voice is free (it runs on your device).',
  },
  {
    q: 'Is my data really private?',
    a: 'Your conversations are tied to your account, and your API key is encrypted before it is ever stored — never kept in plain text. Because the whole project is open source, you can read exactly how it works, or self-host it so nothing leaves infrastructure you control.',
  },
  {
    q: 'Is this a replacement for therapy?',
    a: 'No. It’s a reflection companion, not a therapist or medical advice. It’s here to help you think and feel heard — and if something serious comes up, it will gently point you to real, region-aware help.',
  },
  {
    q: 'What does “open source” get me?',
    a: 'Transparency and freedom. You can inspect every line, contribute improvements, or run your own private copy. Nothing is hidden behind a black box.',
  },
]

function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="glass-panel divide-y rounded-2xl">
      {FAQS.map((f, i) => {
        const isOpen = open === i
        return (
          <div key={f.q}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
              aria-expanded={isOpen}
            >
              <span className="font-medium">{f.q}</span>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </span>
            </button>
            <div
              className={cn(
                'grid px-6 transition-all duration-300',
                isOpen ? 'grid-rows-[1fr] pb-5' : 'grid-rows-[0fr]'
              )}
            >
              <p className="overflow-hidden text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
