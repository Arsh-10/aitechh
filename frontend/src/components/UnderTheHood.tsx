import { Braces, FlaskConical, Lock, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { GitHubIcon } from '@/components/icons'
import { REPO, UNDER_THE_HOOD } from '@/lib/underTheHood'

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-secondary/40 px-4 py-3">
      <p className="font-display text-2xl font-medium tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

/**
 * The shared "developer module". Renders the architecture for any mini-app from
 * the UNDER_THE_HOOD registry — drop <UnderTheHood app="<slug>" /> into a page,
 * add the app's entry to the registry, and it just works. No per-app UI.
 */
export function UnderTheHood({ app }: { app: string }) {
  const tech = UNDER_THE_HOOD[app]
  if (!tech) return null
  const metrics = tech.testing?.metrics ?? null

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="How this app is built"
        >
          <Braces className="h-3.5 w-3.5" /> Under the hood
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[86vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2 text-2xl">
            <Sparkles className="h-5 w-5 text-primary" /> How {tech.name} is built
          </DialogTitle>
          <DialogDescription>
            The whole thing is open-source. Here’s the architecture, the choices, and the trade-offs —
            nothing hidden.
          </DialogDescription>
        </DialogHeader>

        {/* Data flow */}
        <section className="mt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data flow</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {tech.dataFlow.map((step, i) => (
              <span key={step} className="flex items-center gap-2">
                <span className="glass-panel rounded-lg px-2.5 py-1">{step}</span>
                {i < tech.dataFlow.length - 1 && <span className="text-muted-foreground">→</span>}
              </span>
            ))}
          </div>
        </section>

        {/* Stack + trade-offs */}
        <section className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            The stack &amp; why
          </h3>
          <div className="mt-3 space-y-3">
            {tech.stack.map((c) => (
              <div key={c.title} className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <c.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {c.title}
                    {c.file && (
                      <a
                        href={`${REPO}/${c.file}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-foreground"
                      >
                        <GitHubIcon className="h-3 w-3" /> source
                      </a>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{c.why}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How we test it — only for apps with a real eval harness */}
        {tech.testing && (
          <section className="mt-6">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <FlaskConical className="h-3.5 w-3.5" /> How we test it
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">{tech.testing.blurb}</p>
            {metrics ? (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {metrics.modeAccuracy != null && (
                  <Metric label="Mode accuracy" value={`${Math.round(metrics.modeAccuracy * 100)}%`} />
                )}
                {metrics.crisisRecall != null && (
                  <Metric label="Crisis recall" value={`${Math.round(metrics.crisisRecall * 100)}%`} />
                )}
                {metrics.crisisPrecision != null && (
                  <Metric label="Crisis precision" value={`${Math.round(metrics.crisisPrecision * 100)}%`} />
                )}
                {metrics.quality != null && <Metric label="Quality (1–5)" value={metrics.quality.toFixed(1)} />}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed px-4 py-3 text-xs text-muted-foreground">
                Run <code className="rounded bg-secondary/60 px-1.5 py-0.5">evals/run_evals.py</code> to populate
                live scores here.
                {tech.testing.harnessFile && (
                  <>
                    {' '}
                    <a
                      href={`${REPO}/${tech.testing.harnessFile}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-foreground underline"
                    >
                      See the harness →
                    </a>
                  </>
                )}
              </p>
            )}
          </section>
        )}

        {/* Privacy */}
        <section className="mt-6 flex items-start gap-3 rounded-xl border bg-secondary/30 p-4">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Privacy by design.</span> {tech.privacy}
          </p>
        </section>

        <a
          href="https://github.com/Arsh-10/aitechh"
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-foreground hover:underline"
        >
          <GitHubIcon className="h-4 w-4" /> Read the full source on GitHub
        </a>
      </DialogContent>
    </Dialog>
  )
}
