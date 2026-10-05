import { GRAUS_DIFICULDADE, type GrauDificuldade } from "@/lib/types";

export const COMPLEXIDADES = ["Baixa", "Média", "Alta", "Muito Alta"] as const;
export type Complexidade = (typeof COMPLEXIDADES)[number];

export const PLANOS_COMPLEXIDADE = ["Start", "Fortalecer", "Performar"] as const;
export type PlanoComplexidade = (typeof PLANOS_COMPLEXIDADE)[number];

export type NotaDimensao = 1 | 2 | 3 | 4;

export type DimensaoKey =
  | "faturamento"
  | "societaria"
  | "bancaria"
  | "conformidade"
  | "operacao"
  | "governanca"
  | "dados";

export type Respostas = Partial<Record<DimensaoKey, NotaDimensao>>;
export type Pesos = Record<DimensaoKey, number>;

export interface Dimensao {
  key: DimensaoKey;
  nome: string;
  pesoDefault: number;
  pesoAlto?: boolean;
  nota?: string;
  opcoes: { n: NotaDimensao; texto: string }[];
}

export interface DimensaoRegistrada {
  nome: string;
  valor: NotaDimensao;
  peso: number;
}

export interface Consultor {
  id: string;
  nome: string;
  nivel: NivelCertificacao;
  status: "Ativo" | "Inativo";
  capacidade: number;
  clientesTotal: number;
  vagas: number;
  clientesBaixa: number;
  clientesMedia: number;
  clientesAlta: number;
  clientesMuitoAlta: number;
}

export type NivelCertificacao = "G+ Base" | "G+ Pro" | "G+ Pro sênior" | "G+ Elite";

/** Linha de public.avaliacoes_complexidade (ver supabase/migration_avaliacoes_complexidade.sql). */
export interface AvaliacaoComplexidade {
  id: string;
  cliente_id: string | null;
  contrato_id: string | null;
  form_id: string | null;
  cliente_nome: string;
  consultor: string | null;
  data_avaliacao: string;
  plano: PlanoComplexidade | null;
  score: number;
  complexidade: Complexidade;
  nivel_minimo_exigido: NivelCertificacao | null;
  consultores_sugeridos: string[] | null;
  multiplicador: number | null;
  dimensoes: Partial<Record<DimensaoKey, DimensaoRegistrada>>;
  created_at: string;
}

export type NovaAvaliacaoComplexidade = Omit<
  AvaliacaoComplexidade,
  "id" | "contrato_id" | "created_at" | "cliente_id"
>;

/** O que a ferramenta devolve a quem a chamou (formulário de novo contrato, por ex.). */
export interface ResultadoComplexidade {
  avaliacao_id: string;
  form_id: string | null;
  cliente_nome: string;
  score: number;
  complexidade: Complexidade;
  grau_dificuldade: GrauDificuldade;
}

/** Canal usado pra devolver o resultado pra aba do formulário que abriu a ferramenta. */
export const CANAL_COMPLEXIDADE = "romabc:indice-complexidade";

export interface MensagemComplexidade extends ResultadoComplexidade {
  tipo: "complexidade:resultado";
}

const TIERS: { min: number; max: number; nome: Complexidade }[] = [
  { min: 1.0, max: 1.75, nome: "Baixa" },
  { min: 1.75, max: 2.55, nome: "Média" },
  { min: 2.55, max: 3.35, nome: "Alta" },
  { min: 3.35, max: 4.01, nome: "Muito Alta" },
];

export const MULTIPLICADOR: Record<Complexidade, number> = {
  Baixa: 1.0,
  Média: 1.15,
  Alta: 1.3,
  "Muito Alta": 1.5,
};

/** Nível mínimo de certificação G+ exigido pra atender o cliente, por plano x faixa de complexidade. */
export const NIVEL_MINIMO: Record<PlanoComplexidade, Record<Complexidade, NivelCertificacao>> = {
  Start: { Baixa: "G+ Base", Média: "G+ Base", Alta: "G+ Pro", "Muito Alta": "G+ Pro sênior" },
  Fortalecer: { Baixa: "G+ Base", Média: "G+ Base", Alta: "G+ Pro", "Muito Alta": "G+ Pro sênior" },
  Performar: { Baixa: "G+ Pro", Média: "G+ Pro", Alta: "G+ Pro sênior", "Muito Alta": "G+ Elite" },
};

