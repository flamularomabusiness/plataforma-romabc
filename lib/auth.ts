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

import { USER_ROLES, podeAcessar, type Funcionalidade, type UserRole } from "./papeis";

// Papéis e permissões moram em ./papeis (sem React/Supabase, pra o middleware e as
// rotas /api importarem a mesma definição). Re-exportados aqui pra API pública
// deste arquivo continuar igual.
export { USER_ROLES, ROLE_LABELS, PERMISSOES, podeAcessar, type Funcionalidade, type UserRole } from "./papeis";

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
let cachedNome: string | null = null;
let sessaoResolvida = false;
let listenerIniciado = false;
const assinantes = new Set<() => void>();

function normalizarRole(bruto: unknown): UserRole {
  const valor = String(bruto ?? "").toLowerCase();
  return (USER_ROLES as readonly string[]).includes(valor) ? (valor as UserRole) : "comercial";
}

async function buscarLinhaUsuario(
  userId: string
): Promise<{ role: UserRole; ativo: boolean; nome: string | null } | null> {
  const { data, error } = await supabase
    .from("usuarios")
    .select("role, ativo, nome")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("[auth] erro ao buscar role em usuarios:", error.message, "| userId:", userId);
    return null;
  }
  if (!data) {
    console.warn("[auth] nenhuma linha em usuarios para este userId (caiu no fallback comercial):", userId);
    return null;
  }
  console.log("[auth] role lida do banco:", data.role, "| ativo:", data.ativo, "| userId:", userId);
  return {
    role: normalizarRole(data.role),
    ativo: data.ativo !== false,
    nome: (data.nome as string | null) ?? null,
  };
}

function notificarAssinantes() {
  assinantes.forEach((fn) => fn());
}

