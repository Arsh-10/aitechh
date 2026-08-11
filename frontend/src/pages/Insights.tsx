import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Brain, Flame, MessageCircle, Sparkles, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MoodChart } from '@/components/MoodChart'
import { Orb } from '@/components/Orb'
import { getInsights, type Insights as InsightsData } from '@/lib/api'

const EMOTION_EMOJI: Record<string, string> = {
  anxious: '😰', sad: '😢', hopeful: '🌱', angry: '😠', calm: '😌',
  overwhelmed: '🌊', lonely: '🍂', grateful: '🙏', happy: '😊', tired: '😴',
  stressed: '😖', hurt: '💔', confused: '😕', content: '🙂',
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Flame
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-soft"
          style={{
            background:
              'linear-gradient(135deg, hsl(var(--aurora-1)), hsl(var(--aurora-2)) 70%, hsl(var(--gold)))',
          }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="font-display text-3xl font-medium leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function Insights() {
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getInsights()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  return <InsightsView data={data} loading={loading} />
}

// Presentational — takes data as props so it can be previewed/tested in isolation.
export function InsightsView({
  data,
  loading,
}: {
  data: InsightsData | null
  loading: boolean
}) {
  const delta = data?.avg_mood_delta
  const deltaText =
    delta == null ? '—' : delta > 0 ? `+${delta}` : `${delta}`
  const deltaHint =
    delta == null
      ? 'complete a session'
      : delta > 0
        ? 'you tend to leave feeling better'
        : delta === 0
          ? 'steady across sessions'
          : 'sessions dip a little'

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Link
            to="/app/emotional-support"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to chat
          </Link>
          <h1 className="font-display text-xl font-medium">Your insights</h1>
          <span className="w-24" />
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        {loading ? (
          <p className="py-20 text-center text-muted-foreground">Loading your insights…</p>
        ) : !data || data.total_sessions === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 flex justify-center">
              <Orb size={110} />
            </div>
            <h2 className="font-display text-2xl font-medium">Nothing to show yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
              Have a reflection or two, and this page will start showing your mood over time,
              recurring themes, and what you take away.
            </p>
            <Link
              to="/app/emotional-support"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Start a reflection <ArrowLeft className="h-4 w-4 rotate-180" />
            </Link>
          </div>
        ) : (
          <>
            {/* Stat tiles */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat icon={Flame} label="Day streak" value={String(data.streak_days)} />
              <Stat icon={MessageCircle} label="Reflections" value={String(data.total_sessions)} />
              <Stat icon={TrendingUp} label="Avg mood shift" value={deltaText} hint={deltaHint} />
            </div>

            {/* Mood trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-primary" /> Mood over time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MoodChart points={data.mood_trend} />
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Emotions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">How you've felt</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.top_emotions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Emotions will appear as you finish sessions.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {data.top_emotions.map((e) => (
                        <div key={e.emotion} className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-sm capitalize">
                            <span>{EMOTION_EMOJI[e.emotion] ?? '•'}</span>
                            {e.emotion}
                          </span>
                          <span className="text-sm text-muted-foreground">×{e.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Themes */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Brain className="h-4 w-4 text-primary" /> Recurring themes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.themes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No themes yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {data.themes.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border bg-secondary/40 px-2.5 py-1 text-xs capitalize text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Takeaways */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" /> Recent takeaways
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.recent_takeaways.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Finish a session with “End &amp; reflect” to capture a takeaway.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {data.recent_takeaways.map((t, i) => (
                      <li key={i} className="flex gap-3 border-l-2 border-primary/40 pl-3">
                        <div>
                          <p className="text-sm">{t.takeaway}</p>
                          <p className="text-xs text-muted-foreground">{t.date}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
