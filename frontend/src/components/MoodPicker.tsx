import { cn } from '@/lib/utils'

export interface Mood {
  score: number
  label: string
}

// 1–5 scale, low → high. Emoji + word so it reads instantly.
export const MOODS: Mood[] = [
  { score: 1, label: 'Struggling' },
  { score: 2, label: 'Low' },
  { score: 3, label: 'Okay' },
  { score: 4, label: 'Good' },
  { score: 5, label: 'Great' },
]

const EMOJI: Record<number, string> = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😊' }

export function MoodPicker({
  value,
  onSelect,
  size = 'md',
}: {
  value?: number | null
  onSelect: (m: Mood) => void
  size?: 'md' | 'lg'
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      {MOODS.map((m) => {
        const active = value === m.score
        return (
          <button
            key={m.score}
            type="button"
            onClick={() => onSelect(m)}
            title={m.label}
            aria-label={m.label}
            aria-pressed={active}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl border transition-all',
              size === 'lg' ? 'px-3 py-2.5' : 'px-2.5 py-2',
              active
                ? 'border-primary bg-accent ring-2 ring-primary/40'
                : 'border-border hover:border-primary/50 hover:bg-accent/50'
            )}
          >
            <span className={size === 'lg' ? 'text-2xl' : 'text-xl'}>{EMOJI[m.score]}</span>
            <span className="text-[11px] text-muted-foreground">{m.label}</span>
          </button>
        )
      })}
    </div>
  )
}
