const { createClient } = require('@supabase/supabase-js');

/**
 * Supabase client for database operations
 */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for backend operations
);

module.exports = supabase; 