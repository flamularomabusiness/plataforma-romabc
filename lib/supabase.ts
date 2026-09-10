import { createBrowserClient } from "@supabase/ssr";

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
 *
 * createBrowserClient (em vez de createClient puro do @supabase/supabase-js):
 * guarda a sessão também em cookies, não só localStorage — é o que permite o
 * middleware (que roda no servidor/edge, sem acesso a localStorage) ler se
 * o usuário está autenticado. API idêntica (.from/.rpc/.auth), então nada
 * mais precisou mudar em lib/queries.ts nem no resto do app.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
