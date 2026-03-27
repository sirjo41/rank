import { createClient } from '@supabase/supabase-js';

// Extremely aggressively clean the secret keys to prevent any injected newlines, spaces, or copy-paste artifacts
const cleanEnvVar = (val: any) => {
  if (!val) return '';
  return String(val)
    .trim()
    .replace(/\s+/g, '') // remove all whitespace/newlines
    .replace(/%0A/g, '') // remove URL-encoded newlines if they pasted them literally
    .replace(/\\n/g, ''); // remove literally escaped newlines
};

const supabaseUrl = cleanEnvVar(import.meta.env.VITE_SUPABASE_URL);
const supabaseKey = cleanEnvVar(import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!supabaseUrl || !supabaseKey) {
  console.error('⚠️ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY!');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
