import { AlertTriangle, Check, X } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ImportLinhaValidada, ImportSeveridade } from "@/lib/types";

const LINHAS_VISIVEIS = 5;

const ICONE_SEVERIDADE: Record<ImportSeveridade, React.ReactElement> = {
  ok: <Check className="h-4 w-4 text-success" />,
  aviso: <AlertTriangle className="h-4 w-4 text-warning" />,
  erro: <X className="h-4 w-4 text-destructive" />,
};

export function PreviewTabela<T>({
  titulo,
  linhas,
  colunas,
}: {
  titulo: string;
  linhas: ImportLinhaValidada<T>[];
  colunas: Array<{ label: string; render: (dados: T) => React.ReactNode }>;
}) {
  const totalErros = linhas.filter((l) => l.severidade === "erro").length;
  const totalAvisos = linhas.filter((l) => l.severidade === "aviso").length;
  const mensagens = linhas.flatMap((l) =>
    l.mensagens.map((m) => ({ linha: l.linha, severidade: l.severidade, mensagem: m }))
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{titulo}</h3>
        <p className="text-sm text-muted-foreground">
          {linhas.length} linha{linhas.length === 1 ? "" : "s"}
          {totalErros > 0 && (
            <span className="ml-2 font-medium text-destructive">{totalErros} com erro</span>
          )}
          {totalAvisos > 0 && (
            <span className="ml-2 font-medium text-warning">{totalAvisos} com aviso</span>
          )}
        </p>
      </div>

      <div className="w-full overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">Linha</TableHead>
              <TableHead className="w-10"></TableHead>
              {colunas.map((c) => (
                <TableHead key={c.label}>{c.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colunas.length + 2} className="text-center text-muted-foreground">
                  Nenhuma linha encontrada.
                </TableCell>
              </TableRow>
            ) : (
              linhas.slice(0, LINHAS_VISIVEIS).map((l) => (
                <TableRow
                  key={l.linha}
                  className={cn(l.severidade === "erro" && "bg-red-50 dark:bg-red-950")}
                >
                  <TableCell className="text-muted-foreground">{l.linha}</TableCell>
                  <TableCell>{ICONE_SEVERIDADE[l.severidade]}</TableCell>
                  {colunas.map((c) => (
                    <TableCell key={c.label}>{c.render(l.dados)}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {linhas.length > LINHAS_VISIVEIS && (
        <p className="text-sm text-muted-foreground">
          Mostrando {LINHAS_VISIVEIS} de {linhas.length} linhas.
        </p>
      )}

      {mensagens.length > 0 && (
        <div className="space-y-1 rounded-lg border p-3">
          {mensagens.map((m, i) => (
            <p
              key={i}
              className={cn(
                "text-sm",
                m.severidade === "erro" ? "text-destructive" : "text-warning"
              )}
            >
              Linha {m.linha}: {m.mensagem}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
