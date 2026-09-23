import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import {
  FORMAS_PAGAMENTO,
  FUNCOES_PESSOA,
  GRAUS_DIFICULDADE,
  TIPOS_ENTRADA,
  TIPOS_PAGAMENTO,
  type CriarContratoRPCResult,
} from "@/lib/types";

const pessoaPayloadSchema = z.object({
  cpf: z.string().min(1),
  nome_completo: z.string().min(1),
  faturamento_medio: z.number().nullable().optional(),
  telefone: z.string().min(1),
  email: z.string().email(),
  data_nascimento: z.string().min(1),
  rede_social: z.string().nullable().optional(),
  funcao: z.enum(FUNCOES_PESSOA),
  eh_principal: z.boolean(),
});

const empresaPayloadSchema = z.object({
  nome_razao_social: z.string().min(1),
  cpf_cnpj_responsavel: z.string().min(1),
  cidade: z.string().nullable().optional(),
  estado: z.string().length(2).nullable().optional(),
  faturamento_medio: z.number().nullable().optional(),
});

const novoContratoPayloadSchema = z.object({
  produto_id: z.string().uuid(),
  une_id: z.string().uuid(),
  empresas: z.array(empresaPayloadSchema).min(1, "Adicione ao menos 1 empresa"),
  numero_empresas: z.number().int().min(1, "Informe o número de empresas do grupo"),
  pessoas: z
    .array(pessoaPayloadSchema)
    .min(1)
    .max(10)
    .refine(
      (pessoas) => pessoas.filter((p) => p.eh_principal).length <= 1,
      "Apenas uma pessoa pode ser marcada como principal"
    ),
  pagamento: z
    .object({
      tipo_pagamento: z.enum(TIPOS_PAGAMENTO),
      plano_contratado: z.string().min(1),
      // Recorrente
      valor_mensal: z.number().positive().optional(),
      data_inicio_primeiro_pagamento: z.string().min(1).optional(),
      valor_primeiro_pagamento: z.number().nullable().optional(),
      data_vencimento_mensal: z.number().int().min(1).max(31).optional(),
      // Venda única
      data_pagamento_unico: z.string().min(1).optional(),
      // Venda única + Parcelado
      valor_total: z.number().positive().optional(),
      // Recorrente + Venda única
      forma_pagamento: z.enum(FORMAS_PAGAMENTO).optional(),
      // Parcelado
      numero_parcelas: z.number().int().min(2).max(12).optional(),
      parcelas: z
        .array(
          z.object({
            valor: z.number().positive(),
            data: z.string().min(1),
            forma_pagamento: z.enum(FORMAS_PAGAMENTO),
          })
        )
        .optional(),
      // Entrada do Contrato — independente do tipo_pagamento acima.
      entrada: z
        .object({
          tipo: z.enum(TIPOS_ENTRADA),
          parcelas: z
            .array(
              z.object({
                valor: z.number().positive(),
                data: z.string().min(1),
                forma_pagamento: z.enum(FORMAS_PAGAMENTO),
              })
            )
            .min(1)
            .max(5),
        })
        .optional(),
      // Comuns
      data_inicio_consultoria: z.string().nullable().optional(),
      data_onboarding: z.string().nullable().optional(),
    })
    .superRefine((pagamento, ctx) => {
      if (pagamento.tipo_pagamento === "recorrente") {
        if (!pagamento.valor_mensal) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe o valor do contrato", path: ["valor_mensal"] });
        }
        if (!pagamento.data_inicio_primeiro_pagamento) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe a data do 1º pagamento", path: ["data_inicio_primeiro_pagamento"] });
        }
        if (!pagamento.data_vencimento_mensal) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe o dia de vencimento", path: ["data_vencimento_mensal"] });
        }
        if (!pagamento.forma_pagamento) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecione a forma de pagamento", path: ["forma_pagamento"] });
        }
      }

      if (pagamento.tipo_pagamento === "venda_unica") {
        if (!pagamento.valor_total) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe o valor total do contrato", path: ["valor_total"] });
        }
        if (!pagamento.data_pagamento_unico) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe a data do pagamento", path: ["data_pagamento_unico"] });
        }
        if (!pagamento.forma_pagamento) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecione a forma de pagamento", path: ["forma_pagamento"] });
        }
      }

      if (pagamento.tipo_pagamento === "parcelado") {
        if (!pagamento.valor_total) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe o valor total do contrato", path: ["valor_total"] });
        }
        if (!pagamento.numero_parcelas) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe o número de parcelas", path: ["numero_parcelas"] });
        }
        const parcelas = pagamento.parcelas ?? [];
        if (pagamento.numero_parcelas && parcelas.length !== pagamento.numero_parcelas) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Preencha todas as parcelas", path: ["parcelas"] });
        }
        if (pagamento.valor_total) {
          const soma = parcelas.reduce((acc, p) => acc + p.valor, 0);
          if (Math.abs(soma - pagamento.valor_total) > 0.01) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "A soma das parcelas precisa ser igual ao valor total do contrato",
              path: ["parcelas"],
            });
          }
        }
      }
    }),
  consultora_id: z.string().uuid(),
  grau_dificuldade: z.enum(GRAUS_DIFICULDADE).optional(),
  contexto_perfil_cliente: z.string().nullable().optional(),
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
