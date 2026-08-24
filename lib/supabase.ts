import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local"
  );
}

/**
 * Cliente sem generics de schema: a Fase 1 não usa tipos gerados pelo
 * Supabase CLI, então as chamadas (.from/.rpc) são tipadas manualmente
 * em lib/queries.ts em vez de depender de inferência automática.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