const NIVEL_ORDEM: Record<NivelCertificacao, number> = {
  "G+ Base": 1,
  "G+ Pro": 2,
  "G+ Pro sênior": 3,
  "G+ Elite": 4,
};

/**
 * Cadastro de consultores (nível G+, vagas, carteira) — copiado da planilha
 * que embasa a ferramenta original. É um dado estático de propósito: a tabela
 * `consultoras` do banco NÃO tem nível/vagas/carteira, então não há de onde
 * ler isso ainda. Quando existir, trocar esta lista por uma query.
 */
export const CONSULTORES_SEED: Consultor[] = [
  { id: "rosane-mello", nome: "Rosane Mello", nivel: "G+ Pro sênior", status: "Ativo", capacidade: 15, clientesTotal: 10, vagas: 5, clientesBaixa: 5, clientesMedia: 3, clientesAlta: 2, clientesMuitoAlta: 0 },
  { id: "glaucia-flesch", nome: "Glaucia Flesch", nivel: "G+ Pro sênior", status: "Ativo", capacidade: 15, clientesTotal: 11, vagas: 4, clientesBaixa: 2, clientesMedia: 2, clientesAlta: 5, clientesMuitoAlta: 2 },
  { id: "mayla-joiner", nome: "Mayla Jóiner", nivel: "G+ Pro sênior", status: "Ativo", capacidade: 15, clientesTotal: 8, vagas: 7, clientesBaixa: 4, clientesMedia: 2, clientesAlta: 2, clientesMuitoAlta: 0 },
  { id: "elisa-dhein", nome: "Elisa Dhein", nivel: "G+ Pro sênior", status: "Ativo", capacidade: 6, clientesTotal: 6, vagas: 0, clientesBaixa: 1, clientesMedia: 1, clientesAlta: 4, clientesMuitoAlta: 0 },
  { id: "tainara-muller", nome: "Tainara Müller", nivel: "G+ Base", status: "Ativo", capacidade: 8, clientesTotal: 6, vagas: 2, clientesBaixa: 2, clientesMedia: 3, clientesAlta: 1, clientesMuitoAlta: 0 },
];

