/**
 * Full-page, fixed aurora backdrop. Glassmorphism needs colour underneath to
 * refract — this provides it app-wide, softly and theme-aware, sitting behind
 * all content (-z-10). Cheap: three blurred gradient blobs.
 */
export function AuroraBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* base tint so bare areas still feel designed */}
      <div className="absolute inset-0 bg-background" />
      <div
        className="animate-aurora absolute -left-32 -top-40 h-[46rem] w-[46rem] rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle at 30% 30%, hsl(var(--aurora-1) / 0.45), transparent 60%)' }}
      />
      <div
        className="animate-aurora absolute -right-40 top-10 h-[42rem] w-[42rem] rounded-full opacity-35 blur-3xl"
        style={{ animationDelay: '-6s', background: 'radial-gradient(circle at 60% 40%, hsl(var(--aurora-2) / 0.4), transparent 60%)' }}
      />
      <div
        className="animate-aurora absolute bottom-[-16rem] left-1/4 h-[44rem] w-[44rem] rounded-full opacity-35 blur-3xl"
        style={{ animationDelay: '-11s', background: 'radial-gradient(circle at 50% 50%, hsl(var(--aurora-3) / 0.4), transparent 60%)' }}
      />
    </div>
  )
}
