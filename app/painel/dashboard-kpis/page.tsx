"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RefreshCw, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabelaKpis } from "@/components/dashboard/tabela-kpis";
import { TabelaMensalidadesCliente } from "@/components/dashboard/tabela-mensalidades-cliente";
import { useDashboardKPIs, useMensalidadesPorCliente, useUNEs } from "@/lib/queries";
import { hasAccess } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { TIPOS_PAGAMENTO, type TipoContratoFiltro } from "@/lib/types";

const OPCOES_PERIODO = [
  { value: "6", label: "Últimos 6 meses" },
  { value: "12", label: "Últimos 12 meses" },
  { value: "24", label: "Últimos 24 meses" },
];

const TIPO_PAGAMENTO_LABEL: Record<TipoContratoFiltro, string> = {
  TODOS: "Todos os tipos",
  recorrente: "Recorrente",
  venda_unica: "Venda Única",
  parcelado: "Parcelado",
};

const TIPO_CONTRATO_MENSALIDADES_LABEL: Record<TipoContratoFiltro, string> = {
  TODOS: "Todos",
  recorrente: "Contratos Mensais",
  venda_unica: "Contratos à Vista",
  parcelado: "Contratos Parcelados",
};

export default function DashboardKPIsPage() {
  const router = useRouter();
  const [acessoLiberado, setAcessoLiberado] = useState<boolean | null>(null);

  const [periodo, setPeriodo] = useState("12");
  const [anoVigente, setAnoVigente] = useState(false);
  const [apenasProjetado, setApenasProjetado] = useState(false);
  const [tipoPagamento, setTipoPagamento] = useState<TipoContratoFiltro>("TODOS");

  const [uneIdMensalidades, setUneIdMensalidades] = useState<string | null>(null);
  const [tipoContratoMensalidades, setTipoContratoMensalidades] = useState<TipoContratoFiltro>("TODOS");

  const [buscaCliente, setBuscaCliente] = useState("");
  const [buscaClienteDebounced, setBuscaClienteDebounced] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setBuscaClienteDebounced(buscaCliente), 300);
    return () => clearTimeout(timeout);
  }, [buscaCliente]);

  useEffect(() => {
    if (hasAccess("dashboard")) {
      setAcessoLiberado(true);
    } else {
      setAcessoLiberado(false);
      router.push("/painel/clientes");
    }
  }, [router]);

  const { data, isLoading, isFetching, isError, refetch } = useDashboardKPIs({
    quantidadeMeses: Number(periodo),
    anoVigente,
    apenasProjetado,
    tipoPagamento,
  });

  const { data: unes } = useUNEs();
  const anoAtual = new Date().getFullYear();
  const { data: mensalidades, isLoading: carregandoMensalidades } = useMensalidadesPorCliente(
    uneIdMensalidades,
    tipoContratoMensalidades,
    anoAtual
  );

  const linhasMensalidadesFiltradas = useMemo(() => {
    if (!mensalidades) return [];
    const termo = buscaClienteDebounced.trim().toLowerCase();
    if (!termo) return mensalidades.linhas;
    return mensalidades.linhas.filter(
      (linha) =>
        linha.cliente_nome.toLowerCase().includes(termo) ||
        linha.cliente_cnpj.toLowerCase().includes(termo)
    );
  }, [mensalidades, buscaClienteDebounced]);

  useEffect(() => {
    if (!uneIdMensalidades && unes && unes.length > 0) {
      setUneIdMensalidades(unes[0].id);
    }
  }, [unes, uneIdMensalidades]);

  if (!acessoLiberado) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard - Análise Mês a Mês</h1>
        <p className="text-sm text-muted-foreground">Visão consolidada e por UNE, mês a mês.</p>
      </div>

      <Tabs defaultValue="por-une">
        <TabsList>
          <TabsTrigger value="por-une">Dashboard por UNE</TabsTrigger>
          <TabsTrigger value="mensalidades">Mensalidades por Cliente</TabsTrigger>
        </TabsList>

        <TabsContent value="por-une" className="space-y-6 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <Select value={periodo} onValueChange={setPeriodo} disabled={anoVigente}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPCOES_PERIODO.map((opcao) => (
                    <SelectItem key={opcao.value} value={opcao.value}>
                      {opcao.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={tipoPagamento} onValueChange={(v) => setTipoPagamento(v as TipoContratoFiltro)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">{TIPO_PAGAMENTO_LABEL.TODOS}</SelectItem>
                  {TIPOS_PAGAMENTO.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {TIPO_PAGAMENTO_LABEL[tipo]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={apenasProjetado}
                  onCheckedChange={(v) => setApenasProjetado(v === true)}
                />
                Projetados
              </label>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={anoVigente} onCheckedChange={(v) => setAnoVigente(v === true)} />
                Ano Vigente
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
                Atualizar
              </Button>

              <Button variant="outline" disabled title="Em breve">
                Exportar Excel
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-8">
              <Skeleton className="h-56 w-full" />
              <Skeleton className="h-56 w-full" />
            </div>
          ) : isError || !data ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Não foi possível carregar os dados do dashboard.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-10">
              <TabelaKpis
                titulo="Consolidado (Todas as UNEs)"
                meses={data.periodo.meses}
                dados={data.consolidado}
              />

              {data.por_une.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma UNE ativa cadastrada.</p>
              ) : (
                data.por_une.map((une) => (
                  <TabelaKpis key={une.une_id} titulo={une.une_nome} meses={data.periodo.meses} dados={une} />
                ))
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mensalidades" className="space-y-6 pt-2">
          <div>
            <h2 className="text-lg font-semibold">Mensalidades por Cliente</h2>
            <p className="text-sm text-muted-foreground">Ano {anoAtual}, mês a mês.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select value={uneIdMensalidades ?? undefined} onValueChange={setUneIdMensalidades}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Selecione a UNE" />
              </SelectTrigger>
              <SelectContent>
                {(unes ?? []).map((une) => (
                  <SelectItem key={une.id} value={une.id}>
                    {une.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={tipoContratoMensalidades}
              onValueChange={(v) => setTipoContratoMensalidades(v as TipoContratoFiltro)}
            >
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">{TIPO_CONTRATO_MENSALIDADES_LABEL.TODOS}</SelectItem>
                {TIPOS_PAGAMENTO.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {TIPO_CONTRATO_MENSALIDADES_LABEL[tipo]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative w-full max-w-[300px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Pesquisar cliente..."
                className="pl-9 pr-9"
                value={buscaCliente}
                onChange={(e) => setBuscaCliente(e.target.value)}
              />
              {buscaCliente && (
                <button
                  type="button"
                  onClick={() => setBuscaCliente("")}
                  title="Limpar busca"
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {!uneIdMensalidades ? (
            <p className="text-sm text-muted-foreground">Selecione uma UNE.</p>
          ) : carregandoMensalidades ? (
            <Skeleton className="h-64 w-full" />
          ) : !mensalidades || mensalidades.linhas.length === 0 ? (
            <Card>
              <CardContent className="space-y-3 py-8 text-center">
                <p className="text-muted-foreground">Sem clientes nesta UNE.</p>
                <Button asChild variant="outline">
                  <Link href="/formulario">Criar novo cliente</Link>
                </Button>
              </CardContent>
            </Card>
          ) : linhasMensalidadesFiltradas.length === 0 ? (
            <Card>
              <CardContent className="space-y-3 py-8 text-center">
                <p className="text-muted-foreground">Nenhum cliente encontrado.</p>
                <p className="text-sm text-muted-foreground">Tente outro termo.</p>
                <Button variant="outline" onClick={() => setBuscaCliente("")}>
                  Limpar filtro
                </Button>
              </CardContent>
            </Card>
          ) : (
            <TabelaMensalidadesCliente meses={mensalidades.meses} linhas={linhasMensalidadesFiltradas} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
