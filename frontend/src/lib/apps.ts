import type { LucideIcon } from 'lucide-react'
import { HeartHandshake, MapPin, GraduationCap, Scale } from 'lucide-react'

export interface MiniApp {
  slug: string
  name: string
  tagline: string
  icon: LucideIcon
  path: string | null
  status: 'live' | 'soon'
}

// Add one mini-app here each week as it ships.
export const MINI_APPS: MiniApp[] = [
  {
    slug: 'emotional-support',
    name: 'Reflection Companion',
    tagline: 'A private, judgement-free space to slow down and reflect.',
    icon: HeartHandshake,
    path: '/app/emotional-support',
    status: 'live',
  },
  {
    slug: 'experience-finder',
    name: 'Experience Finder',
    tagline: 'Plans your day around who you are, not a generic top-10 list.',
    icon: MapPin,
    path: null,
    status: 'soon',
  },
  {
    slug: 'study-companion',
    name: 'Study Companion',
    tagline: 'Turn any material into a tutor, quizzes and spaced repetition.',
    icon: GraduationCap,
    path: '/app/study',
    status: 'live',
  },
  {
    slug: 'decision-ai',
    name: 'Decision Assistant',
    tagline: 'Think through hard choices with a structured process.',
    icon: Scale,
    path: '/app/decision',
    status: 'live',
  },
]
