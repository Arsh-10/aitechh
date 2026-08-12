/**
 * Free text-to-speech via the browser's built-in Web Speech API.
 * No API key, no server, works offline. Voice quality depends on the device;
 * we pick the most natural voice available and let the user override it.
 */

export const SPEEDS = [1, 1.25, 1.5, 2] as const
export type Speed = (typeof SPEEDS)[number]

const RATE_KEY = 'aitech.tts.rate'
const VOICE_KEY = 'aitech.tts.voiceURI'

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** getVoices() is populated asynchronously in some browsers — wait for it. */
export function getVoicesAsync(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!ttsSupported()) return resolve([])
    const existing = window.speechSynthesis.getVoices()
    if (existing.length) return resolve(existing)
    let done = false
    const finish = () => {
      if (done) return
      done = true
      resolve(window.speechSynthesis.getVoices())
    }
    window.speechSynthesis.onvoiceschanged = finish
    setTimeout(finish, 1000) // safety net
  })
}

// Most natural free voices first (Chrome / macOS / modern Windows neural).
const PREFERRED = [
  'Google US English',
  'Google UK English Female',
  'Google UK English Male',
  'Samantha',
  'Microsoft Aria Online (Natural) - English (United States)',
  'Microsoft Jenny Online (Natural) - English (United States)',
  'Microsoft Aria',
  'Microsoft Jenny',
  'Microsoft Guy',
  'Microsoft Zira',
]

export function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null
  for (const name of PREFERRED) {
    const v = voices.find((x) => x.name === name)
    if (v) return v
  }
  return voices.find((v) => v.lang?.toLowerCase().startsWith('en')) ?? voices[0]
}

export function resolveVoice(
  voices: SpeechSynthesisVoice[],
  savedURI: string | null
): SpeechSynthesisVoice | null {
  if (savedURI) {
    const match = voices.find((v) => v.voiceURI === savedURI)
    if (match) return match
  }
  return pickBestVoice(voices)
}

export function loadRate(): Speed {
  const r = Number(localStorage.getItem(RATE_KEY))
  return (SPEEDS as readonly number[]).includes(r) ? (r as Speed) : 1
}
export function saveRate(r: Speed): void {
  localStorage.setItem(RATE_KEY, String(r))
}
export function loadVoiceURI(): string | null {
  return localStorage.getItem(VOICE_KEY)
}
export function saveVoiceURI(uri: string): void {
  if (uri) localStorage.setItem(VOICE_KEY, uri)
  else localStorage.removeItem(VOICE_KEY)
}
