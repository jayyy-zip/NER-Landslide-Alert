import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : undefined)
const supabaseKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) || (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_PUBLISHABLE_KEY : undefined)

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase env vars. Ensure VITE_SUPABASE_URL and ' +
    'VITE_SUPABASE_PUBLISHABLE_KEY are set in .env.local'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey)
