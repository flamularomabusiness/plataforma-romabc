"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, FileText, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DropzoneDocumentos } from "@/components/documentos/dropzone-documentos";
import {
  useContratoDocumentos,
  useUploadContratoDocumento,
  useDeleteContratoDocumento,
  getContratoDocumentoUrl,
} from "@/lib/queries";
import { getUserId } from "@/lib/auth";
import type { ContratoDocumento, TipoDocumento } from "@/lib/types";

function formatarTamanho(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function ListaDocumentos({
  documentos,
  onExcluir,
  excluindoId,
}: {
  documentos: ContratoDocumento[];
  onExcluir: (documento: ContratoDocumento) => void;
  excluindoId: string | null;
}) {
  const [baixandoId, setBaixandoId] = useState<string | null>(null);

  async function baixar(documento: ContratoDocumento) {
    setBaixandoId(documento.id);
    try {
      const url = await getContratoDocumentoUrl(documento.caminho_storage);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao gerar link de download");
    } finally {
      setBaixandoId(null);
    }
  }

  if (documentos.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum documento anexado.</p>;
  }

  return (
    <ul className="space-y-1">
      {documentos.map((documento) => (
        <li
          key={documento.id}
          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
        >
          <span className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{documento.nome_arquivo}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatarTamanho(documento.tamanho_bytes)}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => baixar(documento)}
              disabled={baixandoId === documento.id}
              aria-label={`Baixar ${documento.nome_arquivo}`}
            >
              {baixandoId === documento.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onExcluir(documento)}
              disabled={excluindoId === documento.id}
              aria-label={`Remover ${documento.nome_arquivo}`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </span>
        </li>
      ))}
    </ul>
  );
}

function BlocoTipoDocumento({
  contratoId,
  tipo,
  titulo,
  documentos,
}: {
  contratoId: string;
  tipo: TipoDocumento;
  titulo: string;
  documentos: ContratoDocumento[];
}) {
  const upload = useUploadContratoDocumento(contratoId);
  const deletar = useDeleteContratoDocumento(contratoId);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  async function enviar(files: File[]) {
    const uploadedBy = getUserId();
    if (!uploadedBy) {
      toast.error("Sessão expirada — recarregue a página e tente novamente");
      return;
    }
    for (const file of files) {
      try {
        await upload.mutateAsync({ tipo, file, uploadedBy });
      } catch (error) {
        toast.error(
          `${file.name}: ${error instanceof Error ? error.message : "Erro ao enviar documento"}`
        );
      }
    }
  }

  async function excluir(documento: ContratoDocumento) {
    setExcluindoId(documento.id);
    try {
      await deletar.mutateAsync({ id: documento.id, caminhoStorage: documento.caminho_storage });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao remover documento");
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">{titulo}</h4>
      <DropzoneDocumentos onArquivosSelecionados={enviar} desabilitado={upload.isPending} />
      <ListaDocumentos documentos={documentos} onExcluir={excluir} excluindoId={excluindoId} />
    </div>
  );
}

export function CardDocumentos({ contratoId, produtoNome }: { contratoId: string; produtoNome: string }) {
  const { data: documentos, isLoading } = useContratoDocumentos(contratoId);

  const documentosEmpresa = (documentos ?? []).filter((d) => d.tipo === "empresa");
  const documentosCliente = (documentos ?? []).filter((d) => d.tipo === "cliente");

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <p className="text-sm font-medium text-muted-foreground">{produtoNome}</p>
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <BlocoTipoDocumento
            contratoId={contratoId}
            tipo="empresa"
            titulo="Documentos da Empresa"
            documentos={documentosEmpresa}
          />
          <BlocoTipoDocumento
            contratoId={contratoId}
            tipo="cliente"
            titulo="Documentos do Cliente (Pessoa)"
            documentos={documentosCliente}
          />
        </div>
      )}
    </div>
  );
}
