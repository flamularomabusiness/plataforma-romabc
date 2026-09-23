"use client";

import { X, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropzoneDocumentos } from "@/components/documentos/dropzone-documentos";

/**
 * Documentos anexados no momento da criação — ainda não têm contrato_id (o
 * contrato só existe depois do submit), então ficam em memória (File[]) até
 * o onSubmit do formulário: o upload de verdade só acontece depois que
 * criarContrato() retorna o contrato_id (ver app/formulario/page.tsx).
 */
function ListaArquivosPendentes({
  arquivos,
  onRemover,
}: {
  arquivos: File[];
  onRemover: (index: number) => void;
}) {
  if (arquivos.length === 0) return null;
  return (
    <ul className="space-y-1">
      {arquivos.map((file, index) => (
        <li
          key={`${file.name}-${index}`}
          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
        >
          <span className="flex items-center gap-2 truncate">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{file.name}</span>
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => onRemover(index)}
            aria-label={`Remover ${file.name}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function SecaoDocumentos({
  arquivosEmpresa,
  arquivosCliente,
  onChangeArquivosEmpresa,
  onChangeArquivosCliente,
}: {
  arquivosEmpresa: File[];
  arquivosCliente: File[];
  onChangeArquivosEmpresa: (files: File[]) => void;
  onChangeArquivosCliente: (files: File[]) => void;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Documentos da Empresa</h3>
          <p className="text-sm text-muted-foreground">Documentos sigilosos — só o painel privado exibe.</p>
        </div>
        <DropzoneDocumentos
          onArquivosSelecionados={(novos) => onChangeArquivosEmpresa([...arquivosEmpresa, ...novos])}
        />
        <ListaArquivosPendentes
          arquivos={arquivosEmpresa}
          onRemover={(index) => onChangeArquivosEmpresa(arquivosEmpresa.filter((_, i) => i !== index))}
        />
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Documentos do Cliente (Pessoa)</h3>
          <p className="text-sm text-muted-foreground">Documentos sigilosos — só o painel privado exibe.</p>
        </div>
        <DropzoneDocumentos
          onArquivosSelecionados={(novos) => onChangeArquivosCliente([...arquivosCliente, ...novos])}
        />
        <ListaArquivosPendentes
          arquivos={arquivosCliente}
          onRemover={(index) => onChangeArquivosCliente(arquivosCliente.filter((_, i) => i !== index))}
        />
      </div>
    </div>
  );
}
