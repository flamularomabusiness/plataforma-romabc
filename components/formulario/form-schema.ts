import { z } from "zod";
import { ESTADOS_BR, FUNCOES_CONTATO, GRAUS_DIFICULDADE } from "@/lib/types";

export const contatoSchema = z
  .object({
    nome: z.string().min(1, "Nome é obrigatório"),
    telefone: z
      .string()
      .min(1, "Telefone é obrigatório")
      .regex(/^\(\d{2}\) \d{4,5}-\d{4}$/, "Telefone inválido"),
    email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
    funcao: z.enum(FUNCOES_CONTATO, {
      errorMap: () => ({ message: "Selecione uma função" }),
    }),
    descricao_outro: z.string().optional().or(z.literal("")),
    rede_social: z.string().optional().or(z.literal("")),
    data_nascimento: z.string().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.funcao === "OUTRO" && !data.descricao_outro?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Descreva a função quando selecionar 'Outro'",
        path: ["descricao_outro"],
      });
    }
  });

export const formularioContratoSchema = z
  .object({
    // Aba 1
    produto_id: z.string().min(1, "Selecione o produto/serviço"),
    une_id: z.string().min(1, "Selecione a UNE"),

    // Aba 2
    nome_razao_social: z.string().min(1, "Razão social é obrigatória"),
    cpf_cnpj_responsavel: z
      .string()
      .min(1, "CNPJ é obrigatório")
      .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, "CNPJ inválido"),
    cidade: z.string().min(1, "Cidade é obrigatória"),
    estado: z.enum(ESTADOS_BR, { errorMap: () => ({ message: "Selecione o estado" }) }),
    faturamento_medio: z.number().nonnegative().optional().nullable(),

    // Aba 3
    contatos: z
      .array(contatoSchema)
      .min(1, "Adicione ao menos 1 contato")
      .max(10, "Máximo de 10 contatos"),

    // Aba 4
    valor_mensal: z.number().positive("Informe um valor válido"),
    plano_contratado: z.string().min(1, "Selecione um plano"),
    recorrente: z.boolean(),
    data_inicio_primeiro_pagamento: z.string().min(1, "Informe a data do 1º pagamento"),
    valor_primeiro_pagamento: z.number().nonnegative().optional().nullable(),
    data_vencimento_mensal: z
      .number({ invalid_type_error: "Informe o dia de vencimento" })
      .int()
      .min(1, "Mínimo 1")
      .max(31, "Máximo 31"),
    data_inicio_consultoria: z.string().optional().or(z.literal("")),
    data_onboarding: z.string().optional().or(z.literal("")),

    // Aba 5
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
    const responsaveis = data.contatos.filter((c) => c.funcao === "RESPONSAVEL");
    if (responsaveis.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Apenas um contato pode ser marcado como RESPONSAVEL",
        path: ["contatos"],
      });
    }
  });

export type FormularioContratoValues = z.infer<typeof formularioContratoSchema>;

export const contatoVazio = {
  nome: "",
  telefone: "",
  email: "",
  funcao: "RESPONSAVEL" as const,
  descricao_outro: "",
  rede_social: "",
  data_nascimento: "",
};

export const valoresPadrao: FormularioContratoValues = {
  produto_id: "",
  une_id: "",
  nome_razao_social: "",
  cpf_cnpj_responsavel: "",
  cidade: "",
  estado: "SP",
  faturamento_medio: null,
  contatos: [contatoVazio],
  valor_mensal: 0,
  plano_contratado: "Padrão",
  recorrente: true,
  data_inicio_primeiro_pagamento: "",
  valor_primeiro_pagamento: null,
  data_vencimento_mensal: 5,
  data_inicio_consultoria: "",
  data_onboarding: "",
  consultora_id: "",
  grau_dificuldade: "MEDIO",
  contexto_perfil_cliente: "",
  observacoes: "",
};

export const ABAS = [
  { id: "produto", label: "Produto/UNE" },
  { id: "empresa", label: "Empresa" },
  { id: "contatos", label: "Contatos" },
  { id: "pagamento", label: "Pagamento" },
  { id: "consultora", label: "Consultora" },
] as const;

export type AbaId = (typeof ABAS)[number]["id"];

export const RASCUNHO_KEY = "roma-bc-formulario-draft";
