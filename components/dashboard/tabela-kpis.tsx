import { cn, formatarMoedaDashboard, formatarPercentual, formatarRsCrescimento } from "@/lib/utils";
import type { DashboardMesKPIs, MesDashboard } from "@/lib/types";

interface LinhaConfig {
  label: string;
  valores: Array<number | null>;
  formatar: (valor: number | null) => string;
  colorir?: boolean;
  destaque?: boolean;
}

export function TabelaKpis({
  titulo,
  meses,
  dados,
}: {
  titulo: string;
  meses: MesDashboard[];
  dados: DashboardMesKPIs;
}) {
  const linhas: LinhaConfig[] = [
    { label: "Faturamento", valores: dados.faturamento, formatar: formatarMoedaDashboard, destaque: true },
    {
      label: "Nº de Clientes",
      valores: dados.clientes,
      formatar: (v) => (v === null ? "-" : String(v)),
    },
    {
      label: "% Crescimento Volume",
      valores: dados.crescimento_volume,
      formatar: formatarPercentual,
      colorir: true,
    },
    {
      label: "% Crescimento Clientes",
      valores: dados.crescimento_clientes,
      formatar: formatarPercentual,
      colorir: true,
    },
    { label: "R$ Crescimento", valores: dados.r_crescimento, formatar: formatarRsCrescimento, colorir: true },
    { label: "Ticket Médio", valores: dados.ticket_medio, formatar: formatarMoedaDashboard },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{titulo}</h3>
      <div className="w-full max-w-full overflow-x-auto rounded-lg border">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b bg-muted">
              <th className="sticky left-0 z-10 bg-muted px-4 py-2 text-left font-medium">KPI</th>
              {meses.map((mes) => (
                <th
                  key={mes.label}
                  className={cn(
                    "whitespace-nowrap px-4 py-2 text-right font-medium",
                    mes.futuro && "text-muted-foreground"
                  )}
                  title={mes.futuro ? "Mês ainda não ocorreu — valor projetado" : undefined}
                >
                  {mes.label}
                  {mes.futuro && <span className="ml-1">*</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.label} className="border-b last:border-0">
                <td
                  className={cn(
                    "sticky left-0 z-10 whitespace-nowrap bg-background px-4 py-2 text-left",
                    linha.destaque && "font-bold"
                  )}
                >
                  {linha.label}
                </td>
                {linha.valores.map((valor, index) => (
                  <td
                    key={index}
                    className={cn(
                      "whitespace-nowrap px-4 py-2 text-right tabular-nums",
                      linha.destaque && "font-bold",
                      meses[index]?.futuro && "opacity-60",
                      linha.colorir && valor !== null && valor > 0 && "text-success",
                      linha.colorir && valor !== null && valor < 0 && "text-destructive",
                      linha.colorir && valor === 0 && "text-muted-foreground"
                    )}
                  >
                    {linha.formatar(valor)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
