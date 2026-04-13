const { createClient } = require('@supabase/supabase-js');

const requiredSupabaseVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingSupabaseVars = requiredSupabaseVars.filter((key) => !process.env[key]);

if (missingSupabaseVars.length > 0) {
  throw new Error(
    `Supabase configuration missing: ${missingSupabaseVars.join(', ')}. ` +
    'Set these variables in the deployment environment (Railway service Variables).'
  );
}

/**
 * Supabase client using service role key (server-side only).
 * This bypasses RLS — only use in the backend API, never in the frontend.
 */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

module.exports = { supabase };
