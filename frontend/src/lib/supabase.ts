import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Surfaced early so setup mistakes are obvious during local dev.
  console.warn(
    '[aitech] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy frontend/.env.example to frontend/.env and fill it in.'
  )
}

export const supabase = createClient(url ?? '', anonKey ?? '')
