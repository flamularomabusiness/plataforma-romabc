"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useClienteDetalhes } from "@/lib/queries";
import { EditorStatusCliente } from "@/components/clientes/editor-status-cliente";
import { FormDadosCadastrais } from "@/components/clientes/form-dados-cadastrais";
import { TabelaContratosEditavel } from "@/components/clientes/tabela-contratos-editavel";
import { TabelaEmpresasEditavel } from "@/components/clientes/tabela-empresas-editavel";
import { TabelaPagamentosEditavel } from "@/components/clientes/tabela-pagamentos-editavel";
import { TabelaPessoasEditavel } from "@/components/clientes/tabela-pessoas-editavel";

export default function EditarClientePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: cliente, isLoading, isError } = useClienteDetalhes(params.id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !cliente) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push("/painel/clientes")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <p className="text-muted-foreground">Cliente não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/painel/clientes/${cliente.id}`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold">Editar Cliente</h1>
        </div>
      </div>

      <EditorStatusCliente cliente={cliente} />

      <FormDadosCadastrais cliente={cliente} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Empresas</CardTitle>
        </CardHeader>
        <CardContent>
          <TabelaEmpresasEditavel
            linhas={cliente.contratos.flatMap((c) =>
              c.empresas.map((empresa) => ({
                contratoId: c.id,
                produtoNome: c.produto?.nome ?? "-",
                empresa,
              }))
            )}
            clienteId={cliente.id}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contratos</CardTitle>
        </CardHeader>
        <CardContent>
          <TabelaContratosEditavel contratos={cliente.contratos} clienteId={cliente.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pessoas</CardTitle>
        </CardHeader>
        <CardContent>
          <TabelaPessoasEditavel
            pessoas={cliente.contratos.flatMap((c) => c.pessoas)}
            clienteId={cliente.id}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pagamentos Projetados</CardTitle>
        </CardHeader>
        <CardContent>
          <TabelaPagamentosEditavel
            pagamentos={cliente.pagamentos_projetados}
            clienteId={cliente.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
