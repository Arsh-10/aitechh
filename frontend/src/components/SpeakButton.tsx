import { useEffect, useRef, useState } from 'react'
import { Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SPEEDS,
  type Speed,
  getVoicesAsync,
  loadRate,
  loadVoiceURI,
  resolveVoice,
  saveRate,
  ttsSupported,
} from '@/lib/tts'

/**
 * Read-aloud, ChatGPT-style, using the FREE browser Web Speech API.
 * Speaker button + a speed toggle (1x / 1.25x / 1.5x / 2x). No API cost.
 */
export function SpeakButton({ text, className }: { text: string; className?: string }) {
  const [speaking, setSpeaking] = useState(false)
  const [rate, setRate] = useState<Speed>(() => (ttsSupported() ? loadRate() : 1))
  const resumeTimer = useRef<number | null>(null)

  const stop = () => {
    if (resumeTimer.current) {
      clearInterval(resumeTimer.current)
      resumeTimer.current = null
    }
    if (ttsSupported()) window.speechSynthesis.cancel()
    setSpeaking(false)
  }

  // Stop speech if the component unmounts (e.g. navigating away).
  useEffect(() => stop, [])

  const speak = async (r: Speed) => {
    if (!ttsSupported()) return
    window.speechSynthesis.cancel() // stop any other message that's talking
    const voices = await getVoicesAsync()
    const voice = resolveVoice(voices, loadVoiceURI())
    const u = new SpeechSynthesisUtterance(text)
    if (voice) u.voice = voice
    u.rate = r
    u.pitch = 1
    u.onend = stop
    u.onerror = stop
    setSpeaking(true)
    window.speechSynthesis.speak(u)
    // Chrome stops long utterances after ~15s; keep it alive.
    resumeTimer.current = window.setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        if (resumeTimer.current) clearInterval(resumeTimer.current)
        resumeTimer.current = null
      } else {
        window.speechSynthesis.pause()
        window.speechSynthesis.resume()
      }
    }, 12000)
  }

  const toggle = () => (speaking ? stop() : speak(rate))

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length]
    setRate(next)
    saveRate(next)
    if (speaking) {
      stop()
      // restart at the new speed (Web Speech can't change rate mid-utterance)
      speak(next)
    }
  }

  if (!ttsSupported()) return null

  return (
    <div className={cn('inline-flex items-center gap-0.5', className)}>
      <button
        type="button"
        onClick={toggle}
        title={speaking ? 'Stop' : 'Read aloud'}
        aria-label={speaking ? 'Stop reading' : 'Read aloud'}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Volume2 className={cn('h-4 w-4', speaking && 'animate-pulse text-primary')} />
      </button>
      <button
        type="button"
        onClick={cycleSpeed}
        title="Playback speed"
        aria-label={`Playback speed ${rate}x`}
        className="inline-flex h-7 min-w-[2.25rem] items-center justify-center rounded-md px-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {rate}x
      </button>
    </div>
  )
}
