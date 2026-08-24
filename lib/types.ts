/**
 * Tipos do domínio + shape das tabelas Supabase usadas na Fase 1.
 *
 * IMPORTANTE: estes tipos espelham o schema REAL do banco (confirmado via
 * introspecção da API REST), que difere do supabase/schema.sql original —
 * ver supabase/migration_schema_real_alinhamento.sql para o motivo e para
 * os ajustes de RPC/colunas. Não confie no schema.sql como fonte de verdade
 * para nomes de coluna; confie neste arquivo.
 */

export const FUNCOES_CONTATO = [
  "RESPONSAVEL",
  "FINANCEIRO",
  "SOCIO",
  "DONO",
  "FUNCIONARIO",
  "OUTRO",
] as const;
export type FuncaoContato = (typeof FUNCOES_CONTATO)[number];

export const PLANOS = ["Padrão"] as const;
export type Plano = (typeof PLANOS)[number];

export const ESTADOS_BR = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;
export type EstadoBR = (typeof ESTADOS_BR)[number];

export type StatusContrato = "ativo" | "inativo" | "cancelado";
export type StatusPagamento = "projetado" | "pago" | "atrasado" | "cancelado";

export const GRAUS_DIFICULDADE = ["BAIXO", "MEDIO", "ALTO"] as const;
export type GrauDificuldade = (typeof GRAUS_DIFICULDADE)[number];

/** UNE — tabela própria no banco real (não é mais uma lista fixa de strings). */
export interface Une {
  id: string;
  nome: string;
}

export interface Produto {
  id: string;
  une_id: string;
  nome: string;
  descricao: string | null;
  tipo: string | null;
  ativo: boolean;
  data_criacao: string;
  data_atualizacao: string;
}

export interface Consultora {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  setor: string | null;
  ativo: boolean;
  data_criacao: string;
  data_atualizacao: string;
}

export interface Cliente {
  id: string;
  nome_razao_social: string;
  cpf_cnpj_responsavel: string;
  telefone_responsavel: string | null;
  email_responsavel: string | null;
  data_nascimento_responsavel: string | null;
  rede_social_responsavel: string | null;
  cidade: string | null;
  estado: string | null;
  faturamento_medio: number | null;
  ativo: boolean;
  data_criacao: string;
  data_atualizacao: string;
  data_inativacao: string | null;
}

export interface ContatoCliente {
  id: string;
  cliente_id: string;
  nome: string;
  telefone: string;
  email: string;
  funcao: FuncaoContato;
  descricao_outro: string | null;
  rede_social: string | null;
  data_nascimento: string | null;
  ativo: boolean;
  data_criacao: string;
  data_atualizacao: string;
}

export interface Contrato {
  id: string;
  cliente_id: string;
  produto_id: string;
  une_id: string;
  consultora_id: string;
  valor_mensal: number;
  valor_primeiro_pagamento: number | null;
  data_inicio_primeiro_pagamento: string;
  data_vencimento_mensal: number;
  data_inicio_consultoria: string | null;
  data_onboarding: string | null;
  data_cancelamento: string | null;
  motivo_cancelamento: string | null;
  observacoes: string | null;
  contexto_perfil_cliente: string;
  plano_contratado: string;
  recorrente: boolean;
  status: StatusContrato;
  grau_dificuldade: GrauDificuldade;
  data_criacao: string;
  data_atualizacao: string;
}

export interface PagamentoProjetado {
  id: string;
  contrato_id: string;
  mes: number;
  ano: number;
  valor_projetado: number;
  data_vencimento: string | null;
  status: StatusPagamento;
  data_pagamento_real: string | null;
  valor_recebido: number | null;
  data_criacao: string;
  data_atualizacao: string;
}

/** Payload enviado pelo formulário para /api/webhook/novo-contrato */
export interface NovoContratoPayload {
  produto_id: string;
  une_id: string;
  empresa: {
    nome_razao_social: string;
    cpf_cnpj_responsavel: string;
    cidade: string | null;
    estado: string | null;
    faturamento_medio: number | null;
  };
  contatos: Array<{
    nome: string;
    telefone: string;
    email: string;
    funcao: FuncaoContato;
    descricao_outro?: string | null;
    rede_social?: string | null;
    data_nascimento?: string | null;
  }>;
  pagamento: {
    valor_mensal: number;
    plano_contratado: string;
    recorrente: boolean;
    data_inicio_primeiro_pagamento: string;
    valor_primeiro_pagamento?: number | null;
    data_vencimento_mensal: number;
    data_inicio_consultoria?: string | null;
    data_onboarding?: string | null;
  };
  consultora_id: string;
  contexto_perfil_cliente: string;
  observacoes?: string | null;
  grau_dificuldade: GrauDificuldade;
}

export interface ClienteComResumo {
  id: string;
  nome_razao_social: string;
  cpf_cnpj_responsavel: string;
  email_responsavel: string | null;
  cidade: string | null;
  estado: string | null;
  faturamento_medio: number | null;
  data_criacao: string;
  contatos_count: number;
  contratos_count: number;
  contratos_ativos_count: number;
  valor_total: number;
  status: "Ativo" | "Inativo";
  /** Grau de dificuldade do contrato mais recente do cliente (null se não houver contratos). */
  grau_dificuldade: GrauDificuldade | null;
}

export interface ClienteDetalhes extends Cliente {
  contatos: ContatoCliente[];
  contratos: Array<
    Contrato & { produto: Produto | null; consultora: Consultora | null; une: Une | null }
  >;
  pagamentos_projetados: PagamentoProjetado[];
}

export interface KPIs {
  clientes_ativos: number;
  receita_mensal_projetada: number;
  contratos_ativos: number;
  pagamentos_pendentes: number;
  clientes_por_dificuldade: Record<GrauDificuldade, number>;
}

export interface PagamentoDoMes {
  id: string;
  cliente_nome: string;
  produto_nome: string;
  valor: number;
  data_vencimento: string | null;
  status: StatusPagamento;
}

export interface ReceitaMensal {
  mes: string;
  projetada: number;
  realizada: number;
}

export interface ClienteFiltros {
  busca?: string;
  status?: "Ativo" | "Inativo" | "Todos";
  pagina?: number;
  porPagina?: number;
}

/** Retorno da função RPC criar_contrato_completo (ver supabase/migration_schema_real_alinhamento.sql). */
export interface CriarContratoRPCResult {
  cliente_id: string;
  contrato_id: string;
}
