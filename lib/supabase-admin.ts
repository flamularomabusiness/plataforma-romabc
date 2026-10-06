import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com a service-role key: ignora RLS e GRANTs, então SÓ para código de
 * servidor sem usuário logado (cron) e SEMPRE atrás de uma checagem própria
 * de autorização na rota. Nunca prefixar a variável com NEXT_PUBLIC_.
 */
export function criarSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no ambiente do servidor");
  }
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}
