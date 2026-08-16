import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/** Return a valid access token, refreshing it first if it's expired/near-expiry. */
async function authHeader(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return {}
  let token = session.access_token
  const expiresAt = (session.expires_at ?? 0) * 1000
  if (expiresAt && expiresAt - Date.now() < 60_000) {
    // Token expired or about to — refresh proactively.
    const { data } = await supabase.auth.refreshSession()
    token = data.session?.access_token ?? token
  }
  return token ? { Authorization: `Bearer ${token}` } : {}
}

let redirecting = false
/** On an auth failure, sign out and send the user to login (not the key-gate). */
async function handleUnauthorized() {
  if (redirecting) return
  redirecting = true
  try {
    await supabase.auth.signOut()
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.assign('/login')
  }
}

async function fail(res: Response): Promise<never> {
  if (res.status === 401) await handleUnauthorized()
  const detail = (await res.json().catch(() => ({}))).detail ?? res.statusText
  throw new Error(detail)
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { ...(await authHeader()) },
  })
  if (!res.ok) return fail(res)
  return res.json()
}

export async function apiSend<T>(
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: unknown
): Promise<T | null> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) return fail(res)
  if (res.status === 204) return null
  return res.json()
}

/**
 * Stream a chat reply via Server-Sent Events.
 * onEvent receives parsed frames: {conversation_id} | {delta} | {error} | {done}.
 */
export async function streamChat(
  body: { message: string; conversation_id?: string | null },
  onEvent: (e: {
    conversation_id?: string
    mode?: string
    mode_label?: string
    delta?: string
    error?: string
    done?: boolean
  }) => void
): Promise<void> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) {
    if (res.status === 401) await handleUnauthorized()
    throw new Error((await res.json().catch(() => ({}))).detail ?? res.statusText)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data:')) continue
      try {
        onEvent(JSON.parse(line.slice(5).trim()))
      } catch {
        // ignore malformed frame
      }
    }
  }
}

// ── v1.1: mood, memory, insights ──────────────────────────────
export interface Insights {
  total_sessions: number
  streak_days: number
  mood_trend: { date: string; score: number }[]
  avg_mood_delta: number | null
  top_emotions: { emotion: string; count: number }[]
  themes: string[]
  recent_takeaways: { date: string; takeaway: string }[]
  memory_summary: string
}

export interface Memory {
  summary: string
  themes: string[]
  updated_at: string | null
}

export const saveMood = (body: {
  conversation_id?: string | null
  phase: 'pre' | 'post'
  score: number
  label?: string
}) => apiSend('/api/mood', 'POST', body)

export const wrapSession = (conversationId: string) =>
  apiSend<{ takeaway: string | null; primary_emotion: string | null }>(
    `/api/chat/wrap/${conversationId}`,
    'POST'
  )

export const getInsights = () => apiGet<Insights>('/api/insights')
export const getMemory = () => apiGet<Memory>('/api/memory')
export const clearMemory = () => apiSend('/api/memory', 'DELETE')

// ── Decision Assistant ────────────────────────────────────────
export interface DecisionCard {
  title: string
  options: string[]
  criteria: string[]
  leaning: string
  rationale: string
  key_risk: string
  confidence: number
}
export interface Decision {
  id: string
  conversation_id: string | null
  title: string
  card: DecisionCard | null
  outcome: string | null
  outcome_rating: number | null
  created_at: string
  revisited_at: string | null
}

export const listDecisions = () => apiGet<Decision[]>('/api/decisions')
export const getDecision = (id: string) =>
  apiGet<{ decision: Decision; messages: { role: 'user' | 'assistant'; content: string }[] }>(
    `/api/decisions/${id}`
  )
export const wrapDecision = (conversationId: string) =>
  apiSend<{ id: string; title: string; card: DecisionCard }>(
    `/api/decisions/wrap/${conversationId}`,
    'POST'
  )
export const recordOutcome = (id: string, body: { outcome: string; rating?: number }) =>
  apiSend(`/api/decisions/${id}/outcome`, 'POST', body)
export const deleteDecision = (id: string) => apiSend(`/api/decisions/${id}`, 'DELETE')

