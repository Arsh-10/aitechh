import type { LucideIcon } from 'lucide-react'
import {
  Braces,
  CalendarPlus,
  Cpu,
  Database,
  Gauge,
  Layers,
  MessageCircle,
  Mic,
  Repeat,
  Scale,
  Search,
  ShieldCheck,
} from 'lucide-react'

/**
 * The "Under the hood" developer module is data-driven: every mini-app declares
 * its architecture here, and the shared <UnderTheHood app="..."/> component
 * renders it. Adding the panel to a new app is a single entry below — no new UI.
 *
 * Keep it HONEST: describe what each app actually does today, not the roadmap.
 */

export const REPO = 'https://github.com/Arsh-10/aitechh/blob/main'

export type StackChoice = { icon: LucideIcon; title: string; why: string; file?: string }

export type EvalMetrics = {
  model: string
  modeAccuracy?: number
  crisisRecall?: number
  crisisPrecision?: number
  quality?: number
}

export type AppTech = {
  name: string
  dataFlow: string[]
  stack: StackChoice[]
  /** Present only for apps with a real eval harness. metrics=null → "run pending". */
  testing?: { blurb: string; harnessFile?: string; metrics: EvalMetrics | null }
  privacy: string
}

const PRIVACY_BYO =
  'You bring your own key, data stays in your own Supabase (self-hostable), and nothing is sold or used to train a model.'

