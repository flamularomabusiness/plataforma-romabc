import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import {
  ClienteComResumo,
  ClienteDetalhes,
  ClienteFiltros,
  Consultora,
  GRAUS_DIFICULDADE,
  GrauDificuldade,
  KPIs,
  NovoContratoPayload,
  PagamentoDoMes,
  Produto,
  ReceitaMensal,
  StatusContrato,
  StatusPagamento,
  Une,
} from "./types";

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
  const { busca, status = "Todos", pagina = 1, porPagina = 50 } = filters;

  let query = supabase
    .from("clientes")
    .select(
      `*, contatos_cliente(email, funcao),
       contratos(id, status, valor_mensal, grau_dificuldade, data_criacao)`,
      { count: "exact" }
    );

  if (busca) {
    query = query.or(`nome_razao_social.ilike.%${busca}%,cpf_cnpj_responsavel.ilike.%${busca}%`);
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
    const contratos = row.contratos ?? [];
    const contatos = row.contatos_cliente ?? [];
    const contratosAtivos = contratos.filter((c: any) => c.status === "ativo");
    const responsavel =
      contatos.find((c: any) => c.funcao === "RESPONSAVEL") ?? contatos[0];
    const contratoMaisRecente = [...contratos].sort(
      (a: any, b: any) => new Date(b.data_criacao).getTime() - new Date(a.data_criacao).getTime()
    )[0];

    return {
      id: row.id,
      nome_razao_social: row.nome_razao_social,
      cpf_cnpj_responsavel: row.cpf_cnpj_responsavel,
      cidade: row.cidade,
      estado: row.estado,
      faturamento_medio: row.faturamento_medio,
      data_criacao: row.data_criacao,
      email_responsavel: responsavel?.email ?? row.email_responsavel ?? null,
      contatos_count: contatos.length,
      contratos_count: contratos.length,
      contratos_ativos_count: contratosAtivos.length,
      valor_total: contratos.reduce(
        (sum: number, c: any) => sum + Number(c.valor_mensal ?? 0),
        0
      ),
      status: contratosAtivos.length > 0 ? "Ativo" : "Inativo",
      grau_dificuldade: (contratoMaisRecente?.grau_dificuldade as GrauDificuldade) ?? null,
    };
  });

  const filtered =
    status === "Todos" ? mapped : mapped.filter((c) => c.status === status);

  return { data: filtered, total: count ?? filtered.length };
}

export async function fetchClienteDetalhes(id: string): Promise<ClienteDetalhes> {
  return medirTempo("Tempo para carregar detalhes do cliente", () => fetchClienteDetalhesImpl(id));
}

async function fetchClienteDetalhesImpl(id: string): Promise<ClienteDetalhes> {
  // cliente, contatos e contratos não dependem uns dos outros (só do id) —
  // antes rodavam em 3 awaits sequenciais, cada um esperando o anterior à
  // toa. Rodando em paralelo, o tempo total cai para o da consulta mais
  // lenta das três em vez da soma das três.
  const [clienteRes, contatosRes, contratosRes] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).single(),
    supabase
      .from("contatos_cliente")
      .select("*")
      .eq("cliente_id", id)
      .order("data_criacao", { ascending: true }),
    supabase
      .from("contratos")
      .select(`*, produto:produtos(*), consultora:consultoras(*), une:unes(*)`)
      .eq("cliente_id", id)
      .order("data_criacao", { ascending: false }),
  ]);

  if (clienteRes.error) throw new Error(clienteRes.error.message);
  if (contatosRes.error) throw new Error(contatosRes.error.message);
  if (contratosRes.error) throw new Error(contratosRes.error.message);

  const contratos = contratosRes.data ?? [];
  const contratoIds = contratos.map((c: any) => c.id);
  let pagamentos: any[] = [];
  if (contratoIds.length > 0) {
    const { data: pagamentosData, error: pagamentosError } = await supabase
      .from("pagamentos_projetados")
      .select("*")
      .in("contrato_id", contratoIds)
      .order("data_vencimento", { ascending: true });
    if (pagamentosError) throw new Error(pagamentosError.message);
    pagamentos = pagamentosData ?? [];
  }

  return {
    ...(clienteRes.data as any),
    contatos: contatosRes.data ?? [],
    contratos,
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
      .eq("ano", ano)
      .neq("status", "cancelado"),
    supabase
      .from("pagamentos_projetados")
      .select("id", { count: "exact" })
      .in("status", ["projetado", "atrasado"]),
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
    status: row.status,
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
      .filter((p: any) => p.status === "pago")
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
}

export async function atualizarCliente(id: string, payload: AtualizarClientePayload) {
  const { error } = await supabase
    .from("clientes")
    .update({ ...payload, data_atualizacao: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export interface AtualizarContratoPayload {
  valor_mensal?: number;
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

export function useAtualizarCliente(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AtualizarClientePayload) => atualizarCliente(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente", id] });
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
