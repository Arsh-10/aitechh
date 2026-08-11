import { useState } from 'react'
import { KeyRound, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiSend } from '@/lib/api'

export interface KeyStatus {
  has_key: boolean
  hint?: string | null
}

/** Shared form to save or update the user's OpenAI key with explicit consent. */
export function ApiKeyForm({
  status,
  onChange,
}: {
  status: KeyStatus
  onChange: (s: KeyStatus) => void
}) {
  const [apiKey, setApiKey] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setError(null)
    if (!consent) {
      setError('Please tick the consent box so we can store your key encrypted.')
      return
    }
    setBusy(true)
    try {
      const res = await apiSend<KeyStatus>('/api/keys', 'PUT', {
        api_key: apiKey.trim(),
        consent,
      })
      if (res) onChange(res)
      setApiKey('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save key.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      await apiSend('/api/keys', 'DELETE')
      onChange({ has_key: false })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete key.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {status.has_key && (
        <div className="flex items-center justify-between rounded-md border bg-secondary/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Key on file ending in <span className="font-mono">…{status.hint}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={remove} disabled={busy}>
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="apikey">
          {status.has_key ? 'Replace your OpenAI key' : 'Your OpenAI API key'}
        </Label>
        <Input
          id="apikey"
          type="password"
          placeholder="sk-…"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Get one at platform.openai.com. It is encrypted before storage and used only to
          make requests on your behalf.
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span className="text-muted-foreground">
          I consent to aitech storing my OpenAI key, encrypted, so I don't have to re-enter it.
        </span>
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={save} disabled={busy || apiKey.trim().length < 20} className="w-full">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        {status.has_key ? 'Update key' : 'Save key'}
      </Button>
    </div>
  )
}
