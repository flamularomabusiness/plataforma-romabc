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

/** Função da Pessoa Cliente — enum próprio de pessoas_cliente, distinto de FUNCOES_CONTATO. */
export const FUNCOES_PESSOA = ["DONO", "FINANCEIRO", "SOCIO", "OUTRO"] as const;
export type FuncaoPessoa = (typeof FUNCOES_PESSOA)[number];

export const PLANOS = ["Padrão"] as const;
export type Plano = (typeof PLANOS)[number];

export const TIPOS_PAGAMENTO = ["recorrente", "venda_unica", "parcelado"] as const;
export type TipoPagamento = (typeof TIPOS_PAGAMENTO)[number];

/**
 * Status do cliente — gravado (maiúsculo) em clientes.status, com check
 * constraint no banco que só aceita exatamente estes 3 valores. Editável
 * manualmente por Gerente/Financeiro; não há recálculo automático ainda.
 */
export const STATUS_CLIENTE = ["ATIVO", "INATIVO", "INADIMPLENTE"] as const;
export type StatusCliente = (typeof STATUS_CLIENTE)[number];

export const ESTADOS_BR = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;
export type EstadoBR = (typeof ESTADOS_BR)[number];

export type StatusContrato = "ativo" | "inativo" | "cancelado";

/**
 * Status do pagamento — gravado (maiúsculo) em pagamentos_projetados.status,
 * com check constraint no banco que só aceita exatamente estes 4 valores
 * (confirmado testando um insert/update direto contra o banco — "cancelado"
 * NÃO é aceito, "INADIMPLENTE" é o 4º estado real).
 */
export const STATUS_PAGAMENTO = ["PROJETADO", "PAGO", "ATRASADO", "INADIMPLENTE"] as const;
export type StatusPagamento = (typeof STATUS_PAGAMENTO)[number];

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
  status: StatusCliente;
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

/**
 * Pessoa Cliente — ligada ao CONTRATO (contrato_id), não ao cliente/empresa.
 * Substitui Contatos como seção do formulário; contatos_cliente permanece no
 * banco intacta para contratos antigos, só não recebe mais registros novos.
 */
export interface PessoaCliente {
  id: string;
  contrato_id: string;
  cpf: string;
  nome_completo: string;
  faturamento_medio: number | null;
  telefone: string;
  email: string;
  data_nascimento: string | null;
  rede_social: string | null;
  funcao: FuncaoPessoa;
  eh_principal: boolean;
}

/** Linha de ligação contrato_empresas — 1 contrato pode ter N empresas (clientes), e vice-versa. */
export interface ContratoEmpresa {
  id: string;
  contrato_id: string;
  cliente_id: string;
}

export interface Contrato {
  id: string;
  cliente_id: string;
  produto_id: string;
  une_id: string;
  consultora_id: string;
  tipo_pagamento: TipoPagamento;
  /** Só preenchido quando tipo_pagamento = 'recorrente'. */
  valor_mensal: number | null;
  valor_primeiro_pagamento: number | null;
  data_inicio_primeiro_pagamento: string | null;
  data_vencimento_mensal: number | null;
  /** Valor do contrato para 'venda_unica' (pagamento único) e 'parcelado' (entrada + parcelas). */
  valor_total: number | null;
  /** Só preenchidos quando tipo_pagamento = 'parcelado'. */
  valor_entrada: number | null;
  data_entrada: string | null;
  numero_parcelas: number | null;
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
  /** Número da parcela em contratos parcelados (0 = entrada, 1..N = parcelas). Null para recorrente/venda_única. */
  numero_parcela: number | null;
  data_criacao: string;
  data_atualizacao: string;
}

