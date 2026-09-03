"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UploadArea } from "@/components/importar-dados/upload-area";
import { PreviewTabela } from "@/components/importar-dados/preview-tabela";
import { HistoricoImportacoes } from "@/components/importar-dados/historico-importacoes";
import { hasAccess, useUserRole } from "@/lib/auth";
import { useProdutos, useUNEs, useImportarDadosExcel } from "@/lib/queries";
import { formatBRL, formatDate } from "@/lib/utils";
import {
  lerPlanilhaExcel,
  validarLinhasClientes,
  validarLinhasPagamentos,
  construirPreview,
  verificarColunasObrigatorias,
  COLUNAS_CLIENTES_OBRIGATORIAS,
  COLUNAS_PAGAMENTOS_OBRIGATORIAS,
} from "@/lib/excel-import";
import type { ImportPreview } from "@/lib/types";

type Etapa = "upload" | "preview" | "resultado";

interface ResultadoImport {
  sucesso: boolean;
  mensagem: string;
  clientes?: number;
  pagamentos?: number;
}

export default function ImportarDadosPage() {
  const router = useRouter();
  const [acessoLiberado, setAcessoLiberado] = useState<boolean | null>(null);
  const userRole = useUserRole();

  useEffect(() => {
    if (hasAccess("importarDados")) {
      setAcessoLiberado(true);
    } else {
      setAcessoLiberado(false);
      router.push("/painel/clientes");
    }
  }, [router]);

  const [etapa, setEtapa] = useState<Etapa>("upload");
  const [carregandoArquivo, setCarregandoArquivo] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);

  const { data: unes, isLoading: carregandoUnes } = useUNEs();
  const { data: produtos, isLoading: carregandoProdutos } = useProdutos();
  const importar = useImportarDadosExcel();

  const referenciaPronta = !carregandoUnes && !carregandoProdutos && !!unes && !!produtos;

  async function handleArquivo(file: File) {
    if (!referenciaPronta || !unes || !produtos) {
      toast.error("Aguarde carregar dados de referência (UNEs/Produtos) e tente novamente.");
      return;
    }
    setCarregandoArquivo(true);
    try {
      const { clientesBrutos, pagamentosBrutos } = await lerPlanilhaExcel(file);

      const faltandoClientes = verificarColunasObrigatorias(clientesBrutos, COLUNAS_CLIENTES_OBRIGATORIAS);
      const faltandoPagamentos = verificarColunasObrigatorias(
        pagamentosBrutos,
        COLUNAS_PAGAMENTOS_OBRIGATORIAS
      );
      if (faltandoClientes.length > 0 || faltandoPagamentos.length > 0) {
        const partes: string[] = [];
        if (faltandoClientes.length > 0) {
          partes.push(`CLIENTES (faltando: ${faltandoClientes.join(", ")})`);
        }
        if (faltandoPagamentos.length > 0) {
          partes.push(`PAGAMENTOS (faltando: ${faltandoPagamentos.join(", ")})`);
        }
        toast.error(`Formato inválido — colunas obrigatórias faltando em ${partes.join("; ")}`);
        return;
      }

      const unesValidas = new Set(unes.map((u) => u.nome.toUpperCase()));
      const produtosPorUne = new Map<string, Set<string>>();
      for (const p of produtos) {
        const uneNome = unes.find((u) => u.id === p.une_id)?.nome?.toUpperCase();
        if (!uneNome) continue;
        const set = produtosPorUne.get(uneNome) ?? new Set<string>();
        set.add(p.nome.toUpperCase());
        produtosPorUne.set(uneNome, set);
      }

      const clientesValidados = validarLinhasClientes(clientesBrutos, unesValidas, produtosPorUne);
      const empresasDoArquivo = new Set(clientesValidados.map((l) => l.dados.empresa));
      const pagamentosValidados = validarLinhasPagamentos(pagamentosBrutos, empresasDoArquivo);

      // Debug de datas: compara a célula bruta (como o exceljs devolveu) com
      // o resultado já parseado (o que de fato vai pro payload da API), pra
      // investigar sem achismo qualquer suspeita de dia errado/timezone.
      console.log("[importar-dados] datas — bruto (exceljs) vs parseado, 3 primeiras linhas de PAGAMENTOS:");
      pagamentosBrutos.slice(0, 3).forEach((bruto, i) => {
        const raw = bruto["data vencimento"];
        console.log(`  linha ${i + 1}:`, {
          empresa: bruto["empresa"],
          raw,
          raw_type: raw instanceof Date ? "Date" : typeof raw,
          raw_local: raw instanceof Date ? `${raw.getFullYear()}-${raw.getMonth() + 1}-${raw.getDate()}` : null,
          raw_iso: raw instanceof Date ? raw.toISOString() : null,
          parseado: pagamentosValidados[i]?.dados.data_vencimento ?? null,
        });
      });

      setPreview(construirPreview(file.name, clientesValidados, pagamentosValidados));
      setEtapa("preview");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao ler o arquivo Excel");
    } finally {
      setCarregandoArquivo(false);
    }
  }

  async function confirmarImport() {
    if (!preview || preview.temErro) return;
    try {
      const resultadoRpc = await importar.mutateAsync({
        usuarioRole: userRole,
        nomeArquivo: preview.arquivoNome,
        clientes: preview.clientes.map((l) => l.dados),
        pagamentos: preview.pagamentos.map((l) => l.dados),
      });
      setResultado({
        sucesso: true,
        mensagem: "Importação concluída com sucesso!",
        clientes: resultadoRpc.clientes_importados,
        pagamentos: resultadoRpc.pagamentos_importados,
      });
      setEtapa("resultado");
    } catch (error) {
      setResultado({
        sucesso: false,
        mensagem: error instanceof Error ? error.message : "Erro ao importar dados",
      });
      setEtapa("resultado");
    }
  }

  function reiniciar() {
    setEtapa("upload");
    setPreview(null);
    setResultado(null);
  }

  if (!acessoLiberado) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Importar Dados - Excel</h1>
        <p className="text-sm text-muted-foreground">
          Importe clientes e pagamentos em lote a partir de uma planilha Excel (sheets CLIENTES e
          PAGAMENTOS).
        </p>
      </div>

      {etapa === "upload" && (
        <Card>
          <CardContent className="pt-6">
            <UploadArea
              onArquivoSelecionado={handleArquivo}
              desabilitado={carregandoArquivo || !referenciaPronta}
            />
            {carregandoArquivo && (
              <p className="mt-3 text-sm text-muted-foreground">Lendo e validando arquivo...</p>
            )}
          </CardContent>
        </Card>
      )}

      {etapa === "preview" && preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview — {preview.arquivoNome}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm">
              Vai importar <strong>{preview.clientes.length} clientes</strong> e{" "}
              <strong>{preview.pagamentos.length} pagamentos</strong>.
            </p>

            <PreviewTabela
              titulo="CLIENTES"
              linhas={preview.clientes}
              colunas={[
                { label: "Empresa", render: (d) => d.empresa },
                { label: "CNPJ", render: (d) => d.cnpj },
                { label: "UNE", render: (d) => d.une },
                { label: "Produto", render: (d) => d.produto },
                { label: "Valor", render: (d) => formatBRL(d.valor) },
                { label: "Status", render: (d) => d.status },
                { label: "Data Início", render: (d) => formatDate(d.data_inicio) },
              ]}
            />

            <PreviewTabela
              titulo="PAGAMENTOS"
              linhas={preview.pagamentos}
              colunas={[
                { label: "Empresa", render: (d) => d.empresa },
                { label: "Vencimento", render: (d) => formatDate(d.data_vencimento) },
                { label: "Valor", render: (d) => formatBRL(d.valor) },
                { label: "Status", render: (d) => d.status },
                { label: "Data Pagamento", render: (d) => formatDate(d.data_pagamento) },
              ]}
            />

            {preview.temErro && (
              <p className="font-medium text-destructive">
                Corrija os erros acima no Excel e envie novamente. Nada foi importado.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={confirmarImport} disabled={preview.temErro || importar.isPending}>
                {importar.isPending ? "Importando..." : "Confirmar Import"}
              </Button>
              <Button variant="outline" onClick={reiniciar} disabled={importar.isPending}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {etapa === "resultado" && resultado && (
        <Card>
          <CardContent className="space-y-4 py-8 text-center">
            {resultado.sucesso ? (
              <>
                <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
                <p className="text-lg font-semibold">{resultado.mensagem}</p>
                <p className="text-muted-foreground">
                  {resultado.clientes} clientes importados, {resultado.pagamentos} pagamentos
                  importados.
                </p>
                <div className="flex justify-center gap-2">
                  <Button asChild>
                    <Link href="/painel/clientes">Ver clientes importados</Link>
                  </Button>
                  <Button variant="outline" onClick={reiniciar}>
                    Nova importação
                  </Button>
                </div>
              </>
            ) : (
              <>
                <XCircle className="mx-auto h-12 w-12 text-destructive" />
                <p className="text-lg font-semibold">Erro na importação</p>
                <p className="text-muted-foreground">{resultado.mensagem}</p>
                <p className="text-sm text-muted-foreground">Corrija no Excel e tente novamente.</p>
                <Button variant="outline" onClick={reiniciar}>
                  Voltar para upload
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Imports</CardTitle>
        </CardHeader>
        <CardContent>
          <HistoricoImportacoes />
        </CardContent>
      </Card>
    </div>
  );
}
