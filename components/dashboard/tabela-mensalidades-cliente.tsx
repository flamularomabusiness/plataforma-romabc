import { cn, formatarMoedaDashboard } from "@/lib/utils";
import type { MensalidadeClienteLinha, StatusPagamento } from "@/lib/types";

const INDICADOR_STATUS: Record<StatusPagamento, { emoji: string; classe: string; label: string }> = {
  PAGO: { emoji: "🟢", classe: "bg-green-50 dark:bg-green-950", label: "Pago" },
  PROJETADO: { emoji: "🟡", classe: "bg-amber-50 dark:bg-amber-950", label: "Pendente" },
  ATRASADO: { emoji: "🔴", classe: "bg-red-50 dark:bg-red-950", label: "Atrasado" },
  INADIMPLENTE: { emoji: "🔴", classe: "bg-red-50 dark:bg-red-950", label: "Inadimplente" },
};

const SEM_MOVIMENTO = { emoji: "⚪", classe: "", label: "Sem movimento" };

export function TabelaMensalidadesCliente({
  meses,
  linhas,
}: {
  meses: string[];
  linhas: MensalidadeClienteLinha[];
}) {
  return (
    <div className="w-full max-w-full overflow-x-auto rounded-lg border">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b bg-muted">
            <th className="sticky left-0 z-10 bg-muted px-4 py-2 text-left font-medium">Cliente</th>
            {meses.map((mes) => (
              <th key={mes} className="whitespace-nowrap px-4 py-2 text-right font-medium">
                {mes}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 ? (
            <tr>
              <td colSpan={meses.length + 1} className="px-4 py-6 text-center text-muted-foreground">
                Nenhum cliente encontrado.
              </td>
            </tr>
          ) : (
            linhas.map((linha) => (
              <tr key={linha.cliente_id} className="border-b last:border-0">
                <td className="sticky left-0 z-10 max-w-[180px] truncate bg-background px-4 py-2 text-left font-medium">
                  {linha.cliente_nome}
                </td>
                {linha.celulas.map((celula, index) => {
                  const indicador = celula.status ? INDICADOR_STATUS[celula.status] : SEM_MOVIMENTO;
                  return (
                    <td
                      key={index}
                      className={cn("whitespace-nowrap px-4 py-2 text-right tabular-nums", indicador.classe)}
                      title={`${linha.cliente_nome} — ${meses[index]} — ${indicador.label}${
                        celula.status ? `: ${formatarMoedaDashboard(celula.valor)}` : ""
                      }`}
                    >
                      <span className="mr-1" aria-hidden>
                        {indicador.emoji}
                      </span>
                      {celula.status ? formatarMoedaDashboard(celula.valor) : "-"}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
