import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { STATUS_CLIENTE, STATUS_PAGAMENTO } from "@/lib/types";
import type { ImportarDadosResultado } from "@/lib/types";

const LIMITE_IMPORTS_POR_HORA = 5;

// Duplicado de USER_ROLES (lib/auth.ts) de propósito: esse arquivo tem
// useState/useEffect (é pensado pra rodar no client) e não pode ser
// importado por uma API route server-side.
const USER_ROLES = ["comercial", "gerente", "financeiro"] as const;

const clienteRowSchema = z.object({
  empresa: z.string().min(1),
  cnpj: z.string().min(1),
  une: z.string().min(1),
  produto: z.string().min(1),
  valor: z.number().positive(),
  status: z.enum(STATUS_CLIENTE),
  data_inicio: z.string().min(1),
});

const pagamentoRowSchema = z.object({
  empresa: z.string().min(1),
  data_vencimento: z.string().min(1),
  valor: z.number().positive(),
  status: z.enum(STATUS_PAGAMENTO),
  data_pagamento: z.string().nullable(),
});

const payloadSchema = z.object({
  usuarioRole: z.enum(USER_ROLES),
  nomeArquivo: z.string().min(1),
  clientes: z.array(clienteRowSchema).min(1),
  pagamentos: z.array(pagamentoRowSchema),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { usuarioRole, nomeArquivo, clientes, pagamentos } = parsed.data;

  if (usuarioRole !== "gerente" && usuarioRole !== "financeiro") {
    return NextResponse.json(
      { error: "Apenas Gerente e Financeiro podem importar dados" },
      { status: 403 }
    );
  }

  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: importsRecentes, error: rateLimitError } = await supabase
    .from("importacoes")
    .select("id", { count: "exact", head: true })
    .eq("usuario_role", usuarioRole)
    .gte("data_criacao", umaHoraAtras);

  if (rateLimitError) {
    console.error("[importar-dados] erro ao checar rate limit:", rateLimitError);
  } else if ((importsRecentes ?? 0) >= LIMITE_IMPORTS_POR_HORA) {
    return NextResponse.json(
      { error: `Limite de ${LIMITE_IMPORTS_POR_HORA} importações por hora atingido. Tente novamente mais tarde.` },
      { status: 429 }
    );
  }

  const { data, error } = (await supabase.rpc("importar_dados_excel", {
    payload: { clientes, pagamentos },
  })) as { data: ImportarDadosResultado | null; error: { message: string } | null };

  if (error) {
    console.error("[importar-dados] erro na importação:", error);
    await supabase.from("importacoes").insert({
      usuario_role: usuarioRole,
      nome_arquivo: nomeArquivo,
      clientes_importados: 0,
      pagamentos_importados: 0,
      status: "ERRO",
      detalhes: { erro: error.message },
    });
    return NextResponse.json(
      { error: "Erro ao importar dados", details: error.message },
      { status: 400 }
    );
  }

  await supabase.from("importacoes").insert({
    usuario_role: usuarioRole,
    nome_arquivo: nomeArquivo,
    clientes_importados: data?.clientes_importados ?? 0,
    pagamentos_importados: data?.pagamentos_importados ?? 0,
    status: "SUCESSO",
  });

  return NextResponse.json({ success: true, ...data }, { status: 201 });
}
