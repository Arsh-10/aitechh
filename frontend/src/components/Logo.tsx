import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-lg font-semibold', className)}>
      {/* the brand "ball" — a small mono orb, silver on light / pearl on dark */}
      <span
        className="h-7 w-7 rounded-full shadow-soft ring-1 ring-black/5 dark:ring-white/10"
        style={{
          background:
            'radial-gradient(circle at 34% 30%, #fff 0%, hsl(var(--aurora-1)) 46%, hsl(var(--aurora-3)) 100%)',
        }}
        aria-hidden="true"
      />
      <span className="font-display tracking-tight">
        aitech<span className="text-primary">.</span>
      </span>
    </span>
  )
}
