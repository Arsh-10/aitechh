/**
 * TEMPORARY preview route (no auth) to visually QA the v1.1 UI with sample data.
 * Remove this file + its route in App.tsx before shipping.
 */
import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { InsightsView } from './Insights'
import { MoodPicker, type Mood } from '@/components/MoodPicker'
import type { Insights as InsightsData } from '@/lib/api'

const MOCK: InsightsData = {
  total_sessions: 8,
  streak_days: 4,
  avg_mood_delta: 0.75,
  mood_trend: [
    { date: '2026-08-01', score: 2 },
    { date: '2026-08-02', score: 3 },
    { date: '2026-08-04', score: 2 },
    { date: '2026-08-06', score: 4 },
    { date: '2026-08-08', score: 3 },
    { date: '2026-08-10', score: 4 },
    { date: '2026-08-11', score: 5 },
  ],
  top_emotions: [
    { emotion: 'anxious', count: 4 },
    { emotion: 'hopeful', count: 3 },
    { emotion: 'overwhelmed', count: 2 },
    { emotion: 'grateful', count: 1 },
  ],
  themes: ['work stress', 'family', 'sleep', 'self-doubt', 'friendships'],
  recent_takeaways: [
    { date: '2026-08-11', takeaway: 'You realised the deadline isn’t the real fear — letting people down is.' },
    { date: '2026-08-10', takeaway: 'Naming the tightness in your chest as anticipation helped it loosen.' },
    { date: '2026-08-08', takeaway: 'The two okay deadlines were crowding out the one that actually needed you.' },
  ],
  memory_summary:
    'Works in tech, often feels stretched by deadlines and a fear of disappointing others. Values time with family. Sleep suffers when anxious; short walks seem to help.',
}

export default function Preview() {
  const [pre, setPre] = useState<Mood | null>(null)
  const [post, setPost] = useState<Mood | null>(null)
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-accent/40 px-4 py-2 text-center text-xs text-accent-foreground">
        Temporary preview page — sample data, no login required.
      </div>

      {/* Adaptive-mode indicators */}
      <div className="mx-auto max-w-4xl px-4 pt-8">
        <h2 className="mb-4 text-lg font-semibold">Adaptive support modes</h2>
        <div className="flex flex-wrap gap-2">
          {[
            'Sitting with heartbreak',
            'Untangling work stress',
            'Finding some calm',
            'Feeling less alone',
            'Gently, at your pace',
            'Working through conflict',
          ].map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {label}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          The companion detects the situation from your message and shifts its tone, pacing, and
          technique to match — shown as a subtle chip above the chat.
        </p>
      </div>

      {/* Mood UI samples */}
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h2 className="mb-4 text-lg font-semibold">Mood check-in</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-4">
            <p className="mb-3 text-sm font-medium">How are you arriving today?</p>
            <MoodPicker value={pre?.score} onSelect={setPre} size="lg" />
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-accent-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Your takeaway
            </p>
            <p className="mb-4 text-sm">
              You realised the deadline isn’t the real fear — letting people down is.
            </p>
            <p className="mb-3 text-sm font-medium">How are you leaving this session?</p>
            <MoodPicker value={post?.score} onSelect={setPost} size="lg" />
          </div>
        </div>
      </div>

      {/* Dashboard */}
      <InsightsView data={MOCK} loading={false} />
    </div>
  )
}
