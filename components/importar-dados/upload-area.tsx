"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";

import { cn } from "@/lib/utils";

const TAMANHO_MAX_BYTES = 5 * 1024 * 1024; // 5MB
const EXTENSOES_ACEITAS = [".xlsx", ".xls"];

function extensaoValida(nome: string): boolean {
  const lower = nome.toLowerCase();
  return EXTENSOES_ACEITAS.some((ext) => lower.endsWith(ext));
}

export function UploadArea({
  onArquivoSelecionado,
  desabilitado,
}: {
  onArquivoSelecionado: (file: File) => void;
  desabilitado?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function processarArquivo(file: File | undefined | null) {
    if (!file) return;
    setErro(null);

    if (!extensaoValida(file.name)) {
      setErro("Formato inválido. Envie um arquivo .xlsx ou .xls.");
      return;
    }
    if (file.size > TAMANHO_MAX_BYTES) {
      setErro("Arquivo muito grande. Tamanho máximo: 5MB.");
      return;
    }

    onArquivoSelecionado(file);
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => !desabilitado && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!desabilitado) setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          if (!desabilitado) processarArquivo(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors",
          arrastando ? "border-primary bg-accent" : "border-muted-foreground/30",
          desabilitado && "cursor-not-allowed opacity-50"
        )}
      >
        {arrastando ? (
          <FileSpreadsheet className="h-10 w-10 text-primary" />
        ) : (
          <Upload className="h-10 w-10 text-muted-foreground" />
        )}
        <div>
          <p className="font-medium">Arraste o arquivo Excel aqui ou clique para selecionar</p>
          <p className="text-sm text-muted-foreground">
            .xlsx ou .xls, com as sheets CLIENTES e PAGAMENTOS — até 5MB
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          disabled={desabilitado}
          onChange={(e) => processarArquivo(e.target.files?.[0])}
        />
      </div>
      {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}
    </div>
  );
}
