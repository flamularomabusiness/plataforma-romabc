import { z } from "zod";
import { ESTADOS_BR, FUNCOES_PESSOA, GRAUS_DIFICULDADE, TIPOS_PAGAMENTO } from "@/lib/types";

export const empresaSchema = z.object({
  nome_razao_social: z.string().min(1, "Razão social é obrigatória"),
  cpf_cnpj_responsavel: z
    .string()
    .min(1, "CNPJ é obrigatório")
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, "CNPJ inválido"),
  cidade: z.string().min(1, "Cidade é obrigatória"),
  estado: z.enum(ESTADOS_BR, { errorMap: () => ({ message: "Selecione o estado" }) }),
  faturamento_medio: z.number().nonnegative("Informe um valor válido"),
});

export const parcelaSchema = z.object({
  valor: z.number().positive("Informe o valor da parcela"),
  data: z.string().min(1, "Informe a data da parcela"),
});

export const pessoaSchema = z.object({
  cpf: z
    .string()
    .min(1, "CPF é obrigatório")
    .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF inválido"),
  nome_completo: z.string().min(1, "Nome completo é obrigatório"),
  faturamento_medio: z.number().nonnegative("Informe um valor válido"),
  telefone: z
    .string()
    .min(1, "Telefone é obrigatório")
    .regex(/^\(\d{2}\) \d{4,5}-\d{4}$/, "Telefone inválido"),
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  data_nascimento: z.string().min(1, "Data de nascimento é obrigatória"),
  rede_social: z.string().optional().or(z.literal("")),
  funcao: z.enum(FUNCOES_PESSOA, {
    errorMap: () => ({ message: "Selecione uma função" }),
  }),
  eh_principal: z.boolean(),
});

