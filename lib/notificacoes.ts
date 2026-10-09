import type { SupabaseClient } from "@supabase/supabase-js";

import { enviarEmail } from "./email";
import { emailParaFinanceiro, emailParaResponsavel, type DadosEmailNovoContrato } from "./email-templates";
import { criarSupabaseAdmin } from "./supabase-admin";
import { GRAU_DIFICULDADE_LABELS } from "./utils";
import type { GrauDificuldade } from "./types";

type TipoNotificacao = "NOVO_CONTRATO_FINANCEIRO" | "NOVO_CONTRATO_RESPONSAVEL";
type StatusNotificacao = "ENVIADO" | "ERRO" | "IGNORADO";

/** Só os campos do payload do formulário que as notificações usam. */
interface PayloadContrato {
  produto_id: string;
  une_id: string;
  consultora_id: string;
  empresas: { nome_razao_social: string; nome_fantasia?: string | null; cpf_cnpj_responsavel: string }[];
  pagamento: {
    tipo_pagamento: "recorrente" | "venda_unica" | "parcelado";
    plano_contratado: string;
    valor_mensal?: number;
    valor_total?: number;
    numero_parcelas?: number;
    forma_pagamento?: "pix" | "boleto";
    parcelas?: { valor: number; forma_pagamento: "pix" | "boleto" }[];
    entrada?: { tipo: "a_vista" | "parcelado"; parcelas: { valor: number; forma_pagamento: "pix" | "boleto" }[] };
    data_inicio_consultoria?: string | null;
  };
  grau_dificuldade?: string;
  contexto_perfil_cliente?: string | null;
}

export interface EntradaNotificacao {
  contratoId: string;
  clienteId: string;
  payload: PayloadContrato;
  cadastradoPor: string;
}

const ROLES_FINANCEIRO = ["financeiro", "administrator"];
const TIPO_PAGAMENTO_LABEL = {
  recorrente: "Recorrente (mensal)",
  venda_unica: "Venda única",
  parcelado: "Parcelado",
} as const;
const FORMA_LABEL = { pix: "PIX", boleto: "Boleto" } as const;

function urlBase(): string {
  return (process.env.APP_URL || "https://plataforma-romabc.vercel.app").replace(/\/+$/, "");
}

