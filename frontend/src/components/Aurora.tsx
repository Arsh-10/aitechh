/**
 * Signature animated aurora — soft drifting colour fields behind the hero.
 * Pure CSS blobs; cheap and calming.
 */
export function Aurora() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="animate-aurora absolute -left-24 -top-32 h-[42rem] w-[42rem] rounded-full opacity-60 blur-3xl"
        style={{
          background:
            'radial-gradient(circle at 30% 30%, hsl(var(--aurora-1) / 0.55), transparent 60%)',
        }}
      />
      <div
        className="animate-aurora absolute -right-24 top-0 h-[38rem] w-[38rem] rounded-full opacity-55 blur-3xl"
        style={{
          animationDelay: '-6s',
          background:
            'radial-gradient(circle at 60% 40%, hsl(var(--aurora-2) / 0.5), transparent 60%)',
        }}
      />
      <div
        className="animate-aurora absolute bottom-[-12rem] left-1/3 h-[36rem] w-[36rem] rounded-full opacity-50 blur-3xl"
        style={{
          animationDelay: '-11s',
          background:
            'radial-gradient(circle at 50% 50%, hsl(var(--aurora-3) / 0.5), transparent 60%)',
        }}
      />
    </div>
  )
}
