import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { determinarStatusCliente, determinarStatusPagamento } from "./status-helper";
import type { UserRole } from "./auth";
import {
  Cliente,
  ClienteComResumo,
  ClienteDetalhes,
  ClienteFiltros,
  Consultora,
  PagamentoProjetado,
  DashboardKPIsCompleto,
  DashboardKPIsFiltros,
  DashboardMesKPIs,
  DashboardUneKPIs,
  GRAUS_DIFICULDADE,
  GrauDificuldade,
  FuncaoPessoa,
  ImportClienteRow,
  ImportPagamentoRow,
  ImportarDadosResultado,
  KPIs,
  MensalidadeCelula,
  MensalidadeClienteLinha,
  MensalidadesPorClienteResultado,
  MesDashboard,
  NovoContratoPayload,
  PagamentoAVistaCliente,
  PagamentoDoMes,
  ParcelaClienteDetalhe,
  PessoaCliente,
  Produto,
  ReceitaMensal,
  RegistroImportacao,
  StatusCliente,
  StatusContrato,
  StatusPagamento,
  TipoContratoFiltro,
  TipoPagamento,
  Une,
} from "./types";

const PERIODOS_DASHBOARD_VALIDOS = [6, 12, 24] as const;
const MESES_ABREV = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
];

/** Ordem de severidade usada para resolver o grau "predominante" de um cliente. */
const SEVERIDADE_GRAU: Record<GrauDificuldade, number> = { BAIXO: 0, MEDIO: 1, ALTO: 2 };

/** console.time/console.timeEnd em volta de uma query, com timeEnd garantido mesmo em erro. */
async function medirTempo<T>(label: string, fn: () => Promise<T>): Promise<T> {
  console.time(label);
  try {
    return await fn();
  } finally {
    console.timeEnd(label);
  }
}

// ---------------------------------------------------------------------------
// Funções de fetch (puras, reutilizáveis em Server Components ou hooks)
// ---------------------------------------------------------------------------

export async function fetchUNEs(): Promise<Une[]> {
  return medirTempo("Tempo para carregar UNEs", async () => {
    const { data, error } = await supabase
      .from("unes")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome", { ascending: true });
    if (error) {
      console.error("[fetchUNEs] erro do Supabase:", error);
      throw new Error(error.message);
    }
    return (data ?? []) as Une[];
  });
}

/** Sem uneId, traz todos os produtos ativos. Com uneId, filtra pela UNE escolhida (dropdown dependente). */
export async function fetchProdutos(uneId?: string): Promise<Produto[]> {
  return medirTempo(`Tempo para carregar produtos${uneId ? ` (une=${uneId})` : ""}`, async () => {
    let query = supabase.from("produtos").select("*").eq("ativo", true);
    if (uneId) query = query.eq("une_id", uneId);
    const { data, error } = await query.order("nome", { ascending: true });
    if (error) {
      console.error("[fetchProdutos] erro do Supabase:", error);
      throw new Error(error.message);
    }
    return (data ?? []) as Produto[];
  });
}

export async function fetchConsultoras(): Promise<Consultora[]> {
  return medirTempo("Tempo para carregar consultoras", async () => {
    const { data, error } = await supabase
      .from("consultoras")
      .select("*")
      .eq("ativo", true)
      .order("nome", { ascending: true });
    if (error) {
      console.error("[fetchConsultoras] erro do Supabase:", error);
      throw new Error(error.message);
    }
    return (data ?? []) as Consultora[];
  });
}

export async function fetchClientes(
  filters: ClienteFiltros = {}
): Promise<{ data: ClienteComResumo[]; total: number }> {
  return medirTempo("Tempo para carregar clientes", () => fetchClientesImpl(filters));
}

async function fetchClientesImpl(
  filters: ClienteFiltros
): Promise<{ data: ClienteComResumo[]; total: number }> {
  const { busca, status = "TODOS", pagina = 1, porPagina = 50 } = filters;

  // contratos(...) embutido usa a FK direta contratos.cliente_id, que só
  // aponta pra "primeira" empresa de um contrato agora que uma empresa pode
  // estar em vários contratos (contrato_empresas). Por isso o embed passa
  // pela tabela de ligação — assim uma empresa "secundária" também aparece
  // com seus contratos aqui.
  let query = supabase
    .from("clientes")
    .select(
      `*, contatos_cliente(email, funcao),
       contrato_empresas(contrato:contratos(id, status, tipo_pagamento, valor_mensal, valor_total,
         grau_dificuldade, data_criacao, pessoas_cliente(email, eh_principal)))`,
      { count: "exact" }
    );

  if (busca) {
    query = query.or(`nome_razao_social.ilike.%${busca}%,cpf_cnpj_responsavel.ilike.%${busca}%`);
  }
  if (status !== "TODOS") {
    query = query.eq("status", status);
  }

  const from = (pagina - 1) * porPagina;
  const to = from + porPagina - 1;
  query = query.order("nome_razao_social", { ascending: true }).range(from, to);

  const { data, error, count } = await query;
  if (error) {
    console.error("[fetchClientes] erro do Supabase:", error);
    throw new Error(error.message);
  }

  const mapped: ClienteComResumo[] = (data ?? []).map((row: any) => {
    const contratos = ((row.contrato_empresas ?? []) as any[])
      .map((ce) => ce.contrato)
      .filter(Boolean);
    const contatos = row.contatos_cliente ?? [];
    const contratosAtivos = contratos.filter((c: any) => c.status === "ativo");
    const responsavelLegado =
      contatos.find((c: any) => c.funcao === "RESPONSAVEL") ?? contatos[0];
    const contratoMaisRecente = [...contratos].sort(
      (a: any, b: any) => new Date(b.data_criacao).getTime() - new Date(a.data_criacao).getTime()
    )[0];
    // Contratos novos não têm mais contatos_cliente — o e-mail cai para a
    // pessoa principal do contrato mais recente (ou qualquer pessoa, na falta).
    const pessoasContratoRecente = contratoMaisRecente?.pessoas_cliente ?? [];
    const pessoaPrincipal =
      pessoasContratoRecente.find((p: any) => p.eh_principal) ?? pessoasContratoRecente[0];

    return {
      id: row.id,
      nome_razao_social: row.nome_razao_social,
      cpf_cnpj_responsavel: row.cpf_cnpj_responsavel,
      cidade: row.cidade,
      estado: row.estado,
      faturamento_medio: row.faturamento_medio,
      data_criacao: row.data_criacao,
      email_responsavel:
        responsavelLegado?.email ?? pessoaPrincipal?.email ?? row.email_responsavel ?? null,
      contatos_count: contatos.length,
      contratos_count: contratos.length,
      contratos_ativos_count: contratosAtivos.length,
      valor_total: contratos.reduce(
        (sum: number, c: any) =>
          sum + Number((c.tipo_pagamento === "recorrente" ? c.valor_mensal : c.valor_total) ?? 0),
        0
      ),
      status: row.status as StatusCliente,
      grau_dificuldade: (contratoMaisRecente?.grau_dificuldade as GrauDificuldade) ?? null,
    };
  });

  return { data: mapped, total: count ?? mapped.length };
}