function brl(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "2026-10-08" -> "08/10/2026" sem passar por Date (evita deslocar o dia por fuso). */
function dataBr(iso: string | null | undefined): string | null {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

function descreverValor(p: PayloadContrato["pagamento"]): string {
  let texto = "";
  if (p.tipo_pagamento === "recorrente") texto = `${brl(p.valor_mensal ?? 0)} / mês`;
  else if (p.tipo_pagamento === "venda_unica") texto = `${brl(p.valor_total ?? 0)} (pagamento único)`;
  else texto = `${brl(p.valor_total ?? 0)} em ${p.numero_parcelas ?? p.parcelas?.length ?? "?"}x`;

  if (p.entrada) {
    const soma = p.entrada.parcelas.reduce((acc, parcela) => acc + parcela.valor, 0);
    const como = p.entrada.tipo === "a_vista" ? "à vista" : `em ${p.entrada.parcelas.length}x`;
    texto += ` + entrada de ${brl(soma)} (${como})`;
  }
  return texto;
}

function descreverForma(p: PayloadContrato["pagamento"]): string {
  const unicas = (formas: ("pix" | "boleto")[]) => Array.from(new Set(formas)).map((f) => FORMA_LABEL[f]).join(" / ");

  const partes: string[] = [];
  if (p.tipo_pagamento === "parcelado") {
    partes.push(unicas((p.parcelas ?? []).map((x) => x.forma_pagamento)));
  } else if (p.forma_pagamento) {
    partes.push(FORMA_LABEL[p.forma_pagamento]);
  }
  if (p.entrada) {
    partes.push(`Entrada: ${unicas(p.entrada.parcelas.map((x) => x.forma_pagamento))}`);
  }
  return partes.filter(Boolean).join(" · ");
}

function emailsUnicos(lista: (string | null | undefined)[]): string[] {
  const vistos = new Set<string>();
  const resultado: string[] = [];
  for (const bruto of lista) {
    const email = bruto?.trim();
    if (!email || !email.includes("@")) continue;
    const chave = email.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    resultado.push(email);
  }
  return resultado;
}

async function registrar(
  admin: SupabaseClient,
  entrada: EntradaNotificacao,
  tipo: TipoNotificacao,
  destinatarios: string[],
  assunto: string,
  status: StatusNotificacao,
  erro?: string
) {
  const { error } = await admin.from("notificacoes_email").insert({
    contrato_id: entrada.contratoId,
    cliente_id: entrada.clienteId,
    tipo,
    destinatarios,
    assunto,
    status,
    erro: erro ? erro.slice(0, 1000) : null,
  });
  // Log que falha em gravar não pode derrubar nada — só aparece nos logs da Vercel.
  if (error) console.error("[notificacoes] não consegui gravar em notificacoes_email:", error.message);
}

async function enviarERegistrar(
  admin: SupabaseClient,
  entrada: EntradaNotificacao,
  tipo: TipoNotificacao,
  destinatarios: string[],
  email: { assunto: string; html: string },
  motivoSemDestinatario: string
) {
  if (destinatarios.length === 0) {
    await registrar(admin, entrada, tipo, [], email.assunto, "IGNORADO", motivoSemDestinatario);
    return;
  }
  try {
    await enviarEmail({ para: destinatarios, assunto: email.assunto, html: email.html });
    await registrar(admin, entrada, tipo, destinatarios, email.assunto, "ENVIADO");
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : String(error);
    console.error(`[notificacoes] falha ao enviar ${tipo}:`, mensagem);
    await registrar(admin, entrada, tipo, destinatarios, email.assunto, "ERRO", mensagem);
  }
}

/**
 * Dispara os 2 e-mails de "novo contrato" (Financeiro + Responsável) e
 * registra cada um em notificacoes_email. NUNCA lança: o contrato já foi
 * criado, então qualquer falha aqui só vira log (tabela e/ou console).
 * Chamar dentro de after() — roda depois da resposta ao usuário.
 */
export async function notificarNovoContrato(entrada: EntradaNotificacao): Promise<void> {
  try {
    const admin = criarSupabaseAdmin();
    const { payload } = entrada;

    const [produto, une, consultora, usuarios] = await Promise.all([
      admin.from("produtos").select("nome").eq("id", payload.produto_id).maybeSingle(),
      admin.from("unes").select("nome").eq("id", payload.une_id).maybeSingle(),
      admin.from("consultoras").select("nome, email").eq("id", payload.consultora_id).maybeSingle(),
      // Só usuários ATIVOS recebem. O e-mail vem de public.usuarios (preenchido pelo trigger no cadastro).
      admin.from("usuarios").select("email").eq("ativo", true).in("role", ROLES_FINANCEIRO),
    ]);

    const grau = payload.grau_dificuldade as GrauDificuldade | undefined;
    const base: DadosEmailNovoContrato = {
      empresas: payload.empresas.map((e) => ({
        razaoSocial: e.nome_razao_social,
        nomeFantasia: e.nome_fantasia?.trim() || null,
        cnpj: e.cpf_cnpj_responsavel,
      })),
      produto: produto.data?.nome ?? "(produto não encontrado)",
      plano: payload.pagamento.plano_contratado?.trim() || null,
      une: une.data?.nome ?? "(UNE não encontrada)",
      dataInicio: dataBr(payload.pagamento.data_inicio_consultoria),
      responsavel: consultora.data?.nome ?? "(responsável não encontrado)",
      linkPainel: `${urlBase()}/painel/clientes/${entrada.clienteId}`,
    };

    const financeiro = emailParaFinanceiro({
      ...base,
      valor: descreverValor(payload.pagamento),
      tipoPagamento: TIPO_PAGAMENTO_LABEL[payload.pagamento.tipo_pagamento],
      formaPagamento: descreverForma(payload.pagamento),
      cadastradoPor: entrada.cadastradoPor,
    });
    await enviarERegistrar(
      admin,
      entrada,
      "NOVO_CONTRATO_FINANCEIRO",
      emailsUnicos((usuarios.data ?? []).map((u) => u.email as string)),
      financeiro,
      "Nenhum usuário ativo com role financeiro/administrator"
    );

    const responsavel = emailParaResponsavel({
      ...base,
      grauDificuldade: grau ? GRAU_DIFICULDADE_LABELS[grau] : undefined,
      contexto: payload.contexto_perfil_cliente,
    });
    await enviarERegistrar(
      admin,
      entrada,
      "NOVO_CONTRATO_RESPONSAVEL",
      emailsUnicos([consultora.data?.email as string | null | undefined]),
      responsavel,
      consultora.data
        ? `Consultora "${consultora.data.nome}" sem e-mail cadastrado`
        : "Consultora do contrato não encontrada"
    );
  } catch (error) {
    console.error("[notificacoes] falha inesperada ao notificar novo contrato:", error);
  }
}
