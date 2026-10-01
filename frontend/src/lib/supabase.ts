import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Safe public Supabase client for ATCS frontend.
 * Only uses public URL and anon key.
 * Service role keys, database passwords, and connection strings must NEVER be included here.
 *
 * SCOPE — READ BEFORE USING:
 *   All financial reads and writes go React -> ATCS API -> Prisma -> Supabase PostgreSQL.
 *   This client MUST NOT be used to read or mutate financial tables
 *   (Budget, Transaction, Commitment, SpendingRequest, AuditLog, DecisionSnapshot, ...).
 *   Every public table has Row Level Security enabled with no permissive policy,
 *   so the anon key cannot read them even if this client were used by mistake.
 *   It exists only for non-financial Supabase concerns (e.g. auth-aware UI,
 *   Realtime refresh signals, signed-asset helpers).
 *
 * Returns `null` when the public variables are absent, so the app keeps working
 * on ATCS API alone.
 */
let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (clientInstance) return clientInstance;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return clientInstance;
}

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && supabaseUrl !== '' && supabaseAnonKey !== ''
);