export const formularioContratoSchema = z
  .object({
    // Produto → UNE (a UNE é derivada automaticamente do produto escolhido)
    produto_id: z.string().min(1, "Selecione um Produto"),
    une_id: z.string().min(1, "UNE deve ser preenchida automaticamente"),

    // Empresa Cliente
    empresas: z
      .array(empresaSchema)
      .min(1, "Adicione ao menos 1 empresa"),

    // Pessoa Cliente
    pessoas: z
      .array(pessoaSchema)
      .min(1, "Adicione ao menos 1 pessoa")
      .max(10, "Máximo de 10 pessoas"),

    // Pagamento
    tipo_pagamento: z.enum(TIPOS_PAGAMENTO, {
      errorMap: () => ({ message: "Selecione o tipo de pagamento" }),
    }),
    plano_contratado: z.string().min(1, "Selecione um plano"),

    // Recorrente
    valor_mensal: z.number().nonnegative("Informe um valor válido").optional(),
    data_inicio_primeiro_pagamento: z.string().optional().or(z.literal("")),
    valor_primeiro_pagamento: z.number().nonnegative().optional().nullable(),
    data_vencimento_mensal: z
      .number({ invalid_type_error: "Informe o dia de vencimento" })
      .int()
      .min(1, "Mínimo 1")
      .max(31, "Máximo 31")
      .optional(),

    // Venda única
    data_pagamento_unico: z.string().optional().or(z.literal("")),

    // Venda única + Parcelado
    valor_total: z.number().nonnegative("Informe um valor válido").optional(),

    // Parcelado
    valor_entrada: z.number().nonnegative("Informe um valor válido").optional(),
    data_entrada: z.string().optional().or(z.literal("")),
    numero_parcelas: z.number().int().min(2).max(12).optional(),
    parcelas: z.array(parcelaSchema).optional(),

    // Comuns
    data_inicio_consultoria: z.string().optional().or(z.literal("")),
    data_onboarding: z.string().optional().or(z.literal("")),

    // Consultora, grau, contexto e observações
    consultora_id: z.string().min(1, "Selecione a consultora responsável"),
    grau_dificuldade: z
      .enum(GRAUS_DIFICULDADE, { errorMap: () => ({ message: "Selecione o grau de dificuldade" }) })
      .default("MEDIO"),
    contexto_perfil_cliente: z
      .string()
      .min(1, "Descreva o contexto e perfil do cliente"),
    observacoes: z.string().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const principais = data.pessoas.filter((p) => p.eh_principal);
    if (principais.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Apenas uma pessoa pode ser marcada como principal",
        path: ["pessoas"],
      });
    }

    if (data.tipo_pagamento === "recorrente") {
      if (!data.valor_mensal || data.valor_mensal <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe o valor do contrato",
          path: ["valor_mensal"],
        });
      }
      if (!data.data_inicio_primeiro_pagamento) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe a data do 1º pagamento",
          path: ["data_inicio_primeiro_pagamento"],
        });
      }
      if (!data.data_vencimento_mensal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe o dia de vencimento",
          path: ["data_vencimento_mensal"],
        });
      }
    }

    if (data.tipo_pagamento === "venda_unica") {
      if (!data.valor_total || data.valor_total <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe o valor total do contrato",
          path: ["valor_total"],
        });
      }
      if (!data.data_pagamento_unico) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe a data do pagamento",
          path: ["data_pagamento_unico"],
        });
      }
    }

    if (data.tipo_pagamento === "parcelado") {
      if (!data.valor_total || data.valor_total <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe o valor total do contrato",
          path: ["valor_total"],
        });
      }
      if (data.valor_entrada === undefined || data.valor_entrada === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe o valor de entrada",
          path: ["valor_entrada"],
        });
      }
      if (!data.data_entrada) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe a data de entrada",
          path: ["data_entrada"],
        });
      }
      if (!data.numero_parcelas || data.numero_parcelas < 2 || data.numero_parcelas > 12) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione entre 2 e 12 parcelas",
          path: ["numero_parcelas"],
        });
      }

      const parcelas = data.parcelas ?? [];
      if (data.numero_parcelas && parcelas.length !== data.numero_parcelas) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Preencha todas as parcelas",
          path: ["parcelas"],
        });
      }

      if (
        data.valor_total &&
        data.valor_entrada !== undefined &&
        data.valor_entrada !== null &&
        parcelas.length > 0 &&
        parcelas.every((p) => p.valor > 0 && p.data)
      ) {
        const soma = data.valor_entrada + parcelas.reduce((acc, p) => acc + p.valor, 0);
        if (Math.abs(soma - data.valor_total) > 0.01) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "A soma da entrada + parcelas precisa ser igual ao valor total do contrato",
            path: ["parcelas"],
          });
        }
      }
    }
  });

export type FormularioContratoValues = z.infer<typeof formularioContratoSchema>;

export const empresaVazia = {
  nome_razao_social: "",
  cpf_cnpj_responsavel: "",
  cidade: "",
  estado: "SP" as const,
  faturamento_medio: 0,
};

export const pessoaVazia = {
  cpf: "",
  nome_completo: "",
  faturamento_medio: 0,
  telefone: "",
  email: "",
  data_nascimento: "",
  rede_social: "",
  funcao: "DONO" as const,
  eh_principal: false,
};

export const valoresPadrao: FormularioContratoValues = {
  produto_id: "",
  une_id: "",
  empresas: [empresaVazia],
  pessoas: [{ ...pessoaVazia, eh_principal: true }],
  tipo_pagamento: "recorrente",
  plano_contratado: "Padrão",
  valor_mensal: 0,
  data_inicio_primeiro_pagamento: "",
  valor_primeiro_pagamento: null,
  data_vencimento_mensal: 5,
  data_pagamento_unico: "",
  valor_total: 0,
  valor_entrada: 0,
  data_entrada: "",
  numero_parcelas: 2,
  parcelas: [],
  data_inicio_consultoria: "",
  data_onboarding: "",
  consultora_id: "",
  grau_dificuldade: "MEDIO",
  contexto_perfil_cliente: "",
  observacoes: "",
};

export const RASCUNHO_KEY = "roma-bc-formulario-draft";
