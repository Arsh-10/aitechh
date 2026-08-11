import { useEffect, useState } from 'react'
import { Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getVoicesAsync,
  loadVoiceURI,
  pickBestVoice,
  saveVoiceURI,
  ttsSupported,
} from '@/lib/tts'

/** Lets the user choose which free device voice to use for read-aloud. */
export function VoiceSettings({ open }: { open: boolean }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selected, setSelected] = useState<string>('')

  useEffect(() => {
    if (!open || !ttsSupported()) return
    getVoicesAsync().then((v) => {
      setVoices(v)
      setSelected(loadVoiceURI() ?? '')
    })
  }, [open])

  if (!ttsSupported()) {
    return (
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Voice</h3>
        <p className="text-sm text-muted-foreground">
          This browser doesn't support built-in speech. Read-aloud won't be available.
        </p>
      </div>
    )
  }

  // English voices first; keep the list readable.
  const english = voices.filter((v) => v.lang?.toLowerCase().startsWith('en'))
  const list = english.length ? english : voices
  const best = pickBestVoice(voices)

  const preview = () => {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance("Hi, I'm here with you. This is how I sound.")
    const chosen = selected ? voices.find((v) => v.voiceURI === selected) : best
    if (chosen) u.voice = chosen
    window.speechSynthesis.speak(u)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">Voice (free, on-device)</h3>
      </div>
      <div className="flex gap-2">
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value)
            saveVoiceURI(e.target.value)
          }}
          className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Auto — best available{best ? ` (${best.name})` : ''}</option>
          {list.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={preview} type="button">
          Preview
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Uses your device's built-in voices — free, private, no API cost. Quality varies by
        device; on Chrome the “Google” voices sound most natural.
      </p>
    </div>
  )
}