export async function fetchClienteDetalhes(id: string): Promise<ClienteDetalhes> {
  return medirTempo("Tempo para carregar detalhes do cliente", () => fetchClienteDetalhesImpl(id));
}

async function fetchClienteDetalhesImpl(id: string): Promise<ClienteDetalhes> {
  // cliente, contatos e os contratos deste cliente não dependem uns dos
  // outros (só do id) — rodam em paralelo. Contratos vêm via
  // contrato_empresas (não mais contratos.cliente_id direto), porque uma
  // empresa pode ser uma entre várias em um mesmo contrato agora.
  const [clienteRes, contatosRes, contratoEmpresasRes] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).single(),
    supabase
      .from("contatos_cliente")
      .select("*")
      .eq("cliente_id", id)
      .order("data_criacao", { ascending: true }),
    supabase
      .from("contrato_empresas")
      .select(`contrato:contratos(*, produto:produtos(*), consultora:consultoras(*), une:unes(*))`)
      .eq("cliente_id", id),
  ]);

  if (clienteRes.error) throw new Error(clienteRes.error.message);
  if (contatosRes.error) throw new Error(contatosRes.error.message);
  if (contratoEmpresasRes.error) throw new Error(contratoEmpresasRes.error.message);

  const contratos = ((contratoEmpresasRes.data ?? []) as any[])
    .map((ce) => ce.contrato)
    .filter(Boolean)
    .sort(
      (a: any, b: any) => new Date(b.data_criacao).getTime() - new Date(a.data_criacao).getTime()
    );

  const contratoIds = contratos.map((c: any) => c.id);
  let pagamentos: any[] = [];
  let pessoas: any[] = [];
  const empresasPorContrato = new Map<string, any[]>();
  if (contratoIds.length > 0) {
    const [pagamentosRes, pessoasRes, empresasRes] = await Promise.all([
      supabase
        .from("pagamentos_projetados")
        .select("*")
        .in("contrato_id", contratoIds)
        .order("data_vencimento", { ascending: true }),
      supabase.from("pessoas_cliente").select("*").in("contrato_id", contratoIds),
      supabase
        .from("contrato_empresas")
        .select("contrato_id, cliente:clientes(*)")
        .in("contrato_id", contratoIds),
    ]);
    if (pagamentosRes.error) throw new Error(pagamentosRes.error.message);
    if (pessoasRes.error) throw new Error(pessoasRes.error.message);
    if (empresasRes.error) throw new Error(empresasRes.error.message);
    pagamentos = pagamentosRes.data ?? [];
    pessoas = pessoasRes.data ?? [];
    for (const row of (empresasRes.data ?? []) as any[]) {
      const lista = empresasPorContrato.get(row.contrato_id) ?? [];
      if (row.cliente) lista.push(row.cliente);
      empresasPorContrato.set(row.contrato_id, lista);
    }
  }

  const contratosCompletos = contratos.map((contrato: any) => ({
    ...contrato,
    pessoas: pessoas.filter((p: any) => p.contrato_id === contrato.id),
    empresas: empresasPorContrato.get(contrato.id) ?? [],
  }));

  return {
    ...(clienteRes.data as any),
    contatos: contatosRes.data ?? [],
    contratos: contratosCompletos,
    pagamentos_projetados: pagamentos,
  };
}

export async function fetchKPIs(): Promise<KPIs> {
  return medirTempo("Tempo para carregar KPIs", () => fetchKPIsImpl());
}

async function fetchKPIsImpl(): Promise<KPIs> {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();

  const [contratosAtivosRes, receitaRes, pendentesRes] = await Promise.all([
    supabase
      .from("contratos")
      .select("id, cliente_id, grau_dificuldade", { count: "exact" })
      .eq("status", "ativo"),
    supabase
      .from("pagamentos_projetados")
      .select("valor_projetado")
      .eq("mes", mes)
      .eq("ano", ano),
    supabase
      .from("pagamentos_projetados")
      .select("id", { count: "exact" })
      .eq("status", "PROJETADO"),
  ]);

  if (contratosAtivosRes.error) throw new Error(contratosAtivosRes.error.message);
  if (receitaRes.error) throw new Error(receitaRes.error.message);
  if (pendentesRes.error) throw new Error(pendentesRes.error.message);

  const contratosAtivos = contratosAtivosRes.data ?? [];
  const clientesAtivos = new Set(contratosAtivos.map((c: any) => c.cliente_id)).size;

  const receitaMensalProjetada = (receitaRes.data ?? []).reduce(
    (sum: number, p: any) => sum + Number(p.valor_projetado ?? 0),
    0
  );

  // Cada cliente conta em um único balde de dificuldade: quando há mais de um
  // contrato ativo com graus diferentes, prevalece o mais severo (ALTO > MEDIO > BAIXO).
  const grauPorCliente = new Map<string, GrauDificuldade>();
  for (const contrato of contratosAtivos as any[]) {
    const grauAtual = grauPorCliente.get(contrato.cliente_id);
    const grauContrato = contrato.grau_dificuldade as GrauDificuldade;
    if (!grauAtual || SEVERIDADE_GRAU[grauContrato] > SEVERIDADE_GRAU[grauAtual]) {
      grauPorCliente.set(contrato.cliente_id, grauContrato);
    }
  }

  const clientesPorDificuldade = GRAUS_DIFICULDADE.reduce(
    (acc, grau) => ({ ...acc, [grau]: 0 }),
    {} as Record<GrauDificuldade, number>
  );
  for (const grau of grauPorCliente.values()) {
    clientesPorDificuldade[grau] += 1;
  }

  return {
    clientes_ativos: clientesAtivos,
    receita_mensal_projetada: receitaMensalProjetada,
    contratos_ativos: contratosAtivosRes.count ?? 0,
    pagamentos_pendentes: pendentesRes.count ?? 0,
    clientes_por_dificuldade: clientesPorDificuldade,
  };
}

