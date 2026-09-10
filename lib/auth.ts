import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * Autenticação real via Supabase Auth (email/senha). Antes disso a role
 * ficava em localStorage (mock da Fase 1) — a API pública deste arquivo
 * (UserRole, ROLE_LABELS, Funcionalidade, podeAcessar, hasAccess,
 * useUserRole, redirectPathAfterFormulario) foi mantida igual de propósito,
 * então nenhum dos ~15 arquivos que já consumem isso precisou mudar: só a
 * FONTE da role trocou (localStorage -> sessão do Supabase + tabela
 * usuarios), a leitura continua a mesma.
 */

export const USER_ROLES = ["comercial", "gerente", "financeiro"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  comercial: "Comercial",
  gerente: "Gerente",
  financeiro: "Financeiro",
};

/**
 * Permissões por funcionalidade em vez de uma hierarquia numérica: com 3
 * roles, comercial e financeiro têm acessos que não são um subconjunto um
 * do outro (comercial cria contrato mas não vê dashboard; financeiro vê
 * dashboard mas não cria contrato), então "gerente >= financeiro >= comercial"
 * não é uma modelagem válida. gerente é o único que acumula tudo.
 */
export type Funcionalidade =
  | "dashboard"
  | "clientes"
  | "formulario"
  | "editarStatusCliente"
  | "editarStatusPagamento"
  | "importarDados"
  | "adicionarPessoa";

const PERMISSOES: Record<UserRole, Record<Funcionalidade, boolean>> = {
  comercial: {
    dashboard: false,
    clientes: true,
    formulario: true,
    editarStatusCliente: false,
    editarStatusPagamento: false,
    importarDados: false,
    adicionarPessoa: false,
  },
  gerente: {
    dashboard: true,
    clientes: true,
    formulario: true,
    editarStatusCliente: true,
    editarStatusPagamento: true,
    importarDados: true,
    adicionarPessoa: true,
  },
  financeiro: {
    dashboard: true,
    clientes: true,
    formulario: false,
    editarStatusCliente: true,
    editarStatusPagamento: true,
    importarDados: true,
    adicionarPessoa: true,
  },
};

// ---------------------------------------------------------------------------
// Estado de sessão em memória.
//
// getUserRole()/hasAccess() continuam síncronos (tem chamador fora de
// componente React — redirectPathAfterFormulario logo após um submit) mas a
// sessão real do Supabase só resolve de forma assíncrona. Por isso guardamos
// aqui o último valor conhecido, atualizado por um listener global iniciado
// uma única vez (onAuthStateChange). Antes da primeira resolução (ou sem
// sessão) o valor é "comercial" — a role de menor privilégio, o mesmo
// fallback seguro que já existia no sistema mock.
// ---------------------------------------------------------------------------

let cachedRole: UserRole = "comercial";
let cachedUserId: string | null = null;
let sessaoResolvida = false;
let listenerIniciado = false;
const assinantes = new Set<() => void>();

function normalizarRole(bruto: unknown): UserRole {
  const valor = String(bruto ?? "").toLowerCase();
  return (USER_ROLES as readonly string[]).includes(valor) ? (valor as UserRole) : "comercial";
}

async function buscarRoleDoUsuario(userId: string): Promise<UserRole> {
  const { data, error } = await supabase.from("usuarios").select("role").eq("id", userId).maybeSingle();
  if (error || !data) return "comercial";
  return normalizarRole(data.role);
}

function notificarAssinantes() {
  assinantes.forEach((fn) => fn());
}

function iniciarListenerAuth() {
  if (listenerIniciado || typeof window === "undefined") return;
  listenerIniciado = true;

  supabase.auth.onAuthStateChange((_evento, session) => {
    cachedUserId = session?.user?.id ?? null;
    if (!session?.user) {
      cachedRole = "comercial";
      sessaoResolvida = true;
      notificarAssinantes();
      return;
    }
    buscarRoleDoUsuario(session.user.id).then((role) => {
      cachedRole = role;
      sessaoResolvida = true;
      notificarAssinantes();
    });
  });
}

/** Variante síncrona — lê o último valor conhecido (ver comentário acima). */
export function getUserRole(): UserRole {
  iniciarListenerAuth();
  return cachedRole;
}

export function getUserId(): string | null {
  iniciarListenerAuth();
  return cachedUserId;
}

/** Variante pura, sem tocar na sessão — use com uma role já conhecida (ex.: vinda de useUserRole). */
export function podeAcessar(userRole: UserRole, funcionalidade: Funcionalidade): boolean {
  return PERMISSOES[userRole][funcionalidade];
}

export function hasAccess(funcionalidade: Funcionalidade): boolean {
  return podeAcessar(getUserRole(), funcionalidade);
}

export function redirectPathAfterFormulario(): string {
  return hasAccess("dashboard") ? "/painel/dashboard" : "/painel/clientes";
}

/**
 * Lê a role apenas após montar no client, para não gerar hydration mismatch
 * (no SSR não há sessão resolvida ainda; ler direto no corpo do componente
 * faria o HTML do servidor divergir do primeiro render do client).
 */
export function useUserRole(): UserRole {
  const [role, setRole] = useState<UserRole>(cachedRole);

  useEffect(() => {
    iniciarListenerAuth();
    const atualizar = () => setRole(cachedRole);
    assinantes.add(atualizar);
    if (sessaoResolvida) atualizar();
    return () => {
      assinantes.delete(atualizar);
    };
  }, []);

  return role;
}

// ---------------------------------------------------------------------------
// Login / cadastro / logout (Supabase Auth real).
// ---------------------------------------------------------------------------

export interface UsuarioAtual {
  id: string;
  email: string;
  role: UserRole;
}

function traduzirErroAuth(mensagem: string): string {
  if (mensagem.includes("Invalid login credentials")) return "Email ou senha incorretos.";
  if (mensagem.includes("Email not confirmed")) {
    return "Confirme seu email antes de entrar — verifique sua caixa de entrada (e o spam).";
  }
  if (mensagem.includes("User already registered")) return "Já existe uma conta com este email.";
  if (mensagem.includes("Password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (mensagem.includes("Unable to validate email address")) return "Email inválido.";
  return mensagem;
}

export async function obterUsuarioAtual(): Promise<UsuarioAtual | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const role = await buscarRoleDoUsuario(session.user.id);
  return { id: session.user.id, email: session.user.email ?? "", role };
}

export async function loginComEmail(email: string, senha: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(traduzirErroAuth(error.message));
  return data;
}

/**
 * Cadastro só recebe email/senha — de propósito, sem parâmetro de role.
 * Toda conta nova sempre nasce 'comercial' (o trigger handle_new_user no
 * banco garante isso; ver supabase/migration_auth_usuarios.sql). Deixar a
 * pessoa escolher a própria role no cadastro permitiria qualquer um virar
 * "gerente" sozinho — promoção só acontece depois, por quem já é gerente.
 */
export async function cadastroComEmail(email: string, senha: string) {
  const { data, error } = await supabase.auth.signUp({ email, password: senha });
  if (error) throw new Error(traduzirErroAuth(error.message));
  return data;
}

export async function logout() {
  await supabase.auth.signOut();
  cachedRole = "comercial";
  cachedUserId = null;
  sessaoResolvida = true;
  notificarAssinantes();
}