function iniciarListenerAuth() {
  if (listenerIniciado || typeof window === "undefined") return;
  listenerIniciado = true;

  supabase.auth.onAuthStateChange((evento, session) => {
    console.log("[auth] onAuthStateChange:", evento, "| userId:", session?.user?.id ?? null);
    cachedUserId = session?.user?.id ?? null;
    if (!session?.user) {
      cachedRole = "comercial";
      cachedNome = null;
      sessaoResolvida = true;
      notificarAssinantes();
      return;
    }
    buscarLinhaUsuario(session.user.id).then((linha) => {
      if (linha && !linha.ativo) {
        // Conta desativada por um administrator — derruba a sessão local na
        // hora, mesmo que a pessoa já estivesse logada e navegando. O
        // signOut() dispara outro onAuthStateChange (SIGNED_OUT), que zera
        // cachedRole/cachedUserId pelo branch acima; o middleware barra o
        // próximo acesso a qualquer rota protegida de qualquer forma.
        supabase.auth.signOut();
        return;
      }
      cachedRole = linha?.role ?? "comercial";
      cachedNome = linha?.nome ?? null;
      sessaoResolvida = true;
      console.log("[auth] listener atualizou cachedRole para:", cachedRole, "(evento:", evento, ")");
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

/** Nome de quem está logado (usuarios.nome) — null até a sessão resolver ou se a conta não tem nome. */
export function useUserNome(): string | null {
  const [nome, setNome] = useState<string | null>(cachedNome);

  useEffect(() => {
    iniciarListenerAuth();
    const atualizar = () => setNome(cachedNome);
    assinantes.add(atualizar);
    if (sessaoResolvida) atualizar();
    return () => {
      assinantes.delete(atualizar);
    };
  }, []);

  return nome;
}

/**
 * Pra páginas que fazem gate de acesso (redireciona se não tiver permissão):
 * espera a sessão resolver antes de decidir. Um hasAccess(...) direto num
 * useEffect on-mount checava a role síncrona ANTES da sessão real do
 * Supabase carregar (ela começa em "comercial" até resolver) — um
 * administrator/financeiro dando refresh numa página protegida podia ser
 * expulso por engano, no instante entre montar e a sessão resolver.
 */
export function useAcessoLiberado(funcionalidade: Funcionalidade): "carregando" | "liberado" | "negado" {
  const [pronto, setPronto] = useState(sessaoResolvida);
  const role = useUserRole();

  useEffect(() => {
    iniciarListenerAuth();
    const atualizar = () => setPronto(sessaoResolvida);
    assinantes.add(atualizar);
    atualizar();
    return () => {
      assinantes.delete(atualizar);
    };
  }, []);

  if (!pronto) return "carregando";
  return podeAcessar(role, funcionalidade) ? "liberado" : "negado";
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
  // O cadastro só é aceito pra e-mails da lista autorizada: o banco recusa os
  // demais (trigger em auth.users), e o Supabase devolve isso como erro genérico.
  const minuscula = mensagem.toLowerCase();
  if (
    minuscula.includes("database error saving new user") ||
    minuscula.includes("email não autorizado") ||
    minuscula.includes("e-mail não autorizado")
  ) {
    return "Este email ainda não foi liberado. Fale com o administrador para autorizar seu acesso.";
  }
  if (mensagem.includes("Invalid login credentials")) return "Email ou senha incorretos.";
  if (mensagem.includes("Email not confirmed")) {
    return "Confirme seu email antes de entrar — verifique sua caixa de entrada (e o spam).";
  }
  if (mensagem.includes("User already registered")) return "Já existe uma conta com este email.";
  if (mensagem.includes("Password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (mensagem.includes("Unable to validate email address")) return "Email inválido.";
  return mensagem;
}

/**
 * O trigger handle_new_user deveria copiar o nome do cadastro
 * (user_metadata.nome) pra usuarios.nome. Se a conta ficou sem nome (trigger
 * antigo, conta criada antes), preenche no primeiro login: a RLS deixa a
 * própria pessoa editar a própria linha, e a role segue protegida por trigger.
 */
async function sincronizarNomeDoCadastro(userId: string, nomeCadastro: unknown, nomeAtual: string | null) {
  if (nomeAtual || typeof nomeCadastro !== "string" || !nomeCadastro.trim()) return;
  const nome = nomeCadastro.trim();
  const { error } = await supabase.from("usuarios").update({ nome }).eq("id", userId);
  if (error) {
    console.warn("[auth] não consegui gravar o nome do cadastro em usuarios:", error.message);
    return;
  }
  cachedNome = nome;
}

export async function obterUsuarioAtual(): Promise<UsuarioAtual | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const linha = await buscarLinhaUsuario(session.user.id);
  if (linha && !linha.ativo) return null;
  return { id: session.user.id, email: session.user.email ?? "", role: linha?.role ?? "comercial" };
}

/**
 * signInWithPassword() por si só resolve assim que o Supabase Auth autentica
 * — a busca da role em "usuarios" só rodava depois, dentro do listener
 * onAuthStateChange (lib/auth.ts, iniciarListenerAuth), em paralelo, sem
 * ninguém esperar por ela. Isso é uma corrida real: a página de login
 * chamava router.push("/painel/inicio") assim que loginComEmail() resolvia,
 * e a página de destino podia montar e ler cachedRole ANTES do listener
 * terminar de buscar a role de verdade — nesse instante cachedRole ainda
 * podia estar em "comercial" (valor default, ou sobra do logout anterior),
 * e como o timing depende da rede, o sintoma era "às vezes cai como
 * comercial" (bug reportado). Corrigido buscando a role AQUI, antes de
 * devolver — quando loginComEmail() resolve, cachedRole já está correto
 * garantido. O listener ainda roda em paralelo e faz a mesma busca de novo
 * (redundante, mas inofensivo — mesma resposta, só não é mais a única fonte).
 */
export async function loginComEmail(email: string, senha: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(traduzirErroAuth(error.message));

  if (data.user) {
    console.log("[auth] login OK, buscando role antes de liberar navegação:", data.user.id);
    const linha = await buscarLinhaUsuario(data.user.id);

    if (linha && !linha.ativo) {
      await supabase.auth.signOut();
      throw new Error("Esta conta foi desativada. Fale com um Administrador.");
    }

    cachedUserId = data.user.id;
    cachedRole = linha?.role ?? "comercial";
    cachedNome = linha?.nome ?? null;
    await sincronizarNomeDoCadastro(data.user.id, data.user.user_metadata?.nome, linha?.nome ?? null);
    sessaoResolvida = true;
    console.log("[auth] cachedRole definido para:", cachedRole);
    notificarAssinantes();
  }

  return data;
}

/**
 * Cadastro só recebe email/senha — de propósito, sem parâmetro de role.
 * Toda conta nova sempre nasce 'comercial' (o trigger handle_new_user no
 * banco garante isso; ver supabase/migration_auth_usuarios.sql). Deixar a
 * pessoa escolher a própria role no cadastro permitiria qualquer um virar
 * "administrator" sozinho — promoção só acontece depois, por quem já é
 * administrator.
 */
export async function cadastroComEmail({ nome, email, senha }: { nome: string; email: string; senha: string }) {
  // O nome vai em options.data (user_metadata) — o trigger handle_new_user copia pra usuarios.nome.
  const { data, error } = await supabase.auth.signUp({ email, password: senha, options: { data: { nome } } });
  if (error) throw new Error(traduzirErroAuth(error.message));
  return data;
}

export async function logout() {
  await supabase.auth.signOut();
  cachedRole = "comercial";
  cachedNome = null;
  cachedUserId = null;
  sessaoResolvida = true;
  notificarAssinantes();
}

// ---------------------------------------------------------------------------
// Gestão de usuários (exclusiva de administrator — RLS em usuarios só deixa
// ver/editar linha de outra pessoa quem já é administrator; estas funções
// não reforçam isso de novo no client, só repassam pro Supabase e deixam a
// RLS barrar quem tentar sem ser administrator).
// ---------------------------------------------------------------------------

export interface UsuarioGerenciado {
  id: string;
  email: string;
  role: UserRole;
  ativo: boolean;
  nome: string | null;
  data_criacao: string;
}

export async function listarUsuarios(): Promise<UsuarioGerenciado[]> {
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, email, role, ativo, nome, data_criacao")
    .order("data_criacao", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((linha) => ({ ...linha, role: normalizarRole(linha.role) }));
}

export async function atualizarRoleUsuario(id: string, novaRole: UserRole) {
  const { error } = await supabase.from("usuarios").update({ role: novaRole }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function desativarUsuario(id: string) {
  const { error } = await supabase.from("usuarios").update({ ativo: false }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function reativarUsuario(id: string) {
  const { error } = await supabase.from("usuarios").update({ ativo: true }).eq("id", id);
  if (error) throw new Error(error.message);
}