export async function fetchPagamentosDoMes(
  pagina = 1,
  porPagina = 10
): Promise<{ data: PagamentoDoMes[]; total: number }> {
  return medirTempo("Tempo para carregar pagamentos do mês", () =>
    fetchPagamentosDoMesImpl(pagina, porPagina)
  );
}

async function fetchPagamentosDoMesImpl(
  pagina: number,
  porPagina: number
): Promise<{ data: PagamentoDoMes[]; total: number }> {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();
  const from = (pagina - 1) * porPagina;
  const to = from + porPagina - 1;

  const { data, error, count } = await supabase
    .from("pagamentos_projetados")
    .select(
      `id, valor_projetado, data_vencimento, status,
       contrato:contratos(cliente:clientes(nome_razao_social), produto:produtos(nome))`,
      { count: "exact" }
    )
    .eq("mes", mes)
    .eq("ano", ano)
    .order("data_vencimento", { ascending: true })
    .range(from, to);

  if (error) throw new Error(error.message);

  const mapped: PagamentoDoMes[] = (data ?? []).map((row: any) => ({
    id: row.id,
    cliente_nome: row.contrato?.cliente?.nome_razao_social ?? "-",
    produto_nome: row.contrato?.produto?.nome ?? "-",
    valor: Number(row.valor_projetado ?? 0),
    data_vencimento: row.data_vencimento,
    status: row.status as StatusPagamento,
  }));

  return { data: mapped, total: count ?? mapped.length };
}

export async function fetchReceitaMensal(): Promise<ReceitaMensal[]> {
  return medirTempo("Tempo para carregar receita mensal", () => fetchReceitaMensalImpl());
}

async function fetchReceitaMensalImpl(): Promise<ReceitaMensal[]> {
  const now = new Date();
  const meses: { mes: number; ano: number; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    meses.push({
      mes: d.getMonth() + 1,
      ano: d.getFullYear(),
      label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
    });
  }

  const inicio = meses[0];
  const fim = meses[meses.length - 1];

  const { data, error } = await supabase
    .from("pagamentos_projetados")
    .select("valor_projetado, mes, ano, status")
    .or(
      `and(ano.eq.${inicio.ano},mes.gte.${inicio.mes}),and(ano.eq.${fim.ano},mes.lte.${fim.mes}),and(ano.gt.${inicio.ano},ano.lt.${fim.ano})`
    );

  if (error) throw new Error(error.message);

  return meses.map(({ mes, ano, label }) => {
    const doMes = (data ?? []).filter((p: any) => p.mes === mes && p.ano === ano);
    const projetada = doMes.reduce((s: number, p: any) => s + Number(p.valor_projetado ?? 0), 0);
    const realizada = doMes
      .filter((p: any) => p.status === "PAGO")
      .reduce((s: number, p: any) => s + Number(p.valor_projetado ?? 0), 0);
    return { mes: label, projetada, realizada };
  });
}

export async function criarContrato(payload: NovoContratoPayload) {
  const response = await fetch("/api/webhook/novo-contrato", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error ?? "Erro ao criar contrato");
  }
  return json;
}

export async function importarDadosExcel(payload: {
  usuarioRole: UserRole;
  nomeArquivo: string;
  clientes: ImportClienteRow[];
  pagamentos: ImportPagamentoRow[];
}): Promise<ImportarDadosResultado> {
  const response = await fetch("/api/importar-dados", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error ?? "Erro ao importar dados");
  }
  return json;
}

export function useImportarDadosExcel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: importarDadosExcel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["kpis"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["historico-importacoes"] });
    },
  });
}

