"use client";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUserRole } from "@/lib/auth";
import { useNotificacoesEmail } from "@/lib/queries";
import type { StatusNotificacaoEmail, TipoNotificacaoEmail } from "@/lib/types";

const TIPO_LABEL: Record<TipoNotificacaoEmail, string> = {
  NOVO_CONTRATO_FINANCEIRO: "Aviso ao Financeiro",
  NOVO_CONTRATO_RESPONSAVEL: "Aviso ao Responsável",
};

const STATUS_LABEL: Record<StatusNotificacaoEmail, { texto: string; variante: BadgeProps["variant"] }> = {
  ENVIADO: { texto: "Enviado", variante: "success" },
  ERRO: { texto: "Erro", variante: "destructive" },
  IGNORADO: { texto: "Ignorado", variante: "neutral" },
};

function formatarDataHora(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

/** Histórico dos e-mails de "novo contrato" — só administrator/financeiro (a RLS também barra os demais). */
export function CardNotificacoesEmail({ contratoIds }: { contratoIds: string[] }) {
  const userRole = useUserRole();
  const podeVer = userRole === "administrator" || userRole === "financeiro";
  const { data: notificacoes, isLoading } = useNotificacoesEmail(contratoIds, podeVer);

  if (!podeVer) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Notificações por E-mail</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !notificacoes || notificacoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum e-mail registrado para este cliente.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Destinatários</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notificacoes.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="whitespace-nowrap">{formatarDataHora(n.created_at)}</TableCell>
                  <TableCell>{TIPO_LABEL[n.tipo] ?? n.tipo}</TableCell>
                  <TableCell className="max-w-[280px] break-words">
                    {n.destinatarios.length > 0 ? n.destinatarios.join(", ") : "–"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_LABEL[n.status]?.variante ?? "neutral"}>
                      {STATUS_LABEL[n.status]?.texto ?? n.status}
                    </Badge>
                    {n.erro && <p className="mt-1 max-w-[320px] break-words text-xs text-muted-foreground">{n.erro}</p>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
