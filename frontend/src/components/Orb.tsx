import { cn } from '@/lib/utils'

/**
 * The breathing orb — the brand's signature. A softly pulsing gradient sphere
 * that literally embodies "slow down and breathe". Used in the hero and the
 * chat's empty state.
 */
export function Orb({ className, size = 220 }: { className?: string; size?: number }) {
  return (
    <div
      className={cn('relative', className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* outer glow */}
      <div
        className="animate-breathe absolute inset-0 rounded-full blur-2xl"
        style={{
          background:
            'radial-gradient(circle at 35% 30%, hsl(var(--aurora-1) / 0.9), hsl(var(--aurora-2) / 0.7) 45%, hsl(var(--aurora-3) / 0.6) 80%)',
        }}
      />
      {/* core sphere */}
      <div
        className="animate-breathe absolute inset-[12%] rounded-full"
        style={{
          animationDelay: '-0.4s',
          background:
            'radial-gradient(circle at 34% 28%, #fff 0%, hsl(var(--aurora-1)) 34%, hsl(var(--aurora-2)) 70%, hsl(var(--aurora-3)) 100%)',
          boxShadow: 'inset 0 -18px 40px hsl(258 60% 30% / 0.45), 0 20px 60px -12px hsl(262 83% 60% / 0.55)',
        }}
      />
      {/* soft highlight */}
      <div
        className="absolute left-[24%] top-[20%] h-[22%] w-[22%] rounded-full bg-white/70 blur-md"
      />
    </div>
  )
}