export async function fetchHistoricoImportacoes(): Promise<RegistroImportacao[]> {
  const { data, error } = await supabase
    .from("importacoes")
    .select("*")
    .order("data_criacao", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as RegistroImportacao[];
}

export function useHistoricoImportacoes() {
  return useQuery({ queryKey: ["historico-importacoes"], queryFn: fetchHistoricoImportacoes });
}

// ---------------------------------------------------------------------------
// Atualizações (edição de cliente/contrato/pagamento).
// Diferente de criarContrato (que passa por /api/webhook para rodar a
// transação criar_contrato_completo), estas são atualizações de uma única
// tabela — chamam o Supabase direto do client, como o resto das queries
// deste arquivo, sem precisar de uma API route intermediária.
// ---------------------------------------------------------------------------

export interface AtualizarClientePayload {
  nome_razao_social?: string;
  cpf_cnpj_responsavel?: string;
  email_responsavel?: string | null;
  telefone_responsavel?: string | null;
  data_nascimento_responsavel?: string | null;
  rede_social_responsavel?: string | null;
  cidade?: string | null;
  estado?: string | null;
  faturamento_medio?: number | null;
}

export async function atualizarCliente(id: string, payload: AtualizarClientePayload) {
  const { error } = await supabase
    .from("clientes")
    .update({ ...payload, data_atualizacao: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateClienteStatus(clienteId: string, novoStatus: StatusCliente) {
  const { error } = await supabase
    .from("clientes")
    .update({ status: novoStatus, data_atualizacao: new Date().toISOString() })
    .eq("id", clienteId);
  if (error) throw new Error(error.message);
}

export async function fetchClientesPorStatus(status: StatusCliente): Promise<ClienteComResumo[]> {
  const { data } = await fetchClientes({ status, pagina: 1, porPagina: 1000 });
  return data;
}

export async function fetchClienteComStatus(
  clienteId: string
): Promise<Pick<Cliente, "id" | "nome_razao_social" | "status">> {
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nome_razao_social, status")
    .eq("id", clienteId)
    .single();
  if (error) throw new Error(error.message);
  return data as Pick<Cliente, "id" | "nome_razao_social" | "status">;
}

/**
 * Recalcula e grava o status de TODOS os clientes com base nos pagamentos
 * (ver lib/status-helper.ts). Não é chamada automaticamente em lugar nenhum
 * hoje — status continua 100% manual; isto existe pronto para um cron job
 * futuro ou uma ação administrativa, conforme pedido na tarefa.
 */
export async function atualizarStatusAutomaticoClientes(): Promise<{ atualizados: number }> {
  const { data: clientes, error } = await supabase.from("clientes").select("id, status");
  if (error) throw new Error(error.message);

  let atualizados = 0;
  for (const cliente of (clientes ?? []) as Array<{ id: string; status: StatusCliente }>) {
    const statusCalculado = await determinarStatusCliente(cliente.id);
    if (statusCalculado !== cliente.status) {
      await updateClienteStatus(cliente.id, statusCalculado);
      atualizados += 1;
    }
  }
  return { atualizados };
}

export interface AtualizarContratoPayload {
  valor_mensal?: number;
  valor_total?: number;
  data_vencimento_mensal?: number;
  grau_dificuldade?: GrauDificuldade;
  status?: StatusContrato;
}

export async function atualizarContrato(id: string, payload: AtualizarContratoPayload) {
  const { error } = await supabase
    .from("contratos")
    .update({ ...payload, data_atualizacao: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export interface AtualizarPagamentoPayload {
  valor_projetado?: number;
  status?: StatusPagamento;
  data_pagamento_real?: string | null;
}

export async function atualizarPagamento(id: string, payload: AtualizarPagamentoPayload) {
  const { error } = await supabase
    .from("pagamentos_projetados")
    .update({ ...payload, data_atualizacao: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updatePagamentoStatus(
  pagamentoId: string,
  novoStatus: StatusPagamento,
  dataPagamentoReal?: string | null
) {
  return atualizarPagamento(pagamentoId, {
    status: novoStatus,
    ...(dataPagamentoReal !== undefined ? { data_pagamento_real: dataPagamentoReal } : {}),
  });
}

export async function fetchPagamentoPendente(pagamentoId: string): Promise<PagamentoProjetado> {
  const { data, error } = await supabase
    .from("pagamentos_projetados")
    .select("*")
    .eq("id", pagamentoId)
    .single();
  if (error) throw new Error(error.message);
  return data as PagamentoProjetado;
}

export async function fetchPagamentosPorStatus(
  clienteId: string,
  status: StatusPagamento
): Promise<PagamentoProjetado[]> {
  const { data: contratosLigados, error: contratosError } = await supabase
    .from("contrato_empresas")
    .select("contrato_id")
    .eq("cliente_id", clienteId);
  if (contratosError) throw new Error(contratosError.message);

  const contratoIds = (contratosLigados ?? []).map((c: any) => c.contrato_id);
  if (contratoIds.length === 0) return [];

  const { data, error } = await supabase
    .from("pagamentos_projetados")
    .select("*")
    .in("contrato_id", contratoIds)
    .eq("status", status)
    .order("data_vencimento", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PagamentoProjetado[];
}

export interface ResumoStatusPagamentos {
  count: number;
  total: number;
}

/** Count + soma R$ por status, entre todos os pagamentos ligados ao cliente. */
export async function fetchResumoStatusPagamentos(
  clienteId: string
): Promise<Record<StatusPagamento, ResumoStatusPagamentos>> {
  const resumo: Record<StatusPagamento, ResumoStatusPagamentos> = {
    PROJETADO: { count: 0, total: 0 },
    PAGO: { count: 0, total: 0 },
    ATRASADO: { count: 0, total: 0 },
    INADIMPLENTE: { count: 0, total: 0 },
  };

  const { data: contratosLigados, error: contratosError } = await supabase
    .from("contrato_empresas")
    .select("contrato_id")
    .eq("cliente_id", clienteId);
  if (contratosError) throw new Error(contratosError.message);

  const contratoIds = (contratosLigados ?? []).map((c: any) => c.contrato_id);
  if (contratoIds.length === 0) return resumo;

  const { data, error } = await supabase
    .from("pagamentos_projetados")
    .select("status, valor_projetado")
    .in("contrato_id", contratoIds);
  if (error) throw new Error(error.message);

  for (const p of (data ?? []) as Array<{ status: StatusPagamento; valor_projetado: number }>) {
    resumo[p.status].count += 1;
    resumo[p.status].total += Number(p.valor_projetado ?? 0);
  }
  return resumo;
}

/**
 * Recalcula e grava o status de TODOS os pagamentos com base em
 * determinarStatusPagamento (ver lib/status-helper.ts). Igual a
 * atualizarStatusAutomaticoClientes: não é chamada automaticamente em lugar
 * nenhum — status continua 100% manual; pronta pra um cron job futuro.
 */
export async function atualizarStatusAutomaticoPagamentos(): Promise<{ atualizados: number }> {
  const { data: pagamentos, error } = await supabase
    .from("pagamentos_projetados")
    .select("id, status, data_vencimento, data_pagamento_real");
  if (error) throw new Error(error.message);

  let atualizados = 0;
  for (const pagamento of (pagamentos ?? []) as Array<{
    id: string;
    status: StatusPagamento;
    data_vencimento: string | null;
    data_pagamento_real: string | null;
  }>) {
    const statusCalculado = determinarStatusPagamento(
      pagamento.data_vencimento,
      pagamento.data_pagamento_real
    );
    if (statusCalculado !== pagamento.status) {
      await updatePagamentoStatus(pagamento.id, statusCalculado);
      atualizados += 1;
    }
  }
  return { atualizados };
}

export interface AtualizarPessoaPayload {
  cpf?: string;
  nome_completo?: string;
  faturamento_medio?: number | null;
  telefone?: string;
  email?: string;
  data_nascimento?: string;
  rede_social?: string | null;
  funcao?: FuncaoPessoa;
  eh_principal?: boolean;
}

/**
 * pessoas_cliente não tem coluna data_atualizacao (confirmado por introspecção
 * — diferente das outras tabelas). Ao marcar uma pessoa como principal,
 * desmarca as demais do mesmo contrato antes de salvar (só uma pode ser
 * principal por contrato).
 */
export async function atualizarPessoa(
  id: string,
  contratoId: string,
  payload: AtualizarPessoaPayload
) {
  if (payload.eh_principal) {
    const { error: errorOutras } = await supabase
      .from("pessoas_cliente")
      .update({ eh_principal: false })
      .eq("contrato_id", contratoId)
      .neq("id", id);
    if (errorOutras) throw new Error(errorOutras.message);
  }

  const { error } = await supabase.from("pessoas_cliente").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

export interface NovaPessoaPayload {
  cpf: string;
  nome_completo: string;
  telefone: string;
  email: string;
  data_nascimento: string;
  rede_social?: string | null;
  funcao: FuncaoPessoa;
  eh_principal: boolean;
}

/**
 * Adiciona uma pessoa direto a um contrato, fora do fluxo do formulário de
 * Novo Contrato — usado pelo botão "+ Pessoa" na listagem de clientes.
 * Bloqueia CPF duplicado no mesmo contrato e aplica a mesma regra de
 * "só uma principal por contrato" do atualizarPessoa.
 */
export async function adicionarPessoaCliente(contratoId: string, payload: NovaPessoaPayload) {
  const { data: existentes, error: existentesError } = await supabase
    .from("pessoas_cliente")
    .select("id")
    .eq("contrato_id", contratoId)
    .eq("cpf", payload.cpf);
  if (existentesError) throw new Error(existentesError.message);
  if ((existentes ?? []).length > 0) {
    throw new Error("Já existe uma pessoa com este CPF neste contrato.");
  }

  if (payload.eh_principal) {
    const { error: errorOutras } = await supabase
      .from("pessoas_cliente")
      .update({ eh_principal: false })
      .eq("contrato_id", contratoId);
    if (errorOutras) throw new Error(errorOutras.message);
  }

  const { error } = await supabase.from("pessoas_cliente").insert({
    contrato_id: contratoId,
    faturamento_medio: 0,
    ...payload,
  });
  if (error) throw new Error(error.message);
}

/** Marca uma pessoa como principal do contrato, desmarcando as demais. */
export async function atualizarPessoaPrincipal(contratoId: string, pessoaId: string) {
  const { error: errorOutras } = await supabase
    .from("pessoas_cliente")
    .update({ eh_principal: false })
    .eq("contrato_id", contratoId)
    .neq("id", pessoaId);
  if (errorOutras) throw new Error(errorOutras.message);

  const { error } = await supabase
    .from("pessoas_cliente")
    .update({ eh_principal: true })
    .eq("id", pessoaId);
  if (error) throw new Error(error.message);
}

export async function buscarPessoasCliente(contratoId: string): Promise<PessoaCliente[]> {
  const { data, error } = await supabase
    .from("pessoas_cliente")
    .select("*")
    .eq("contrato_id", contratoId);
  if (error) throw new Error(error.message);
  return (data ?? []) as PessoaCliente[];
}

/** Contratos de um cliente — o modal "+ Pessoa" usa isso pra saber se precisa perguntar qual contrato. */
export async function fetchContratosDoCliente(
  clienteId: string
): Promise<Array<{ id: string; produto_nome: string }>> {
  const { data, error } = await supabase
    .from("contrato_empresas")
    .select("contrato:contratos(id, produto:produtos(nome))")
    .eq("cliente_id", clienteId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[])
    .map((linha) => linha.contrato)
    .filter(Boolean)
    .map((c) => ({ id: c.id, produto_nome: c.produto?.nome ?? "-" }));
}

export function useAdicionarPessoaCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contratoId, payload }: { contratoId: string; payload: NovaPessoaPayload }) =>
      adicionarPessoaCliente(contratoId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });
}

export function useContratosDoCliente(clienteId: string | null) {
  return useQuery({
    queryKey: ["contratos-do-cliente", clienteId],
    queryFn: () => fetchContratosDoCliente(clienteId as string),
    enabled: !!clienteId,
  });
}

// ---------------------------------------------------------------------------
// Hooks TanStack Query
// ---------------------------------------------------------------------------

export function useUNEs() {
  return useQuery({ queryKey: ["unes"], queryFn: fetchUNEs });
}

export function useProdutos(uneId?: string) {
  return useQuery({
    queryKey: ["produtos", uneId ?? null],
    queryFn: () => fetchProdutos(uneId),
  });
}

export function useConsultoras() {
  return useQuery({ queryKey: ["consultoras"], queryFn: fetchConsultoras });
}

export function useClientes(filters: ClienteFiltros = {}) {
  return useQuery({
    queryKey: ["clientes", filters],
    queryFn: () => fetchClientes(filters),
  });
}

export function useClienteDetalhes(id: string | undefined) {
  return useQuery({
    queryKey: ["cliente", id],
    queryFn: () => fetchClienteDetalhes(id as string),
    enabled: !!id,
  });
}

export function useKPIs() {
  return useQuery({ queryKey: ["kpis"], queryFn: fetchKPIs });
}

export function usePagamentosDoMes(pagina = 1, porPagina = 10) {
  return useQuery({
    queryKey: ["pagamentos-do-mes", pagina, porPagina],
    queryFn: () => fetchPagamentosDoMes(pagina, porPagina),
  });
}

export function useReceitaMensal() {
  return useQuery({ queryKey: ["receita-mensal"], queryFn: fetchReceitaMensal });
}

export function useCriarContrato() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: criarContrato,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["kpis"] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos-do-mes"] });
      queryClient.invalidateQueries({ queryKey: ["receita-mensal"] });
    },
  });
}

/**
 * clienteId aqui é só o cliente que está sendo visto na tela (usado pra
 * invalidar o cache certo) — cada chamada da mutation informa o id de qual
 * linha de "clientes" está sendo editada, porque a tabela de Empresas
 * vinculadas ao contrato pode conter OUTRAS empresas além da que está sendo
 * vista.
 */
export function useAtualizarCliente(clienteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AtualizarClientePayload }) =>
      atualizarCliente(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente", clienteId] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });
}

export function useAtualizarStatusCliente(clienteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (novoStatus: StatusCliente) => updateClienteStatus(clienteId, novoStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente", clienteId] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });
}

export async function removerEmpresaDoContrato(contratoId: string, clienteId: string) {
  const { error } = await supabase
    .from("contrato_empresas")
    .delete()
    .eq("contrato_id", contratoId)
    .eq("cliente_id", clienteId);
  if (error) throw new Error(error.message);
}

export function useRemoverEmpresaDoContrato(clienteVistoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contratoId, clienteId }: { contratoId: string; clienteId: string }) =>
      removerEmpresaDoContrato(contratoId, clienteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente", clienteVistoId] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });
}

export function useAtualizarContrato(clienteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AtualizarContratoPayload }) =>
      atualizarContrato(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente", clienteId] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["kpis"] });
    },
  });
}

