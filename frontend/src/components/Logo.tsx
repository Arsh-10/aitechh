import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-lg font-semibold', className)}>
      <span
        className="flex h-7 w-7 items-center justify-center rounded-lg text-white shadow-soft"
        style={{
          background:
            'linear-gradient(135deg, hsl(var(--aurora-1)), hsl(var(--aurora-2)) 60%, hsl(var(--gold)))',
        }}
      >
        <Sparkles className="h-4 w-4" />
      </span>
      <span className="font-display tracking-tight">
        aitech<span className="text-primary">.</span>
      </span>
    </span>
  )
}
