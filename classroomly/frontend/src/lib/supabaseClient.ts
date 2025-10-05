import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!;

console.log('SUPABASE URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('SUPABASE ANON KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Create client with service role key for authenticated operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Function to get authenticated client (returns service role client)
export const getAuthenticatedSupabase = (token?: string) => {
  // Always use service role key for authenticated operations
  // The custom JWT token is not compatible with Supabase's JWT format
  return supabase;
};

// Function to set authentication session with custom JWT
export const setSupabaseAuth = async (token: string) => {
  try {
    // Set the session with your custom JWT token
    const { data, error } = await supabase.auth.setSession({
      access_token: token,
      refresh_token: token, // You might need to handle refresh tokens differently
    });
    
    if (error) {
      console.error('Error setting Supabase auth session:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error setting Supabase auth session:', error);
    return false;
  }
};

// Function to clear authentication session
export const clearSupabaseAuth = async () => {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error('Error clearing Supabase auth session:', error);
  }
};

// Function to check if user is authenticated
export const isSupabaseAuthenticated = () => {
  const session = supabase.auth.getSession();
  return !!session;
}; 