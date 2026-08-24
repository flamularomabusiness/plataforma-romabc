import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { FUNCOES_CONTATO, GRAUS_DIFICULDADE, type CriarContratoRPCResult } from "@/lib/types";

const contatoPayloadSchema = z.object({
  nome: z.string().min(1),
  telefone: z.string().min(1),
  email: z.string().email(),
  funcao: z.enum(FUNCOES_CONTATO),
  descricao_outro: z.string().nullable().optional(),
  rede_social: z.string().nullable().optional(),
  data_nascimento: z.string().nullable().optional(),
});

const novoContratoPayloadSchema = z.object({
  produto_id: z.string().uuid(),
  une_id: z.string().uuid(),
  empresa: z.object({
    nome_razao_social: z.string().min(1),
    cpf_cnpj_responsavel: z.string().min(1),
    cidade: z.string().nullable().optional(),
    estado: z.string().length(2).nullable().optional(),
    faturamento_medio: z.number().nullable().optional(),
  }),
  contatos: z.array(contatoPayloadSchema).min(1).max(10),
  pagamento: z.object({
    valor_mensal: z.number().positive(),
    plano_contratado: z.string().min(1),
    recorrente: z.boolean(),
    data_inicio_primeiro_pagamento: z.string().min(1),
    valor_primeiro_pagamento: z.number().nullable().optional(),
    data_vencimento_mensal: z.number().int().min(1).max(31),
    data_inicio_consultoria: z.string().nullable().optional(),
    data_onboarding: z.string().nullable().optional(),
  }),
  consultora_id: z.string().uuid(),
  grau_dificuldade: z.enum(GRAUS_DIFICULDADE),
  contexto_perfil_cliente: z.string().min(1),
  observacoes: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = novoContratoPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data, error } = (await supabase.rpc("criar_contrato_completo", {
    payload: parsed.data,
  })) as { data: CriarContratoRPCResult | null; error: { message: string } | null };

  if (error) {
    console.error("[novo-contrato] erro ao criar contrato completo:", error);
    return NextResponse.json(
      { error: "Erro ao criar contrato", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, ...data }, { status: 201 });
}
