"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useHistoricoImportacoes } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import { ROLE_LABELS, type UserRole } from "@/lib/auth";

function formatarDataHora(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(iso)
  );
}

export function HistoricoImportacoes() {
  const { data: historico, isLoading } = useHistoricoImportacoes();
  const [expandido, setExpandido] = useState<string | null>(null);

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8"></TableHead>
          <TableHead>Data/Hora</TableHead>
          <TableHead>Quem</TableHead>
          <TableHead>Arquivo</TableHead>
          <TableHead>Registros</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {!historico || historico.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              Nenhuma importação registrada ainda.
            </TableCell>
          </TableRow>
        ) : (
          historico.map((registro) => {
            const aberto = expandido === registro.id;
            return (
              <Fragment key={registro.id}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => setExpandido(aberto ? null : registro.id)}
                >
                  <TableCell>
                    {aberto ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>{formatarDataHora(registro.data_criacao)}</TableCell>
                  <TableCell>{ROLE_LABELS[registro.usuario_role as UserRole] ?? registro.usuario_role}</TableCell>
                  <TableCell>{registro.nome_arquivo}</TableCell>
                  <TableCell>
                    {registro.clientes_importados} clientes / {registro.pagamentos_importados} pagamentos
                  </TableCell>
                  <TableCell>
                    <Badge variant={registro.status === "SUCESSO" ? "success" : "destructive"}>
                      {registro.status}
                    </Badge>
                  </TableCell>
                </TableRow>
                {aberto && (
                  <TableRow>
                    <TableCell colSpan={6} className="bg-muted text-sm">
                      {registro.status === "ERRO" && registro.detalhes?.erro ? (
                        <p className="text-destructive">{registro.detalhes.erro}</p>
                      ) : (
                        <p className="text-muted-foreground">
                          Importação concluída com sucesso em {formatDate(registro.data_criacao)}.
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