export const DIMENSOES: Dimensao[] = [
  {
    key: "faturamento",
    nome: "Faturamento médio mensal",
    pesoDefault: 16,
    pesoAlto: true,
    nota: "Considere o faturamento total do cliente. Se houver mais de um CNPJ, some o faturamento de todos eles — o valor é sempre do grupo econômico atendido, não de um CNPJ isolado.",
    opcoes: [
      { n: 1, texto: "Até R$ 200.000/mês" },
      { n: 2, texto: "De R$ 200.001 a R$ 500.000/mês" },
      { n: 3, texto: "De R$ 500.001 a R$ 1.000.000/mês" },
      { n: 4, texto: "Acima de R$ 1.000.000/mês" },
    ],
  },
  {
    key: "societaria",
    nome: "Estrutura societária e legal",
    pesoDefault: 16,
    pesoAlto: true,
    opcoes: [
      { n: 1, texto: "Um único CNPJ, estrutura simples" },
      { n: 2, texto: "2 a 3 CNPJs relacionados (mesmo grupo de sócios)" },
      { n: 3, texto: "Múltiplos CNPJs/filiais com operações distintas entre si" },
      { n: 4, texto: "Holding ou grupo com várias empresas de naturezas diferentes, estrutura societária complexa" },
    ],
  },
  {
    key: "bancaria",
    nome: "Estrutura financeira e bancária",
    pesoDefault: 16,
    pesoAlto: true,
    nota: "Peso elevado: cada conta adicional gera trabalho real de conciliação e auditoria de saldos.",
    opcoes: [
      { n: 1, texto: "1 conta bancária" },
      { n: 2, texto: "2 a 3 contas, mesma instituição ou instituições distintas" },
      { n: 3, texto: "4 a 6 contas ou múltiplas instituições financeiras" },
      { n: 4, texto: "7 ou mais contas, múltiplas instituições, movimentação intensa entre elas" },
    ],
  },
  {
    key: "conformidade",
    nome: "Conformidade e formalização",
    pesoDefault: 16,
    pesoAlto: true,
    nota: "Peso elevado: pendências exigem trabalho adicional de regularização e elevam o risco do cliente e da consultoria.",
    opcoes: [
      { n: 1, texto: "Sem pendências fiscais, trabalhistas ou de registro" },
      { n: 2, texto: "Pendências pontuais, de baixo impacto" },
      { n: 3, texto: "Pendências relevantes (fiscais ou trabalhistas) que exigem regularização ativa" },
      { n: 4, texto: "Passivos significativos ou múltiplas irregularidades acumuladas" },
    ],
  },
  {
    key: "operacao",
    nome: "Operação",
    pesoDefault: 10,
    opcoes: [
      { n: 1, texto: "Operação simples, uma linha de produto/serviço" },
      { n: 2, texto: "2 a 3 linhas de produto/serviço ou canais de venda" },
      { n: 3, texto: "Múltiplos centros de custo, canais ou linhas de produto" },
      { n: 4, texto: "Operação multissetorial ou com alta diversidade de centros de custo" },
    ],
  },
  {
    key: "governanca",
    nome: "Governança e decisão",
    pesoDefault: 10,
    opcoes: [
      { n: 1, texto: "Sócio único, decisor" },
      { n: 2, texto: "2 sócios com decisões alinhadas" },
      { n: 3, texto: "Múltiplos sócios com divergências ocasionais, sem conselho formal" },
      { n: 4, texto: "Conflitos societários ativos ou ausência total de governança formal" },
    ],
  },
  {
    key: "dados",
    nome: "Dados e relatórios",
    pesoDefault: 16,
    pesoAlto: true,
    nota: "Peso elevado: a disponibilidade de relatório em regime de caixa determina o quão fácil é iniciar o trabalho.",
    opcoes: [
      { n: 1, texto: "Relatório em regime de caixa disponível, confiável, sistema único" },
      { n: 2, texto: "Relatório em regime de caixa disponível, mas com lacunas ou necessidade de ajustes" },
      { n: 3, texto: "Sem relatório em regime de caixa, mas dados brutos organizados (planilhas ou ERP consistente)" },
      { n: 4, texto: "Sem relatório em regime de caixa e dados dispersos em múltiplas fontes não conciliadas" },
    ],
  },
];

export const TOTAL_DIMENSOES = DIMENSOES.length;

export function pesosPadrao(): Pesos {
  return Object.fromEntries(DIMENSOES.map((d) => [d.key, d.pesoDefault])) as Pesos;
}

export function tierNome(score: number): Complexidade {
  for (const tier of TIERS) {
    if (score >= tier.min && score < tier.max) return tier.nome;
  }
  return score < 1 ? "Baixa" : "Muito Alta";
}

/** Média ponderada só das dimensões já respondidas (permite prévia parcial); null se nenhuma. */
export function scoreFinal(respostas: Respostas, pesos: Pesos): number | null {
  let somaPeso = 0;
  let somaPonderada = 0;
  let algum = false;
  for (const d of DIMENSOES) {
    const valor = respostas[d.key];
    if (typeof valor === "number") {
      algum = true;
      const peso = pesos[d.key] || 1;
      somaPeso += peso;
      somaPonderada += valor * peso;
    }
  }
  return algum ? somaPonderada / somaPeso : null;
}

export function dimensoesCriticas(respostas: Respostas) {
  return DIMENSOES.filter((d) => (respostas[d.key] ?? 0) >= 3)
    .map((d) => ({ key: d.key, nome: d.nome, valor: respostas[d.key] as NotaDimensao }))
    .sort((a, b) => b.valor - a.valor);
}

