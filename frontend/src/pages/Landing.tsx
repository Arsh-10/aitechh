import { Link } from 'react-router-dom'
import { ArrowRight, KeyRound, Lock, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { GitHubIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MINI_APPS } from '@/lib/apps'
import { useAuth } from '@/context/AuthContext'

const GITHUB_URL = 'https://github.com/Arshman-7/aitech'

export default function Landing() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                <GitHubIcon className="h-4 w-4" /> GitHub
              </a>
            </Button>
            {user ? (
              <Button size="sm" asChild>
                <Link to="/app/emotional-support">Open app</Link>
              </Button>
            ) : (
              <Button size="sm" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container py-20 text-center md:py-28">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border bg-accent px-4 py-1.5 text-sm text-accent-foreground">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Open-source · bring your own OpenAI key
        </div>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          Small AI tools that
          <span className="text-primary"> contribute to people</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          aitech is a growing collection of open-source AI mini-apps. Each one is built to
          help with something real. You run them with your own API key — your data and costs
          stay yours.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link to="/app/emotional-support">
              Try Reflection Companion <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              <GitHubIcon className="h-4 w-4" /> View the code
            </a>
          </Button>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y bg-secondary/40">
        <div className="container grid gap-6 py-10 sm:grid-cols-3">
          {[
            { icon: KeyRound, title: 'Your API key', body: 'Bring your own OpenAI key. You control usage and cost.' },
            { icon: Lock, title: 'Encrypted at rest', body: 'Your key is encrypted before it is ever stored.' },
            { icon: ShieldCheck, title: 'Fully open source', body: 'Every line is public. Read it, run it, improve it.' },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background text-primary shadow-sm">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Mini-apps */}
      <section className="container py-20">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight">The mini-apps</h2>
          <p className="mt-3 text-muted-foreground">A new one ships roughly every week.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {MINI_APPS.map((app) => {
            const Icon = app.icon
            const card = (
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <CardTitle className="flex items-center gap-2">
                    {app.name}
                    {app.status === 'soon' && (
                      <span className="rounded-full border px-2 py-0.5 text-xs font-normal text-muted-foreground">
                        soon
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>{app.tagline}</CardDescription>
                </CardHeader>
                {app.status === 'live' && (
                  <CardContent>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                      Open <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </CardContent>
                )}
              </Card>
            )
            return app.path ? (
              <Link key={app.slug} to={app.path}>
                {card}
              </Link>
            ) : (
              <div key={app.slug} className="cursor-default opacity-70">
                {card}
              </div>
            )
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="container flex flex-col items-center justify-between gap-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <Logo className="text-foreground" />
          <p>Open-source AI, built for people. Not affiliated with any employer.</p>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
            <GitHubIcon className="h-4 w-4" /> Star on GitHub
          </a>
        </div>
      </footer>
    </div>
  )
}
