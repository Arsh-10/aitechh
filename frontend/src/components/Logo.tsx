import { cn } from '@/lib/utils'
import { AitechMark } from '@/components/AitechMark'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-lg font-semibold', className)}>
      {/* the brand mark — "Aperture": a lens holding a spark. Ink on light, pearl on dark. */}
      <AitechMark className="h-7 w-7 text-foreground" />
      <span className="font-display tracking-tight">
        aitech<span className="text-primary">.</span>
      </span>
    </span>
  )
}