/** Stream the decision coach reply (same SSE shape as chat). */
export async function streamDecisionChat(
  body: { message: string; conversation_id?: string | null },
  onEvent: (e: { conversation_id?: string; delta?: string; error?: string; done?: boolean }) => void
): Promise<void> {
  const res = await fetch(`${API_URL}/api/decisions/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) {
    if (res.status === 401) await handleUnauthorized()
    throw new Error((await res.json().catch(() => ({}))).detail ?? res.statusText)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data:')) continue
      try {
        onEvent(JSON.parse(line.slice(5).trim()))
      } catch {
        /* ignore malformed frame */
      }
    }
  }
}

// ── Study Companion ───────────────────────────────────────────
export interface StudyDeck {
  id: string
  title: string
  created_at: string
  card_count?: number
  due_count?: number
  source_text?: string
}
export interface StudyCard {
  id: string
  question: string
  answer: string
  explanation: string | null
  interval_days: number
  reps: number
  due_at: string
}
export type Grade = 'again' | 'hard' | 'good' | 'easy'

export const generateDeck = (body: { material: string; title?: string; count?: number }) =>
  apiSend<{ deck: StudyDeck; count: number }>('/api/study/generate', 'POST', body)
export const listDecks = () => apiGet<StudyDeck[]>('/api/study/decks')
export const getDeck = (id: string) =>
  apiGet<{ deck: StudyDeck; cards: StudyCard[] }>(`/api/study/decks/${id}`)
export const dueCards = (deckId: string) => apiGet<StudyCard[]>(`/api/study/decks/${deckId}/due`)
export const reviewCard = (cardId: string, grade: Grade) =>
  apiSend<{ ok: boolean; due_at: string; interval_days: number }>(
    `/api/study/cards/${cardId}/review`,
    'POST',
    { grade }
  )
export const deleteDeck = (id: string) => apiSend(`/api/study/decks/${id}`, 'DELETE')

/** Stream the study tutor reply (grounded in the deck's material). */
export async function streamStudyTutor(
  body: { message: string; conversation_id?: string | null; deck_id?: string | null },
  onEvent: (e: { conversation_id?: string; delta?: string; error?: string; done?: boolean }) => void
): Promise<void> {
  const res = await fetch(`${API_URL}/api/study/tutor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) {
    if (res.status === 401) await handleUnauthorized()
    throw new Error((await res.json().catch(() => ({}))).detail ?? res.statusText)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data:')) continue
      try {
        onEvent(JSON.parse(line.slice(5).trim()))
      } catch {
        /* ignore */
      }
    }
  }
}

// ── Contract / Document Explainer ─────────────────────────────
export interface ContractAnalysis {
  title: string
  summary: string
  key_points: string[]
  red_flags: { clause: string; why: string }[]
  questions: string[]
}
export interface ContractDoc {
  id: string
  title: string
  data: ContractAnalysis | null
  created_at: string
  conversation_id: string | null
}

export const analyzeContract = (body: { text: string; title?: string }) =>
  apiSend<{ id: string; title: string; analysis: ContractAnalysis }>(
    '/api/contracts/analyze',
    'POST',
    body
  )
export const listContracts = () => apiGet<ContractDoc[]>('/api/contracts')
export const getContract = (id: string) =>
  apiGet<{ document: ContractDoc & { source_text?: string }; messages: { role: 'user' | 'assistant'; content: string }[] }>(
    `/api/contracts/${id}`
  )
export const deleteContract = (id: string) => apiSend(`/api/contracts/${id}`, 'DELETE')

export async function streamContractChat(
  body: { message: string; conversation_id?: string | null; document_id?: string | null },
  onEvent: (e: { conversation_id?: string; delta?: string; error?: string; done?: boolean }) => void
): Promise<void> {
  const res = await fetch(`${API_URL}/api/contracts/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) {
    if (res.status === 401) await handleUnauthorized()
    throw new Error((await res.json().catch(() => ({}))).detail ?? res.statusText)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data:')) continue
      try {
        onEvent(JSON.parse(line.slice(5).trim()))
      } catch {
        /* ignore */
      }
    }
  }
}

export { API_URL }
