"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Pencil, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import type { EmpresaDoContrato } from "@/lib/types";

/** Empresa principal em destaque + demais empresas do contrato colapsadas por padrão (spec: "Empresas" no painel do cliente). */
export function CardEmpresasContrato({
  produtoNome,
  numeroEmpresas,
  empresas,
  clienteId,
}: {
  produtoNome: string;
  numeroEmpresas: number;
  empresas: EmpresaDoContrato[];
  /** Link "Editar" de cada empresa vai pra tela Editar Cliente, que já tem a tabela completa (razão social, CNPJ, marcar principal, etc.). */
  clienteId: string;
}) {
  const [expandido, setExpandido] = useState(false);

  if (empresas.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma empresa vinculada.</p>;
  }

  const principal = empresas.find((e) => e.eh_principal) ?? empresas[0];
  const outras = empresas.filter((e) => e.id !== principal.id);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {produtoNome} · Nº de empresas neste contrato: {numeroEmpresas}
      </p>

      <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            <Star className="h-4 w-4 fill-primary" />
            Empresa Principal
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/painel/clientes/${clienteId}/editar`}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Editar
            </Link>
          </Button>
        </div>
        <p className="text-lg font-semibold">{principal.nome_razao_social}</p>
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">CNPJ</p>
            <p className="font-medium">{principal.cpf_cnpj_responsavel}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Cidade/UF</p>
            <p className="font-medium">
              {principal.cidade ?? "-"}/{principal.estado ?? "-"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Faturamento Médio</p>
            <p className="font-medium">{formatBRL(principal.faturamento_medio)}</p>
          </div>
        </div>
      </div>

      {outras.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {expandido ? "Ocultar outras empresas" : `Ver ${outras.length} outra(s) empresa(s)`}
          </button>

          {expandido && (
            <div className="space-y-2">
              {outras.map((empresa) => (
                <div key={empresa.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{empresa.nome_razao_social}</p>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/painel/clientes/${clienteId}/editar`}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Editar
                      </Link>
                    </Button>
                  </div>
                  <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-muted-foreground">CNPJ</p>
                      <p className="font-medium">{empresa.cpf_cnpj_responsavel}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cidade/UF</p>
                      <p className="font-medium">
                        {empresa.cidade ?? "-"}/{empresa.estado ?? "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Faturamento Médio</p>
                      <p className="font-medium">{formatBRL(empresa.faturamento_medio)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
