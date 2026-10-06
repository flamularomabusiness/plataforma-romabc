import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente Supabase para Route Handlers que precisam agir COMO o usuário
 * logado (lê a sessão dos cookies da requisição). Diferente de lib/supabase.ts
 * (cliente de navegador): chamado no servidor ele não tem sessão nenhuma e
 * toda query/RPC sai como role "anon", que não tem privilégio nas tabelas de
 * negócio ("permission denied for table ...").
 */
export async function criarSupabaseServidor() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(lista) {
          try {
            lista.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Renovação de token numa resposta que já começou — o middleware
            // renova a sessão nas navegações, então ignorar aqui é seguro.
          }
        },
      },
    }
  );
}
