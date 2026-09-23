"use client";

import { useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import { validarArquivoDocumento } from "@/lib/queries";

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png";

/** Área de drag & drop + seletor de arquivo — só valida e repassa, não sobe nada sozinha. */
export function DropzoneDocumentos({
  onArquivosSelecionados,
  desabilitado,
}: {
  onArquivosSelecionados: (files: File[]) => void;
  desabilitado?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function processarArquivos(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setErro(null);

    const validos: File[] = [];
    for (const file of Array.from(fileList)) {
      const erroValidacao = validarArquivoDocumento(file);
      if (erroValidacao) {
        setErro(`${file.name}: ${erroValidacao}`);
        continue;
      }
      validos.push(file);
    }
    if (validos.length > 0) onArquivosSelecionados(validos);
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
          if (!desabilitado) processarArquivos(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          arrastando ? "border-primary bg-accent" : "border-muted-foreground/30",
          desabilitado && "cursor-not-allowed opacity-50"
        )}
      >
        {arrastando ? (
          <FileText className="h-8 w-8 text-primary" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-medium">Arraste os arquivos aqui ou clique para selecionar</p>
          <p className="text-xs text-muted-foreground">
            .pdf, .doc, .docx, .xlsx, .jpg ou .png — até 10MB por arquivo
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          disabled={desabilitado}
          onChange={(e) => {
            processarArquivos(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}
    </div>
  );
}
