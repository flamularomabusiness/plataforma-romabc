/**
 * Papéis e permissões — SEM dependência de React nem do cliente Supabase, de
 * propósito: o middleware (edge) e as rotas /api importam daqui. lib/auth.ts
 * re-exporta tudo, então quem já importava de lá não muda.
 */

export const USER_ROLES = ["comercial", "administrator", "financeiro", "bpo", "consultora"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  comercial: "Comercial",
  administrator: "Administrador",
  financeiro: "Financeiro",
  bpo: "BPO",
  consultora: "Consultora",
};

/**
 * Permissões por funcionalidade em vez de uma hierarquia numérica: comercial
 * tem um recorte próprio (só Clientes + Novo Contrato) que não é um
 * subconjunto do resto. administrator e financeiro têm as mesmas permissões de
 * negócio — a única diferença é gerenciarUsuarios, exclusiva de administrator.
 * bpo é cópia exata do financeiro. consultora não acessa nada da plataforma:
 * só o Dashboard de ATAs, que é um sistema à parte (ver app/aviso-ata).
 */
export type Funcionalidade =
  | "dashboard"
  | "clientes"
  | "formulario"
  | "editarStatusCliente"
  | "editarStatusPagamento"
  | "importarDados"
  | "adicionarPessoa"
  | "adicionarEmpresa"
  | "gerenciarUsuarios"
  | "deletarCliente"
  | "verHistoricoEmails";

const PERMISSOES_FINANCEIRO: Record<Funcionalidade, boolean> = {
  dashboard: true,
  clientes: true,
  formulario: true,
  editarStatusCliente: true,
  editarStatusPagamento: true,
  importarDados: true,
  adicionarPessoa: true,
  adicionarEmpresa: true,
  gerenciarUsuarios: false,
  // Só soft delete — hard delete é exclusivo de administrator, checado
  // direto pela role (não por uma Funcionalidade separada) nos pontos que
  // chamam deletar_cliente_hard.
  deletarCliente: true,
  verHistoricoEmails: true,
};

export const PERMISSOES: Record<UserRole, Record<Funcionalidade, boolean>> = {
  comercial: {
    dashboard: false,
    clientes: true,
    formulario: true,
    editarStatusCliente: false,
    editarStatusPagamento: false,
    importarDados: false,
    adicionarPessoa: false,
    adicionarEmpresa: false,
    gerenciarUsuarios: false,
    // Comercial não edita nem status de cliente hoje — dar poder de ocultar
    // QUALQUER cliente do sistema (não existe conceito de "dono") seria uma
    // permissão nova mais sensível que tudo que ele já tem. Decisão
    // confirmada com o usuário ao construir esta feature.
    deletarCliente: false,
    verHistoricoEmails: false,
  },
  administrator: {
    dashboard: true,
    clientes: true,
    formulario: true,
    editarStatusCliente: true,
    editarStatusPagamento: true,
    importarDados: true,
    adicionarPessoa: true,
    adicionarEmpresa: true,
    gerenciarUsuarios: true,
    deletarCliente: true,
    verHistoricoEmails: true,
  },
  financeiro: PERMISSOES_FINANCEIRO,
  bpo: { ...PERMISSOES_FINANCEIRO },
  consultora: {
    dashboard: false,
    clientes: false,
    formulario: false,
    editarStatusCliente: false,
    editarStatusPagamento: false,
    importarDados: false,
    adicionarPessoa: false,
    adicionarEmpresa: false,
    gerenciarUsuarios: false,
    deletarCliente: false,
    verHistoricoEmails: false,
  },
};

export function ehUserRole(valor: unknown): valor is UserRole {
  return typeof valor === "string" && (USER_ROLES as readonly string[]).includes(valor);
}

/** Variante pura, sem tocar na sessão — use com uma role já conhecida (ex.: vinda de useUserRole). */
export function podeAcessar(userRole: UserRole, funcionalidade: Funcionalidade): boolean {
  return PERMISSOES[userRole][funcionalidade];
}

/**
 * Pra código de servidor, onde a role vem do banco como string solta: role
 * desconhecida ou ausente NEGA (no client o fallback é "comercial", mas no
 * servidor negar é o lado seguro).
 */
export function podeAcessarPorRole(role: string | null | undefined, funcionalidade: Funcionalidade): boolean {
  return ehUserRole(role) && PERMISSOES[role][funcionalidade];
}
