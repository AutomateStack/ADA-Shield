const { createClient } = require('@supabase/supabase-js');

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
