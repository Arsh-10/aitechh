import { useEffect, useRef, useState } from 'react'
import { Loader2, Volume2, VolumeX } from 'lucide-react'
import { fetchTTS } from '@/lib/api'
import { cn } from '@/lib/utils'

type State = 'idle' | 'loading' | 'playing'

/**
 * Read-aloud button for a reply, ChatGPT-style.
 * Primary path: high-quality OpenAI TTS (uses the user's own key).
 * Fallback: the browser's free built-in speech synthesis, if TTS fails
 * (e.g. the key has no TTS access) or the request errors.
 */
export function SpeakButton({ text, className }: { text: string; className?: string }) {
  const [state, setState] = useState<State>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  const cleanup = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }

  // Stop audio if the component unmounts mid-playback.
  useEffect(() => cleanup, [])

  const speakWithBrowser = () => {
    if (!('speechSynthesis' in window)) {
      setState('idle')
      return
    }
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.98
    u.pitch = 1
    u.onend = () => setState('idle')
    u.onerror = () => setState('idle')
    setState('playing')
    window.speechSynthesis.speak(u)
  }

  const toggle = async () => {
    if (state !== 'idle') {
      cleanup()
      setState('idle')
      return
    }
    setState('loading')
    try {
      const url = await fetchTTS(text)
      urlRef.current = url
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        cleanup()
        setState('idle')
      }
      audio.onerror = () => {
        cleanup()
        speakWithBrowser()
      }
      await audio.play()
      setState('playing')
    } catch {
      // OpenAI TTS unavailable (e.g. key without audio access) → free fallback.
      speakWithBrowser()
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={state === 'playing' ? 'Stop' : 'Read aloud'}
      aria-label={state === 'playing' ? 'Stop reading' : 'Read aloud'}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        className
      )}
    >
      {state === 'loading' ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : state === 'playing' ? (
        <VolumeX className="h-4 w-4" />
      ) : (
        <Volume2 className="h-4 w-4" />
      )}
    </button>
  )
}