/**
 * Até 3 consultores com nível >= o mínimo, mais vagas primeiro (empate: quem
 * tem menos clientes de alta/muito alta complexidade). Se ninguém atinge o
 * nível, devolve os de maior nível disponível com `abaixoDoNivel`.
 */
export function consultoresAptos(nivelMinimo: NivelCertificacao, lista: Consultor[] = CONSULTORES_SEED) {
  const ordemMin = NIVEL_ORDEM[nivelMinimo] || 1;
  const ativos = lista.filter((c) => c.status === "Ativo");
  let elegiveis = ativos.filter((c) => (NIVEL_ORDEM[c.nivel] || 0) >= ordemMin);
  let abaixoDoNivel = false;
  if (elegiveis.length === 0) {
    abaixoDoNivel = true;
    const maxOrdem = ativos.reduce((m, c) => Math.max(m, NIVEL_ORDEM[c.nivel] || 0), 0);
    elegiveis = ativos.filter((c) => (NIVEL_ORDEM[c.nivel] || 0) === maxOrdem);
  }
  elegiveis = [...elegiveis].sort((a, b) => {
    const vagasDiff = (b.vagas || 0) - (a.vagas || 0);
    if (vagasDiff !== 0) return vagasDiff;
    return a.clientesAlta + a.clientesMuitoAlta - (b.clientesAlta + b.clientesMuitoAlta);
  });
  return { lista: elegiveis.slice(0, 3), abaixoDoNivel };
}

/**
 * contratos.grau_dificuldade só aceita BAIXO/MEDIO/ALTO (check constraint),
 * mas a ferramenta tem 4 faixas — "Muito Alta" cai em ALTO. A faixa exata
 * continua guardada em avaliacoes_complexidade.complexidade.
 */
export function complexidadeParaGrau(complexidade: Complexidade): GrauDificuldade {
  switch (complexidade) {
    case "Baixa":
      return "BAIXO";
    case "Média":
      return "MEDIO";
    default:
      return "ALTO";
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuidValido(valor: string | null | undefined): string | undefined {
  return valor && UUID_REGEX.test(valor) ? valor : undefined;
}

/** Só aceita caminho interno ("/algo") — evita open redirect via ?redirect_to=https://... ou //host. */
export function redirectSeguro(valor: string | null | undefined): string | undefined {
  if (!valor) return undefined;
  if (!valor.startsWith("/") || valor.startsWith("//") || valor.includes("\\")) return undefined;
  return valor;
}

export function planoPorNome(nome: string | null | undefined): PlanoComplexidade | undefined {
  if (!nome) return undefined;
  const alvo = nome.trim().toLowerCase();
  return PLANOS_COMPLEXIDADE.find((p) => p.toLowerCase() === alvo);
}

export function resumoResultado(resultado: Pick<ResultadoComplexidade, "score" | "complexidade">): string {
  const score = resultado.score.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `Score ${score} · Complexidade ${resultado.complexidade}`;
}

/**
 * Lê o resultado devolvido via redirect (?avaliacao_id=&grau=&score=&complexidade=)
 * — o caminho alternativo ao BroadcastChannel, usado quando a ferramenta foi
 * aberta na mesma aba. Valida tudo: a URL é input do usuário.
 */
export function lerResultadoDaUrl(search: string): ResultadoComplexidade | null {
  const p = new URLSearchParams(search);
  const avaliacaoId = uuidValido(p.get("avaliacao_id"));
  const grau = p.get("grau");
  const complexidade = p.get("complexidade");
  const score = Number(p.get("score"));
  if (!avaliacaoId || !Number.isFinite(score) || score < 1 || score > 4) return null;
  if (!(GRAUS_DIFICULDADE as readonly string[]).includes(grau ?? "")) return null;
  if (!(COMPLEXIDADES as readonly string[]).includes(complexidade ?? "")) return null;
  return {
    avaliacao_id: avaliacaoId,
    form_id: null,
    cliente_nome: "",
    score,
    complexidade: complexidade as Complexidade,
    grau_dificuldade: grau as GrauDificuldade,
  };
}
