"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CheckCircle2, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getUserId,
  ROLE_LABELS,
  USER_ROLES,
  useAcessoLiberado,
  type UserRole,
} from "@/lib/auth";
import {
  useAtualizarRoleUsuario,
  useConsultoras,
  useDesativarUsuario,
  useReativarUsuario,
  useUsuarios,
  useVincularConsultoraUsuario,
} from "@/lib/queries";
import { formatDate } from "@/lib/utils";

type FiltroRole = "TODOS" | UserRole;

// Radix Select não aceita value="" num item, então "sem consultora" tem sentinela.
const SEM_CONSULTORA = "NENHUMA";

export default function AdminUsuariosPage() {
  const router = useRouter();
  const acesso = useAcessoLiberado("gerenciarUsuarios");
  const meuId = getUserId();

  useEffect(() => {
    if (acesso === "negado") router.push("/painel/inicio");
  }, [acesso, router]);

  const [filtroRole, setFiltroRole] = useState<FiltroRole>("TODOS");

  const { data: usuarios, isLoading } = useUsuarios();
  const atualizarRole = useAtualizarRoleUsuario();
  const desativar = useDesativarUsuario();
  const reativar = useReativarUsuario();
  const { data: consultoras } = useConsultoras();
  const vincular = useVincularConsultoraUsuario();

  if (acesso !== "liberado") {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const usuariosFiltrados = (usuarios ?? []).filter(
    (u) => filtroRole === "TODOS" || u.role === filtroRole
  );

  async function handleTrocarRole(id: string, novaRole: UserRole) {
    try {
      await atualizarRole.mutateAsync({ id, role: novaRole });
      toast.success(`Role atualizada para ${ROLE_LABELS[novaRole]}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar role");
    }
  }

  async function handleVincular(usuarioId: string, valor: string) {
    try {
      await vincular.mutateAsync({
        usuarioId,
        consultoraId: valor === SEM_CONSULTORA ? null : valor,
      });
      toast.success(valor === SEM_CONSULTORA ? "Vínculo removido" : "Consultora vinculada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao vincular consultora");
    }
  }

  async function handleDesativar(id: string) {
    if (!window.confirm("Desativar este usuário? Ele perde acesso ao sistema imediatamente.")) return;
    try {
      await desativar.mutateAsync(id);
      toast.success("Usuário desativado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao desativar usuário");
    }
  }

  async function handleReativar(id: string) {
    try {
      await reativar.mutateAsync(id);
      toast.success("Usuário reativado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao reativar usuário");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gerenciar Usuários</h1>
        <p className="text-muted-foreground">
          Promova, rebaixe ou desative o acesso de quem usa o sistema. Vincule cada consultora à
          sua conta: o aviso de novo cliente vai para o e-mail com que ela criou o login.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={filtroRole} onValueChange={(v) => setFiltroRole(v as FiltroRole)}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todas as roles</SelectItem>
              {USER_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Consultora</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuariosFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhum usuário encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  usuariosFiltrados.map((usuario) => {
                    const souEu = usuario.id === meuId;
                    return (
                      <TableRow key={usuario.id}>
                        <TableCell>
                          <div className="font-medium">
                            {usuario.nome ?? <span className="text-muted-foreground">Sem nome</span>}
                            {souEu && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">(você)</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{usuario.email}</div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={usuario.role}
                            disabled={souEu || atualizarRole.isPending}
                            onValueChange={(v) => handleTrocarRole(usuario.id, v as UserRole)}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {USER_ROLES.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {ROLE_LABELS[role]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={
                              (consultoras ?? []).find((c) => c.usuario_id === usuario.id)?.id ??
                              SEM_CONSULTORA
                            }
                            disabled={vincular.isPending}
                            onValueChange={(v) => handleVincular(usuario.id, v)}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={SEM_CONSULTORA}>Nenhuma</SelectItem>
                              {(consultoras ?? [])
                                .filter((c) => !c.usuario_id || c.usuario_id === usuario.id)
                                .map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.nome}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {usuario.ativo ? (
                            <Badge variant="secondary">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Ativo
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <Ban className="mr-1 h-3 w-3" />
                              Desativado
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(usuario.data_criacao)}</TableCell>
                        <TableCell className="text-right">
                          {usuario.ativo ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={souEu || desativar.isPending}
                              title={souEu ? "Você não pode desativar a própria conta" : "Desativar"}
                              onClick={() => handleDesativar(usuario.id)}
                            >
                              <Ban className="mr-2 h-3.5 w-3.5" />
                              Desativar
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={reativar.isPending}
                              onClick={() => handleReativar(usuario.id)}
                            >
                              <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                              Reativar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