const PUBLIC_UNDER_THE_HOOD: Record<string, AppTech> = {
  'emotional-support': {
    name: 'Reflection Companion',
    dataFlow: [
      'Your browser (SSE)',
      'FastAPI',
      'Your OpenAI key — or your own model',
      'Supabase: history + pgvector memory',
    ],
    stack: [
      {
        icon: Braces,
        title: 'Strict structured outputs',
        why: 'The mode classifier and session wrap use JSON-schema structured outputs (Pydantic), guaranteed-valid, with a json fallback for models that don’t support it.',
        file: 'backend/app/llm.py',
      },
      {
        icon: ShieldCheck,
        title: 'Two-signal safety',
        why: 'Crisis detection combines the moderation endpoint with an LLM classifier and fires if either flags — recall-first, because missing a crisis is the costly error. Helplines are appended deterministically.',
        file: 'backend/app/routers/chat.py',
      },
      {
        icon: Database,
        title: 'pgvector cross-session memory',
        why: 'After each session it extracts small, embedded memories and retrieves the few most relevant ones per message — it recalls the right thing, not a generic profile.',
        file: 'backend/app/memory.py',
      },
      {
        icon: Cpu,
        title: 'Provider-agnostic model layer',
        why: 'One base-URL switch runs it on OpenAI or any OpenAI-compatible endpoint (Ollama, LM Studio, vLLM).',
        file: 'backend/app/config.py',
      },
      {
        icon: Gauge,
        title: 'Tracing + cheap-model routing',
        why: 'Every call logs model, tokens, latency and est. cost. Utility work (classify, wrap) runs on a cheaper model than the reply.',
        file: 'backend/app/llm.py',
      },
      {
        icon: Layers,
        title: 'SSE streaming',
        why: 'Server-Sent Events, not WebSockets — one-way token streaming is simpler and proxy-friendly.',
        file: 'backend/app/routers/chat.py',
      },
    ],
    testing: {
      blurb:
        'An eval harness scores mode accuracy, crisis recall & precision (on a fixed labeled set), and reflection quality (LLM-judged, 1–5). Most emotional-AI tools ship none of this. Latest run:',
      harnessFile: 'backend/evals/run_evals.py',
      metrics: {
        model: 'gpt-4o-mini',
        modeAccuracy: 1.0,
        crisisRecall: 1.0,
        crisisPrecision: 1.0,
        quality: 4.75,
      },
    },
    privacy: PRIVACY_BYO,
  },

  decision: {
    name: 'Decision Assistant',
    dataFlow: ['Your browser (SSE)', 'FastAPI', 'Your OpenAI key — or your own model', 'Supabase: decisions'],
    stack: [
      {
        icon: Braces,
        title: 'A structured decision card',
        why: 'The wrap turns the conversation into a structured JSON card — options, criteria, leaning, rationale, key risk, and a confidence score.',
        file: 'backend/app/routers/decisions.py',
      },
      {
        icon: Scale,
        title: 'Coaching, not answering',
        why: 'The prompt is tuned to help you think — surfacing trade-offs and your own criteria — rather than deciding for you.',
        file: 'backend/app/routers/decisions.py',
      },
      {
        icon: Repeat,
        title: 'A revisit loop',
        why: 'You can record the real outcome later, turning each card into honest feedback on how your decisions actually played out.',
        file: 'backend/app/routers/decisions.py',
      },
      {
        icon: Cpu,
        title: 'Provider-agnostic + streamed',
        why: 'Runs on your key or a local model; the coach streams over SSE.',
        file: 'backend/app/config.py',
      },
    ],
    privacy: PRIVACY_BYO,
  },

  study: {
    name: 'Study Companion',
    dataFlow: ['Your browser (SSE)', 'FastAPI', 'Your OpenAI key — or your own model', 'Supabase: decks + cards'],
    stack: [
      {
        icon: Repeat,
        title: 'SM-2 spaced repetition',
        why: 'Reviews are scheduled by a pure, testable SM-2 implementation — grade a card and it computes the next interval and ease factor.',
        file: 'backend/app/routers/study.py',
      },
      {
        icon: Braces,
        title: 'Atomic card generation',
        why: 'Your material becomes active-recall cards via a structured generation prompt (question / answer / explanation).',
        file: 'backend/app/routers/study.py',
      },
      {
        icon: Search,
        title: 'A grounded tutor',
        why: 'The tutor answers grounded in your deck’s material (context injection), not the open web — far fewer hallucinations.',
        file: 'backend/app/routers/study.py',
      },
      {
        icon: Cpu,
        title: 'Provider-agnostic + streamed',
        why: 'Runs on your key or a local model; the tutor streams over SSE.',
        file: 'backend/app/config.py',
      },
    ],
    privacy: PRIVACY_BYO,
  },

  contract: {
    name: 'Contract Explainer',
    dataFlow: ['Your browser', 'FastAPI', 'Your OpenAI key — or your own model', 'Supabase: documents'],
    stack: [
      {
        icon: Braces,
        title: 'Structured analysis',
        why: 'Produces a structured breakdown — plain-English summary, key points, red-flag clauses with reasons, and questions to ask — as JSON.',
        file: 'backend/app/routers/contracts.py',
      },
      {
        icon: Search,
        title: 'Grounded in your text',
        why: 'Both the analysis and the follow-up chat are grounded strictly in the document you paste (context injection), capped to stay faithful.',
        file: 'backend/app/routers/contracts.py',
      },
      {
        icon: ShieldCheck,
        title: 'Not legal advice, by design',
        why: 'The prompt is constrained to explain, never to advise, with a clear "not legal advice" guardrail surfaced in the UI.',
        file: 'backend/app/routers/contracts.py',
      },
      {
        icon: MessageCircle,
        title: 'Provider-agnostic + streamed',
        why: 'Runs on your key or a local model; the doc chat streams over SSE.',
        file: 'backend/app/config.py',
      },
    ],
    privacy:
      'You bring your own key, the document lives in your own Supabase (self-hostable), and nothing is sold or used to train a model.',
  },

  'meeting-to-action': {
    name: 'Meeting → Action',
    dataFlow: ['Voice or paste (on-device)', 'FastAPI', 'Your key — or your own model', 'Supabase: meetings'],
    stack: [
      {
        icon: Mic,
        title: 'On-device dictation (free)',
        why: "Voice input uses the browser's Web Speech API — on-device, zero transcription bill. Bring your key for server-side Whisper if you'd rather.",
        file: 'frontend/src/pages/MeetingToAction.tsx',
      },
      {
        icon: Braces,
        title: 'Structured extraction',
        why: 'Action items (owner / due / priority), decisions and open questions come out as JSON-schema structured output — guaranteed-valid.',
        file: 'backend/app/routers/meetings.py',
      },
      {
        icon: Layers,
        title: 'Map-reduce for long transcripts',
        why: 'Long meetings are chunked, extracted in parallel, then merged and de-duplicated — hour-long transcripts work, not just short ones.',
        file: 'backend/app/routers/meetings.py',
      },
      {
        icon: CalendarPlus,
        title: 'Calendar export, not our reminders',
        why: 'Dated actions export as a .ics file your own calendar reminds you from — free and private. We never build a notification service or store your contacts.',
        file: 'backend/app/routers/meetings.py',
      },
      {
        icon: Cpu,
        title: 'Provider-agnostic + streamed',
        why: 'Runs on your key or a local model; the follow-up chat streams over SSE.',
        file: 'backend/app/config.py',
      },
    ],
    privacy:
      'You bring your own key, meetings live in your own Supabase, dictation happens on-device, and nothing is sold or used to train a model.',
  },

}

// Merge Under-the-hood entries from the private overlay (absent in the open
// repo, so this resolves to an empty object there).
const privateModules = import.meta.glob<{ underTheHood?: Record<string, AppTech> }>(
  '../private/registryData.ts',
  { eager: true }
)
const PRIVATE_UNDER_THE_HOOD: Record<string, AppTech> = Object.assign(
  {},
  ...Object.values(privateModules).map((m) => m?.underTheHood ?? {})
)

export const UNDER_THE_HOOD: Record<string, AppTech> = {
  ...PUBLIC_UNDER_THE_HOOD,
  ...PRIVATE_UNDER_THE_HOOD,
}
