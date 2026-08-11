interface Point {
  date: string
  score: number
}

/**
 * Minimal, dependency-free mood line chart (scores 1–5 over time).
 * Renders as inline SVG so there's no chart library in the bundle.
 */
export function MoodChart({ points }: { points: Point[] }) {
  if (points.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No mood check-ins yet.
      </div>
    )
  }

  const W = 560
  const H = 160
  const pad = { top: 16, right: 16, bottom: 24, left: 28 }
  const innerW = W - pad.left - pad.right
  const innerH = H - pad.top - pad.bottom

  const n = points.length
  const x = (i: number) => pad.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (score: number) => pad.top + innerH - ((score - 1) / 4) * innerH

  const line = points.map((p, i) => `${x(i)},${y(p.score)}`).join(' ')
  const area = `${pad.left},${pad.top + innerH} ${line} ${x(n - 1)},${pad.top + innerH}`

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full min-w-[420px]" role="img" aria-label="Mood trend">
        <defs>
          <linearGradient id="moodStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--aurora-1))" />
            <stop offset="60%" stopColor="hsl(var(--aurora-2))" />
            <stop offset="100%" stopColor="hsl(var(--gold))" />
          </linearGradient>
          <linearGradient id="moodArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--aurora-1) / 0.25)" />
            <stop offset="100%" stopColor="hsl(var(--aurora-1) / 0)" />
          </linearGradient>
        </defs>
        {/* gridlines for scores 1..5 */}
        {[1, 2, 3, 4, 5].map((s) => (
          <g key={s}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={y(s)}
              y2={y(s)}
              stroke="hsl(var(--border))"
              strokeWidth="1"
            />
            <text x={8} y={y(s) + 4} fontSize="10" fill="hsl(var(--muted-foreground))">
              {s}
            </text>
          </g>
        ))}
        <polygon points={area} fill="url(#moodArea)" />
        <polyline
          points={line}
          fill="none"
          stroke="url(#moodStroke)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.score)} r="4" fill="hsl(var(--card))" stroke="hsl(var(--aurora-2))" strokeWidth="2.5" />
        ))}
      </svg>
    </div>
  )
}