export function useAtualizarPagamento(clienteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AtualizarPagamentoPayload }) =>
      atualizarPagamento(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente", clienteId] });
      queryClient.invalidateQueries({ queryKey: ["kpis"] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos-do-mes"] });
      queryClient.invalidateQueries({ queryKey: ["receita-mensal"] });
    },
  });
}

export function useAtualizarPessoa(clienteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      contratoId,
      payload,
    }: {
      id: string;
      contratoId: string;
      payload: AtualizarPessoaPayload;
    }) => atualizarPessoa(id, contratoId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente", clienteId] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Dashboard mês a mês (Gerente/Financeiro) — consolidado + por UNE.
// ---------------------------------------------------------------------------

interface MesInterno {
  mes: number;
  ano: number;
  label: string;
  /** true = mês ainda não ocorreu (só existe no modo Ano Vigente — dado projetado). */
  futuro: boolean;
}

/** Janela de meses (mais antigo -> mais recente), terminando no mês atual — nunca inclui futuro. */
function gerarJanelaMeses(quantidade: number): MesInterno[] {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1; // 1-12
  const meses: MesInterno[] = [];
  for (let i = quantidade - 1; i >= 0; i--) {
    const totalMeses = anoAtual * 12 + (mesAtual - 1) - i;
    const ano = Math.floor(totalMeses / 12);
    const mes = (totalMeses % 12) + 1;
    meses.push({ mes, ano, label: `${MESES_ABREV[mes - 1]}-${String(ano).slice(2)}`, futuro: false });
  }
  return meses;
}

/**
 * Modo "Ano Vigente": janeiro a dezembro do ano corrente, incluindo o mês
 * atual. Mês atual e anteriores = recebido/fechado (futuro:false); meses
 * depois do atual = ainda não ocorreram, então os valores são só o projetado
 * (futuro:true, estilo visual diferenciado no front — 60% opacity + *).
 */
function gerarMesesAnoVigente(): MesInterno[] {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;
  const meses: MesInterno[] = [];
  for (let mes = 1; mes <= 12; mes++) {
    meses.push({
      mes,
      ano: anoAtual,
      label: `${MESES_ABREV[mes - 1]}-${String(anoAtual).slice(2)}`,
      futuro: mes > mesAtual,
    });
  }
  return meses;
}

/**
 * Constrói as 6 séries de KPIs (faturamento, clientes, crescimentos, ticket
 * médio) a partir de dois mapas "ano-mes" -> valor, já agregados por
 * fetchDashboardKPIsImpl. Reaproveitado tanto pro consolidado quanto por UNE.
 */
function construirLinhaKPIs(
  meses: { mes: number; ano: number }[],
  faturamentoPorChave: Map<string, number>,
  clientesPorChave: Map<string, Set<string>>
): DashboardMesKPIs {
  const chave = (m: { mes: number; ano: number }) => `${m.ano}-${m.mes}`;
  const faturamento = meses.map((m) => faturamentoPorChave.get(chave(m)) ?? 0);
  const clientes = meses.map((m) => clientesPorChave.get(chave(m))?.size ?? 0);

  const crescimento_volume: Array<number | null> = faturamento.map((valor, i) => {
    if (i === 0) return null;
    const anterior = faturamento[i - 1];
    if (!anterior) return null;
    return ((valor - anterior) / anterior) * 100;
  });

  const crescimento_clientes: Array<number | null> = clientes.map((valor, i) => {
    if (i === 0) return null;
    const anterior = clientes[i - 1];
    if (!anterior) return null;
    return ((valor - anterior) / anterior) * 100;
  });

  const r_crescimento: Array<number | null> = faturamento.map((valor, i) =>
    i === 0 ? null : valor - faturamento[i - 1]
  );

  const ticket_medio: Array<number | null> = faturamento.map((valor, i) =>
    clientes[i] > 0 ? valor / clientes[i] : null
  );

  return { faturamento, clientes, crescimento_volume, crescimento_clientes, r_crescimento, ticket_medio };
}

export async function fetchDashboardKPIs(filtros: DashboardKPIsFiltros): Promise<DashboardKPIsCompleto> {
  return medirTempo("Tempo para carregar dashboard KPIs", () => fetchDashboardKPIsImpl(filtros));
}

async function fetchDashboardKPIsImpl(filtros: DashboardKPIsFiltros): Promise<DashboardKPIsCompleto> {
  const periodoValido = (PERIODOS_DASHBOARD_VALIDOS as readonly number[]).includes(filtros.quantidadeMeses)
    ? filtros.quantidadeMeses
    : 12;

  const meses = filtros.anoVigente ? gerarMesesAnoVigente() : gerarJanelaMeses(periodoValido);
  const inicio = meses[0];
  const fim = meses[meses.length - 1];

  let query = supabase
    .from("pagamentos_projetados")
    .select("mes, ano, valor_projetado, status, contrato_id, contrato:contratos(une_id, tipo_pagamento)");

  query = filtros.anoVigente
    ? query.eq("ano", inicio.ano)
    : query.or(
        `and(ano.eq.${inicio.ano},mes.gte.${inicio.mes}),and(ano.eq.${fim.ano},mes.lte.${fim.mes}),and(ano.gt.${inicio.ano},ano.lt.${fim.ano})`
      );

  if (filtros.apenasProjetado) {
    query = query.eq("status", "PROJETADO");
  }

  const [{ data: unes, error: unesError }, { data: pagamentos, error: pagamentosError }] =
    await Promise.all([
      supabase.from("unes").select("id, nome").eq("ativo", true).order("nome", { ascending: true }),
      query,
    ]);

  if (unesError) throw new Error(unesError.message);
  if (pagamentosError) throw new Error(pagamentosError.message);

  let pagamentosValidos = (pagamentos ?? []) as any[];
  if (filtros.tipoPagamento !== "TODOS") {
    pagamentosValidos = pagamentosValidos.filter(
      (p) => p.contrato?.tipo_pagamento === filtros.tipoPagamento
    );
  }

  const contratoIds = Array.from(new Set(pagamentosValidos.map((p: any) => p.contrato_id)));
  const contratoParaClientes = new Map<string, string[]>();
  if (contratoIds.length > 0) {
    const { data: empresas, error: empresasError } = await supabase
      .from("contrato_empresas")
      .select("contrato_id, cliente_id")
      .in("contrato_id", contratoIds);
    if (empresasError) throw new Error(empresasError.message);
    for (const linha of (empresas ?? []) as any[]) {
      const lista = contratoParaClientes.get(linha.contrato_id) ?? [];
      lista.push(linha.cliente_id);
      contratoParaClientes.set(linha.contrato_id, lista);
    }
  }

  const chave = (m: { mes: number; ano: number }) => `${m.ano}-${m.mes}`;

  const faturamentoConsolidado = new Map<string, number>();
  const clientesConsolidado = new Map<string, Set<string>>();
  const faturamentoPorUne = new Map<string, Map<string, number>>();
  const clientesPorUne = new Map<string, Map<string, Set<string>>>();

  for (const p of pagamentosValidos) {
    const chaveMes = chave({ mes: p.mes, ano: p.ano });
    const clientesDoContrato = contratoParaClientes.get(p.contrato_id) ?? [];

    faturamentoConsolidado.set(
      chaveMes,
      (faturamentoConsolidado.get(chaveMes) ?? 0) + Number(p.valor_projetado ?? 0)
    );
    const setConsolidado = clientesConsolidado.get(chaveMes) ?? new Set<string>();
    clientesDoContrato.forEach((id) => setConsolidado.add(id));
    clientesConsolidado.set(chaveMes, setConsolidado);

    const uneId = p.contrato?.une_id as string | undefined;
    if (!uneId) continue;

    const uneFaturamento = faturamentoPorUne.get(uneId) ?? new Map<string, number>();
    uneFaturamento.set(chaveMes, (uneFaturamento.get(chaveMes) ?? 0) + Number(p.valor_projetado ?? 0));
    faturamentoPorUne.set(uneId, uneFaturamento);

    const uneClientesPorMes = clientesPorUne.get(uneId) ?? new Map<string, Set<string>>();
    const uneSetMes = uneClientesPorMes.get(chaveMes) ?? new Set<string>();
    clientesDoContrato.forEach((id) => uneSetMes.add(id));
    uneClientesPorMes.set(chaveMes, uneSetMes);
    clientesPorUne.set(uneId, uneClientesPorMes);
  }

  const consolidado = construirLinhaKPIs(meses, faturamentoConsolidado, clientesConsolidado);

  const porUne: DashboardUneKPIs[] = (unes ?? []).map((une: any) => {
    const linha = construirLinhaKPIs(
      meses,
      faturamentoPorUne.get(une.id) ?? new Map(),
      clientesPorUne.get(une.id) ?? new Map()
    );
    return { une_id: une.id, une_nome: une.nome, ...linha };
  });

  const ultimoMes = meses[meses.length - 1];
  const ultimoDia = new Date(ultimoMes.ano, ultimoMes.mes, 0).getDate();

  return {
    periodo: {
      dataInicio: `${inicio.ano}-${String(inicio.mes).padStart(2, "0")}-01`,
      dataFim: `${ultimoMes.ano}-${String(ultimoMes.mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`,
      meses: meses.map((m): MesDashboard => ({ label: m.label, futuro: m.futuro })),
    },
    consolidado,
    por_une: porUne,
  };
}

export function useDashboardKPIs(filtros: DashboardKPIsFiltros) {
  return useQuery({
    queryKey: [
      "dashboard-kpis",
      filtros.quantidadeMeses,
      filtros.anoVigente,
      filtros.apenasProjetado,
      filtros.tipoPagamento,
    ],
    queryFn: () => fetchDashboardKPIs(filtros),
    staleTime: 60 * 60 * 1000, // 1h — CEO/Financeiro não precisa de dados em tempo real aqui.
  });
}

// ---------------------------------------------------------------------------
// Mensalidades por Cliente (Gerente/Financeiro) — tab dentro do dashboard.
// ---------------------------------------------------------------------------

const ORDEM_GRAVIDADE_STATUS: Record<StatusPagamento, number> = {
  PAGO: 0,
  PROJETADO: 1,
  ATRASADO: 2,
  INADIMPLENTE: 3,
};

/** Clientes com pelo menos um contrato na UNE informada. */
export async function fetchClientesPorUNE(
  uneId: string
): Promise<Array<{ id: string; nome: string; cnpj: string }>> {
  const { data: contratos, error: contratosError } = await supabase
    .from("contratos")
    .select("id")
    .eq("une_id", uneId);
  if (contratosError) throw new Error(contratosError.message);

  const contratoIds = (contratos ?? []).map((c: any) => c.id);
  if (contratoIds.length === 0) return [];

  const { data: ligacoes, error: ligacoesError } = await supabase
    .from("contrato_empresas")
    .select("cliente:clientes(id, nome_razao_social, cpf_cnpj_responsavel)")
    .in("contrato_id", contratoIds);
  if (ligacoesError) throw new Error(ligacoesError.message);

  const porId = new Map<string, { nome: string; cnpj: string }>();
  for (const linha of (ligacoes ?? []) as any[]) {
    if (linha.cliente) {
      porId.set(linha.cliente.id, {
        nome: linha.cliente.nome_razao_social,
        cnpj: linha.cliente.cpf_cnpj_responsavel,
      });
    }
  }
  return Array.from(porId, ([id, { nome, cnpj }]) => ({ id, nome, cnpj })).sort((a, b) =>
    a.nome.localeCompare(b.nome)
  );
}

/** Parcelas (tipo_pagamento = 'parcelado') de um cliente específico dentro de uma UNE. */
export async function fetchDadosParcelasPorCliente(
  uneId: string,
  clienteId: string
): Promise<ParcelaClienteDetalhe[]> {
  const { data: contratos, error: contratosError } = await supabase
    .from("contrato_empresas")
    .select("contrato:contratos!inner(id, une_id, tipo_pagamento)")
    .eq("cliente_id", clienteId);
  if (contratosError) throw new Error(contratosError.message);

  const contratoIds = ((contratos ?? []) as any[])
    .map((c) => c.contrato)
    .filter((c) => c && c.une_id === uneId && c.tipo_pagamento === "parcelado")
    .map((c) => c.id);
  if (contratoIds.length === 0) return [];

  const { data: pagamentos, error: pagamentosError } = await supabase
    .from("pagamentos_projetados")
    .select("contrato_id, numero_parcela, valor_projetado, data_vencimento, data_pagamento_real, status")
    .in("contrato_id", contratoIds)
    .order("data_vencimento", { ascending: true });
  if (pagamentosError) throw new Error(pagamentosError.message);

  return ((pagamentos ?? []) as any[]).map((p) => ({
    contrato_id: p.contrato_id,
    numero_parcela: p.numero_parcela,
    valor: Number(p.valor_projetado ?? 0),
    data_vencimento: p.data_vencimento,
    data_pagamento_real: p.data_pagamento_real,
    status: p.status as StatusPagamento,
  }));
}

/** Pagamentos de contratos à vista (tipo_pagamento = 'venda_unica') de uma UNE, num ano. */
export async function fetchContratoAVistaClientesPorUNE(
  uneId: string,
  ano: number
): Promise<PagamentoAVistaCliente[]> {
  const { data: contratos, error: contratosError } = await supabase
    .from("contratos")
    .select("id, contrato_empresas(cliente_id)")
    .eq("une_id", uneId)
    .eq("tipo_pagamento", "venda_unica");
  if (contratosError) throw new Error(contratosError.message);

  const contratoParaCliente = new Map<string, string>();
  for (const c of (contratos ?? []) as any[]) {
    const clienteId = c.contrato_empresas?.[0]?.cliente_id;
    if (clienteId) contratoParaCliente.set(c.id, clienteId);
  }
  const contratoIds = Array.from(contratoParaCliente.keys());
  if (contratoIds.length === 0) return [];

  const { data: pagamentos, error: pagamentosError } = await supabase
    .from("pagamentos_projetados")
    .select("contrato_id, valor_projetado, data_vencimento, data_pagamento_real, status")
    .in("contrato_id", contratoIds)
    .eq("ano", ano);
  if (pagamentosError) throw new Error(pagamentosError.message);

  return ((pagamentos ?? []) as any[])
    .map((p) => ({
      cliente_id: contratoParaCliente.get(p.contrato_id) ?? "",
      contrato_id: p.contrato_id,
      valor: Number(p.valor_projetado ?? 0),
      data_vencimento: p.data_vencimento,
      data_pagamento_real: p.data_pagamento_real,
      status: p.status as StatusPagamento,
    }))
    .filter((p) => p.cliente_id);
}

export async function fetchMensalidadesPorCliente(
  uneId: string,
  tipoContrato: TipoContratoFiltro,
  ano: number
): Promise<MensalidadesPorClienteResultado> {
  return medirTempo("Tempo para carregar mensalidades por cliente", () =>
    fetchMensalidadesPorClienteImpl(uneId, tipoContrato, ano)
  );
}

async function fetchMensalidadesPorClienteImpl(
  uneId: string,
  tipoContrato: TipoContratoFiltro,
  ano: number
): Promise<MensalidadesPorClienteResultado> {
  const meses = Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    label: `${MESES_ABREV[i]}-${String(ano).slice(2)}`,
  }));

  const clientes = await fetchClientesPorUNE(uneId);
  if (clientes.length === 0) {
    return { meses: meses.map((m) => m.label), linhas: [] };
  }

  // Contratos da UNE (+ tipo_pagamento e as empresas ligadas a cada um) —
  // busca em duas etapas (contratos, depois pagamentos por contrato_id) em
  // vez de filtro aninhado, seguindo o mesmo padrão do resto deste arquivo.
  let contratosQuery = supabase.from("contratos").select("id, tipo_pagamento").eq("une_id", uneId);
  if (tipoContrato !== "TODOS") {
    contratosQuery = contratosQuery.eq("tipo_pagamento", tipoContrato);
  }
  const { data: contratos, error: contratosError } = await contratosQuery;
  if (contratosError) throw new Error(contratosError.message);

  const contratoIds = (contratos ?? []).map((c: any) => c.id);
  if (contratoIds.length === 0) {
    return {
      meses: meses.map((m) => m.label),
      linhas: clientes.map((c) => ({
        cliente_id: c.id,
        cliente_nome: c.nome,
        cliente_cnpj: c.cnpj,
        celulas: meses.map(() => ({ valor: 0, status: null })),
      })),
    };
  }

  const tipoPorContrato = new Map<string, TipoPagamento>(
    (contratos ?? []).map((c: any) => [c.id, c.tipo_pagamento])
  );

  const [{ data: ligacoes, error: ligacoesError }, { data: pagamentos, error: pagamentosError }] =
    await Promise.all([
      supabase.from("contrato_empresas").select("contrato_id, cliente_id").in("contrato_id", contratoIds),
      supabase
        .from("pagamentos_projetados")
        .select("contrato_id, valor_projetado, data_vencimento, data_pagamento_real, status")
        .in("contrato_id", contratoIds)
        .eq("ano", ano),
    ]);
  if (ligacoesError) throw new Error(ligacoesError.message);
  if (pagamentosError) throw new Error(pagamentosError.message);

  const clientesPorContrato = new Map<string, string[]>();
  for (const linha of (ligacoes ?? []) as any[]) {
    const lista = clientesPorContrato.get(linha.contrato_id) ?? [];
    lista.push(linha.cliente_id);
    clientesPorContrato.set(linha.contrato_id, lista);
  }

  // cliente_id + mês (da data que representa o pagamento, ver comentário
  // abaixo) -> valores acumulados e pior status da célula.
  const acumulado = new Map<string, { valor: number; status: StatusPagamento }>();

  for (const p of (pagamentos ?? []) as any[]) {
    const clienteIds = clientesPorContrato.get(p.contrato_id) ?? [];
    if (clienteIds.length === 0) continue;

    // Recorrente e parcelado "moram" no mês do vencimento (cada parcela no
    // seu mês). À vista mostra no mês em que foi de fato pago — cai no
    // vencimento só enquanto ainda não tiver data_pagamento_real.
    const tipoPagamento = tipoPorContrato.get(p.contrato_id);
    const dataBase =
      tipoPagamento === "venda_unica" ? p.data_pagamento_real ?? p.data_vencimento : p.data_vencimento;
    if (!dataBase) continue;
    const mes = Number(dataBase.slice(5, 7));
    if (Number(dataBase.slice(0, 4)) !== ano) continue;

    const valor = Number(p.valor_projetado ?? 0);
    const status = p.status as StatusPagamento;

    for (const clienteId of clienteIds) {
      const chave = `${clienteId}-${mes}`;
      const atual = acumulado.get(chave);
      if (!atual) {
        acumulado.set(chave, { valor, status });
      } else {
        acumulado.set(chave, {
          valor: atual.valor + valor,
          status:
            ORDEM_GRAVIDADE_STATUS[status] > ORDEM_GRAVIDADE_STATUS[atual.status] ? status : atual.status,
        });
      }
    }
  }

  const linhas: MensalidadeClienteLinha[] = clientes.map((cliente) => ({
    cliente_id: cliente.id,
    cliente_nome: cliente.nome,
    cliente_cnpj: cliente.cnpj,
    celulas: meses.map((m): MensalidadeCelula => {
      const registro = acumulado.get(`${cliente.id}-${m.mes}`);
      return registro ? { valor: registro.valor, status: registro.status } : { valor: 0, status: null };
    }),
  }));

  return { meses: meses.map((m) => m.label), linhas };
}

export function useMensalidadesPorCliente(uneId: string | null, tipoContrato: TipoContratoFiltro, ano: number) {
  return useQuery({
    queryKey: ["mensalidades-por-cliente", uneId, tipoContrato, ano],
    queryFn: () => fetchMensalidadesPorCliente(uneId as string, tipoContrato, ano),
    enabled: !!uneId,
    staleTime: 60 * 60 * 1000,
  });
}
