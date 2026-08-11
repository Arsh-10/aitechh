import { useEffect, useState } from 'react'
import { Brain, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clearMemory, getMemory, type Memory } from '@/lib/api'

/**
 * Shows what the companion remembers about the user and lets them wipe it.
 * Central to the privacy promise: your data is yours, and visible.
 */
export function MemorySection({ open }: { open: boolean }) {
  const [memory, setMemory] = useState<Memory | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getMemory()
      .then(setMemory)
      .catch(() => setMemory({ summary: '', themes: [], updated_at: null }))
      .finally(() => setLoading(false))
  }, [open])

  const wipe = async () => {
    setBusy(true)
    try {
      await clearMemory()
      setMemory({ summary: '', themes: [], updated_at: null })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">What aitech remembers about you</h3>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : memory && (memory.summary || memory.themes.length) ? (
        <div className="space-y-3">
          {memory.summary && (
            <p className="rounded-md border bg-secondary/40 p-3 text-sm text-muted-foreground">
              {memory.summary}
            </p>
          )}
          {memory.themes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {memory.themes.map((t) => (
                <span key={t} className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={wipe} disabled={busy}>
            <Trash2 className="h-4 w-4" /> Forget everything about me
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nothing yet. As you reflect, aitech builds a private picture of what matters to you —
          so it remembers across sessions. You can clear it any time.
        </p>
      )}
    </div>
  )
}
