"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAvaliacoesComplexidade,
  useNomesParaAvaliacao,
  useSalvarAvaliacaoComplexidade,
} from "@/lib/queries";
import { cn, formatDate } from "@/lib/utils";
import {
  DIMENSOES,
  MULTIPLICADOR,
  NIVEL_MINIMO,
  PLANOS_COMPLEXIDADE,
  TOTAL_DIMENSOES,
  complexidadeParaGrau,
  consultoresAptos,
  dimensoesCriticas,
  pesosPadrao,
  scoreFinal,
  tierNome,
  type AvaliacaoComplexidade,
  type Complexidade,
  type DimensaoKey,
  type DimensaoRegistrada,
  type NotaDimensao,
  type Pesos,
  type PlanoComplexidade,
  type Respostas,
  type ResultadoComplexidade,
} from "@/lib/ferramentas/indice-complexidade";

const TIER_BADGE: Record<Complexidade, BadgeProps["variant"]> = {
  Baixa: "success",
  Média: "info",
  Alta: "warning",
  "Muito Alta": "destructive",
};

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtNumero(valor: number, casas: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export interface IndiceComplexidadeProps {
  clienteName?: string;
  /** Token (uuid) do formulário que pediu a avaliação — gravado em avaliacoes_complexidade.form_id. */
  formId?: string;
  planoInicial?: PlanoComplexidade;
  onResultado?: (resultado: ResultadoComplexidade) => void;
  onVoltar?: () => void;
  voltarLabel?: string;
}

export function IndiceComplexidade({
  clienteName,
  formId,
  planoInicial,
  onResultado,
  onVoltar,
  voltarLabel = "Voltar",
}: IndiceComplexidadeProps) {
  const [aba, setAba] = useState<"novo" | "historico">("novo");
  const [cliente, setCliente] = useState(clienteName ?? "");
  const [consultor, setConsultor] = useState("");
  const [data, setData] = useState(hojeISO);
  const [plano, setPlano] = useState<PlanoComplexidade | "">(planoInicial ?? "");
  const [respostas, setRespostas] = useState<Respostas>({});
  const [pesos, setPesos] = useState<Pesos>(pesosPadrao);
  const [salvo, setSalvo] = useState<ResultadoComplexidade | null>(null);

  const salvar = useSalvarAvaliacaoComplexidade();
  const { data: nomes } = useNomesParaAvaliacao();

  const respondidas = Object.keys(respostas).length;
  const score = useMemo(() => scoreFinal(respostas, pesos), [respostas, pesos]);
  const tier = score === null ? null : tierNome(score);
  const criticas = useMemo(() => dimensoesCriticas(respostas), [respostas]);
  const nivelMinimo = tier && plano ? NIVEL_MINIMO[plano][tier] : null;
  const aptos = useMemo(() => (nivelMinimo ? consultoresAptos(nivelMinimo) : null), [nivelMinimo]);

  const completo = respondidas === TOTAL_DIMENSOES;
  const podeSalvar = completo && cliente.trim().length > 0 && !salvar.isPending;

  // Qualquer mudança depois de salvar deixa a avaliação gravada defasada da
  // tela — some o "salvo" pra obrigar a salvar de novo em vez de devolver ao
  // chamador um resultado que não é mais o que está na tela.
  function selecionar(key: DimensaoKey, valor: NotaDimensao) {
    setRespostas((r) => ({ ...r, [key]: valor }));
    setSalvo(null);
  }

  function limpar() {
    if (respondidas === 0) return;
    setRespostas({});
    setSalvo(null);
  }

  async function salvarAvaliacao() {
    if (score === null || tier === null || !podeSalvar) return;

    const dimensoes: Partial<Record<DimensaoKey, DimensaoRegistrada>> = {};
    for (const d of DIMENSOES) {
      dimensoes[d.key] = { nome: d.nome, valor: respostas[d.key] as NotaDimensao, peso: pesos[d.key] };
    }
    const sugeridos = nivelMinimo ? consultoresAptos(nivelMinimo).lista.map((c) => c.nome) : [];

    try {
      const gravada = await salvar.mutateAsync({
        form_id: formId ?? null,
        cliente_nome: cliente.trim(),
        consultor: consultor.trim() || null,
        data_avaliacao: data,
        plano: plano || null,
        score: Math.round(score * 100) / 100,
        complexidade: tier,
        nivel_minimo_exigido: nivelMinimo,
        consultores_sugeridos: sugeridos,
        multiplicador: MULTIPLICADOR[tier],
        dimensoes,
      });

      const resultado: ResultadoComplexidade = {
        avaliacao_id: gravada.id,
        form_id: formId ?? null,
        cliente_nome: gravada.cliente_nome,
        score: Number(gravada.score),
        complexidade: tier,
        grau_dificuldade: complexidadeParaGrau(tier),
      };
      setSalvo(resultado);
      onResultado?.(resultado);
      toast.success(`Avaliação salva — Complexidade ${tier}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar avaliação");
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-28">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-secondary dark:text-brand-accent">
              Método G+ · Eleve+
            </span>
            <h1 className="text-2xl font-bold">Índice de Complexidade do Cliente</h1>
          </div>
          {onVoltar && (
            <Button type="button" variant="outline" size="sm" onClick={onVoltar}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {voltarLabel}
            </Button>
          )}
        </div>
        <p className="max-w-[64ch] text-sm text-muted-foreground">
          Aplique no onboarding e nas reavaliações trimestrais para orientar a alocação do consultor certo e o
          adicional de remuneração devido pela complexidade do cliente.
        </p>
      </header>

      <datalist id="lista-clientes-avaliacao">
        {(nomes ?? []).map((nome) => (
          <option key={nome} value={nome} />
        ))}
      </datalist>

      <Tabs value={aba} onValueChange={(v) => setAba(v as "novo" | "historico")}>
        <TabsList>
          <TabsTrigger value="novo">Nova avaliação</TabsTrigger>
          <TabsTrigger value="historico">Histórico do cliente</TabsTrigger>
        </TabsList>

        <TabsContent value="novo" className="mt-4 flex flex-col gap-4">
          <Card className="flex flex-col gap-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Campo id="in-cliente" label="Empresa / cliente">
                <Input
                  id="in-cliente"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Nome da empresa"
                  list="lista-clientes-avaliacao"
                  autoComplete="off"
                />
              </Campo>
              <Campo id="in-consultor" label="Consultor">
                <Input
                  id="in-consultor"
                  value={consultor}
                  onChange={(e) => setConsultor(e.target.value)}
                  placeholder="Seu nome"
                />
              </Campo>
              <Campo id="in-data" label="Data da avaliação">
                <Input id="in-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </Campo>
              <Campo id="in-plano" label="Plano contratado">
                <Select
                  value={plano}
                  onValueChange={(v) => {
                    setPlano(v as PlanoComplexidade);
                    setSalvo(null);
                  }}
                >
                  <SelectTrigger id="in-plano">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANOS_COMPLEXIDADE.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
            </div>
            <p className="text-xs text-muted-foreground">
              Para cada dimensão, escolha a opção que melhor descreve o cliente hoje. Dimensões marcadas{" "}
              <TagPeso>peso 16</TagPeso> pesam mais no score porque geram mais trabalho real de consultoria. Os
              pesos somam 100 no total (5 dimensões × 16 + 2 dimensões × 10).
            </p>
          </Card>

          {DIMENSOES.map((d) => (
            <Card key={d.key} className="flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-[220px] flex-col gap-1">
                  <h3 className="flex items-center gap-2 text-base font-semibold">
                    {d.nome}
                    {d.pesoAlto && <TagPeso>peso {d.pesoDefault}</TagPeso>}
                  </h3>
                  {d.nota && <span className="max-w-[56ch] text-xs text-muted-foreground">{d.nota}</span>}
                </div>
                <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  Peso
                  <input
                    type="number"
                    min={1}
                    max={30}
                    step={1}
                    defaultValue={d.pesoDefault}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setPesos((p) => ({ ...p, [d.key]: Number.isNaN(v) || v <= 0 ? d.pesoDefault : v }));
                      setSalvo(null);
                    }}
                    className="h-8 w-14 rounded-md border border-input bg-background px-1 text-center font-mono text-sm"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-2">
                {d.opcoes.map((op) => {
                  const ativa = respostas[d.key] === op.n;
                  return (
                    <button
                      key={op.n}
                      type="button"
                      aria-pressed={ativa}
                      onClick={() => selecionar(d.key, op.n)}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        ativa ? "border-primary bg-accent" : "bg-background hover:border-foreground/30"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-semibold",
                          ativa
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-card text-muted-foreground"
                        )}
                      >
                        {op.n}
                      </span>
                      <span className="pt-0.5 text-sm leading-snug">{op.texto}</span>
                    </button>
                  );
                })}
              </div>
            </Card>
          ))}

          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-baseline gap-2">
              <h2 className="text-lg font-semibold">Resultado</h2>
              <span className="text-xs text-muted-foreground">atualiza conforme você responde</span>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.15fr_1fr]">
              <div>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-4xl font-semibold leading-none">
                    {score === null ? "—" : fmtNumero(score, 1)}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-brand-secondary dark:text-brand-accent">
                      {tier ? `Complexidade ${tier}` : "Aguardando respostas"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {score === null
                        ? "Responda todas as dimensões para ver o score final ponderado"
                        : completo
                          ? `Score final ponderado das ${TOTAL_DIMENSOES} dimensões`
                          : `Prévia com ${respondidas} de ${TOTAL_DIMENSOES} respostas`}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  {DIMENSOES.map((d) => {
                    const v = respostas[d.key];
                    const critica = typeof v === "number" && v >= 3;
                    return (
                      <div key={d.key} className="flex items-center gap-2.5">
                        <span className="w-40 shrink-0 text-xs text-muted-foreground">{d.nome}</span>
                        <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-[width]",
                              critica ? "bg-destructive" : "bg-primary"
                            )}
                            style={{ width: `${typeof v === "number" ? (v / 4) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground">
                          {typeof v === "number" ? v : "–"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {score !== null &&
                  tier &&
                  (plano && nivelMinimo && aptos ? (
                    <div className="rounded-lg bg-accent p-3 text-sm leading-relaxed text-accent-foreground">
                      <b className="mb-1 block text-xs uppercase tracking-wide">
                        Consultores aptos para este cliente
                      </b>
                      Plano {plano} + Complexidade {tier} exige no mínimo <strong>{nivelMinimo}</strong>.{" "}
                      {aptos.abaixoDoNivel
                        ? "Nenhum consultor ativo está hoje no nível exigido — mostrando os mais próximos disponíveis:"
                        : "Consultores recomendados, do maior para o menor número de vagas:"}
                      <ul className="mt-1.5 list-disc space-y-1 pl-5">
                        {aptos.lista.length === 0 && <li>Nenhum consultor ativo cadastrado.</li>}
                        {aptos.lista.map((c) => {
                          const complexos = c.clientesAlta + c.clientesMuitoAlta;
                          return (
                            <li key={c.id}>
                              <strong>{c.nome}</strong> — {c.nivel} ·{" "}
                              {c.vagas <= 0 ? (
                                <span className="font-semibold text-destructive">sem vaga no momento</span>
                              ) : (
                                `${c.vagas} vaga(s) disponível(is)`
                              )}{" "}
                              · carteira atual: {c.clientesTotal}
                              {complexos > 0 && ` (${complexos} de alta/muito alta complexidade)`}
                            </li>
                          );
                        })}
                      </ul>
                      <div className="mt-2">
                        Multiplicador de remuneração sugerido:{" "}
                        <span className="font-mono font-semibold">{fmtNumero(MULTIPLICADOR[tier], 2)}x</span>.
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground">
                      <b className="mb-1 block text-xs uppercase tracking-wide">
                        Consultores aptos para este cliente
                      </b>
                      Selecione o plano contratado para ver quais consultores têm formação e vaga disponível, e
                      o multiplicador de remuneração recomendado.
                    </div>
                  ))}

                {criticas.length > 0 ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm leading-relaxed">
                    <b className="mb-1 block text-xs uppercase tracking-wide text-destructive">
                      Fatores que mais elevam a complexidade
                    </b>
                    {criticas.map((c) => `${c.nome} (nível ${c.valor})`).join(", ")}.
                  </div>
                ) : score !== null ? (
                  <div className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground">
                    Nenhuma dimensão em nível crítico (3 ou 4) até aqui.
                  </div>
                ) : (
                  <div className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground">
                    A recomendação de alocação e os fatores de maior complexidade aparecem aqui assim que houver
                    respostas.
                  </div>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <HistoricoCliente clienteInicial={clienteName ?? ""} />
        </TabsContent>
      </Tabs>

      {aba === "novo" && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t bg-card px-4 py-3 shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.35)] lg:left-64">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-sm text-muted-foreground">
              {respondidas} / {TOTAL_DIMENSOES} dimensões respondidas
            </span>
            <div className="h-1.5 w-44 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width]"
                style={{ width: `${Math.round((respondidas / TOTAL_DIMENSOES) * 100)}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
            {salvo && (
              <span className="text-sm font-semibold text-success">
                Avaliação salva ✓ · Complexidade {salvo.complexidade}
              </span>
            )}
            <Button type="button" variant="outline" onClick={limpar} className="max-sm:flex-1">
              Limpar
            </Button>
            {onVoltar && (
              <Button type="button" variant={salvo ? "default" : "outline"} onClick={onVoltar} className="max-sm:flex-1">
                {voltarLabel}
              </Button>
            )}
            <Button type="button" onClick={salvarAvaliacao} disabled={!podeSalvar} className="max-sm:flex-1">
              {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar avaliação
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function TagPeso({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-accent px-2 py-0.5 font-mono text-[10.5px] font-semibold text-accent-foreground">
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Aba "Histórico do cliente"
// ---------------------------------------------------------------------------

function HistoricoCliente({ clienteInicial }: { clienteInicial: string }) {
  const [busca, setBusca] = useState(clienteInicial);
  const [consultado, setConsultado] = useState<string | null>(null);
  const { data: linhas, isLoading, error } = useAvaliacoesComplexidade(consultado);

  function buscar() {
    const nome = busca.trim();
    setConsultado(nome || null);
  }

  let status = "Informe o nome de um cliente já avaliado.";
  if (consultado) {
    if (isLoading) status = "Buscando…";
    else if (error) status = `Erro na busca: ${error instanceof Error ? error.message : "tente novamente"}`;
    else if (!linhas || linhas.length === 0) status = `Nenhuma avaliação salva para "${consultado}" ainda.`;
    else status = `${linhas.length} avaliação(ões) encontrada(s).`;
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <label htmlFor="hist-cliente" className="text-xs font-semibold text-muted-foreground">
            Empresa / cliente
          </label>
          <Input
            id="hist-cliente"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
            placeholder="Nome da empresa"
            list="lista-clientes-avaliacao"
            autoComplete="off"
          />
        </div>
        <Button type="button" onClick={buscar}>
          Ver histórico
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">{status}</p>

      {consultado && isLoading && <Skeleton className="h-40 w-full" />}

      {linhas && linhas.length > 0 && (
        <>
          <GraficoEvolucao linhas={linhas} />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Consultor</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Complexidade</TableHead>
                <TableHead>Consultores sugeridos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDate(r.data_avaliacao)}</TableCell>
                  <TableCell>{r.consultor || "–"}</TableCell>
                  <TableCell>{r.plano || "–"}</TableCell>
                  <TableCell className="font-mono">{fmtNumero(Number(r.score), 1)}</TableCell>
                  <TableCell>
                    <Badge variant={TIER_BADGE[r.complexidade]}>{r.complexidade}</Badge>
                  </TableCell>
                  <TableCell>
                    {r.consultores_sugeridos && r.consultores_sugeridos.length > 0
                      ? r.consultores_sugeridos.join(", ")
                      : "–"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <RespostasPorAvaliacao linhas={linhas} />
        </>
      )}
    </Card>
  );
}

function GraficoEvolucao({ linhas }: { linhas: AvaliacaoComplexidade[] }) {
  const w = 640;
  const h = 200;
  const padL = 30;
  const padR = 16;
  const padT = 16;
  const padB = 30;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const x = (i: number) => padL + (linhas.length === 1 ? innerW / 2 : (i / (linhas.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / 4) * innerH;
  const caminho = linhas
    .map((r, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(Number(r.score)).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-auto w-full overflow-visible"
      role="img"
      aria-label="Evolução do score de complexidade ao longo do tempo"
    >
      {[1, 2, 3, 4].map((v) => (
        <g key={v}>
          <line x1={padL} x2={w - padR} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={1} />
          <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize={10.5} className="fill-muted-foreground font-mono">
            {v}
          </text>
        </g>
      ))}
      <path d={caminho} fill="none" className="stroke-primary" strokeWidth={2} />
      {linhas.map((r, i) => (
        <g key={r.id}>
          <circle cx={x(i)} cy={y(Number(r.score))} r={4} className="fill-primary" />
          <text
            x={x(i)}
            y={y(Number(r.score)) - 10}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            className="fill-foreground font-mono"
          >
            {fmtNumero(Number(r.score), 1)}
          </text>
          <text x={x(i)} y={h - 8} textAnchor="middle" fontSize={10} className="fill-muted-foreground">
            {formatDate(r.data_avaliacao)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function RespostasPorAvaliacao({ linhas }: { linhas: AvaliacaoComplexidade[] }) {
  const maisRecentesPrimeiro = [...linhas].reverse();

  return (
    <div className="flex flex-col gap-2">
      <h3 className="mt-1 text-sm font-semibold">Respostas por avaliação</h3>
      {maisRecentesPrimeiro.map((r, idx) => (
        <details key={r.id} open={idx === 0} className="group rounded-lg border bg-muted/40">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
            <span className="text-muted-foreground group-open:hidden">▸</span>
            <span className="hidden text-muted-foreground group-open:inline">▾</span>
            <span className="font-semibold">{formatDate(r.data_avaliacao)}</span>
            <span className="text-xs text-muted-foreground">
              Score {fmtNumero(Number(r.score), 1)} · Complexidade {r.complexidade}
              {r.plano && ` · Plano ${r.plano}`}
              {r.consultor && ` · ${r.consultor}`}
            </span>
          </summary>

          <div className="flex flex-col gap-2.5 px-3.5 pb-3.5">
            {DIMENSOES.map((d) => {
              const registro = r.dimensoes?.[d.key];
              const valor = registro && typeof registro.valor === "number" ? registro.valor : null;
              const opcao = valor === null ? undefined : d.opcoes.find((op) => op.n === valor);
              return (
                <div key={d.key} className="flex flex-col gap-1 border-t pt-2.5 first:border-t-0 first:pt-0.5">
                  <div className="text-xs font-semibold text-muted-foreground">{d.nome}</div>
                  {opcao && valor !== null ? (
                    <div className="flex items-start gap-2 text-sm leading-snug">
                      <span
                        className={cn(
                          "mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full font-mono text-[11.5px] font-semibold",
                          valor >= 3 ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
                        )}
                      >
                        {valor}
                      </span>
                      <span>{opcao.texto}</span>
                    </div>
                  ) : (
                    <div className="text-sm italic text-muted-foreground">
                      Não respondida nesta avaliação (pergunta incluída depois).
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}