/** Payload enviado pelo formulário para /api/webhook/novo-contrato */
export interface NovoContratoPayload {
  produto_id: string;
  une_id: string;
  empresas: Array<{
    nome_razao_social: string;
    cpf_cnpj_responsavel: string;
    cidade: string | null;
    estado: string | null;
    faturamento_medio: number | null;
  }>;
  pessoas: Array<{
    cpf: string;
    nome_completo: string;
    faturamento_medio: number | null;
    telefone: string;
    email: string;
    data_nascimento: string;
    rede_social?: string | null;
    funcao: FuncaoPessoa;
    eh_principal: boolean;
  }>;
  pagamento: {
    tipo_pagamento: TipoPagamento;
    plano_contratado: string;
    // Recorrente
    valor_mensal?: number;
    data_inicio_primeiro_pagamento?: string;
    valor_primeiro_pagamento?: number | null;
    data_vencimento_mensal?: number;
    // Venda única
    data_pagamento_unico?: string;
    // Venda única + Parcelado
    valor_total?: number;
    // Parcelado
    valor_entrada?: number;
    data_entrada?: string;
    numero_parcelas?: number;
    parcelas?: Array<{ valor: number; data: string }>;
    // Comuns
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
  status: StatusCliente;
  /** Grau de dificuldade do contrato mais recente do cliente (null se não houver contratos). */
  grau_dificuldade: GrauDificuldade | null;
}

export interface ClienteDetalhes extends Cliente {
  /** Legado (contatos_cliente) — preservado para contratos antigos; novos contratos usam pessoas por contrato. */
  contatos: ContatoCliente[];
  contratos: Array<
    Contrato & {
      produto: Produto | null;
      consultora: Consultora | null;
      une: Une | null;
      pessoas: PessoaCliente[];
      /** Todas as empresas ligadas a este contrato via contrato_empresas (inclui a própria, se ligada). */
      empresas: Cliente[];
    }
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

/** Uma linha de KPIs mês a mês (usada tanto para o consolidado quanto para cada UNE). */
export interface DashboardMesKPIs {
  faturamento: number[];
  clientes: number[];
  /** null no primeiro mês da janela (sem mês anterior pra comparar) ou quando o mês anterior é 0. */
  crescimento_volume: Array<number | null>;
  crescimento_clientes: Array<number | null>;
  r_crescimento: Array<number | null>;
  /** null quando não há clientes no mês (divisão por zero). */
  ticket_medio: Array<number | null>;
}

export interface DashboardUneKPIs extends DashboardMesKPIs {
  une_id: string;
  une_nome: string;
}

/** Um mês da janela do dashboard — "futuro" marca meses ainda não ocorridos (modo Ano Vigente). */
export interface MesDashboard {
  label: string;
  futuro: boolean;
}

export type TipoContratoFiltro = "TODOS" | TipoPagamento;

/** Uma célula da tabela de Mensalidades por Cliente — null = sem movimento naquele mês. */
export interface MensalidadeCelula {
  valor: number;
  /** Pior status entre os pagamentos que caíram nesta célula; null = sem movimento. */
  status: StatusPagamento | null;
}

export interface MensalidadeClienteLinha {
  cliente_id: string;
  cliente_nome: string;
  cliente_cnpj: string;
  celulas: MensalidadeCelula[];
}

export interface MensalidadesPorClienteResultado {
  meses: string[];
  linhas: MensalidadeClienteLinha[];
}

export interface ParcelaClienteDetalhe {
  contrato_id: string;
  numero_parcela: number | null;
  valor: number;
  data_vencimento: string | null;
  data_pagamento_real: string | null;
  status: StatusPagamento;
}

export interface PagamentoAVistaCliente {
  cliente_id: string;
  contrato_id: string;
  valor: number;
  data_vencimento: string | null;
  data_pagamento_real: string | null;
  status: StatusPagamento;
}

// ---------------------------------------------------------------------------
// Import de dados via Excel (Gerente/Financeiro).
// ---------------------------------------------------------------------------

export interface ImportClienteRow {
  empresa: string;
  cnpj: string;
  une: string;
  produto: string;
  valor: number;
  status: StatusCliente;
  data_inicio: string;
}

export interface ImportPagamentoRow {
  empresa: string;
  data_vencimento: string;
  valor: number;
  status: StatusPagamento;
  data_pagamento: string | null;
}

export type ImportSeveridade = "ok" | "aviso" | "erro";

export interface ImportLinhaValidada<T> {
  /** Número da linha na planilha (a linha 1 é o cabeçalho, dados começam na 2). */
  linha: number;
  dados: T;
  severidade: ImportSeveridade;
  mensagens: string[];
}

export interface ImportPreview {
  arquivoNome: string;
  clientes: ImportLinhaValidada<ImportClienteRow>[];
  pagamentos: ImportLinhaValidada<ImportPagamentoRow>[];
  temErro: boolean;
}

export interface ImportarDadosPayload {
  nomeArquivo: string;
  clientes: ImportClienteRow[];
  pagamentos: ImportPagamentoRow[];
}

export interface ImportarDadosResultado {
  clientes_importados: number;
  pagamentos_importados: number;
}

export interface RegistroImportacao {
  id: string;
  usuario_role: string;
  nome_arquivo: string;
  clientes_importados: number;
  pagamentos_importados: number;
  status: "SUCESSO" | "ERRO";
  detalhes: { erro?: string } | null;
  data_criacao: string;
}

export interface DashboardKPIsCompleto {
  periodo: {
    dataInicio: string;
    dataFim: string;
    meses: MesDashboard[];
  };
  consolidado: DashboardMesKPIs;
  por_une: DashboardUneKPIs[];
}

export interface DashboardKPIsFiltros {
  quantidadeMeses: number;
  anoVigente: boolean;
  apenasProjetado: boolean;
  tipoPagamento: TipoContratoFiltro;
}

export interface ClienteFiltros {
  busca?: string;
  status?: StatusCliente | "TODOS";
  pagina?: number;
  porPagina?: number;
}

/** Retorno da função RPC criar_contrato_completo (ver supabase/migration_schema_real_alinhamento.sql). */
export interface CriarContratoRPCResult {
  cliente_id: string;
  contrato_id: string;
}
