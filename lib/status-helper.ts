import { supabase } from "./supabase";
import type { StatusCliente, StatusPagamento } from "./types";

const DIAS_INATIVIDADE = 60;
const DIAS_INADIMPLENCIA_PAGAMENTO = 90;

interface PagamentoParaStatus {
  status: StatusPagamento;
  data_vencimento: string | null;
}

/**
 * Calcula o status "sugerido" de um cliente a partir dos pagamentos de todos
 * os contratos ligados a ele. Pura (sem I/O) — recebe os pagamentos já
 * carregados, pra poder ser reaproveitada tanto por determinarStatusCliente
 * (que busca no banco) quanto pela sugestão exibida na tela de edição
 * (que já tem os pagamentos do cliente carregados via fetchClienteDetalhes).
 *
 * Prioridade: INADIMPLENTE > INATIVO > ATIVO.
 * - INADIMPLENTE: existe algum pagamento não pago com vencimento no passado.
 * - INATIVO: nenhum pagamento (de nenhum status) com vencimento nos últimos
 *   60 dias pra trás nem nos próximos 60 dias — sem pagamento nem passado
 *   recente nem futuro próximo, não há atividade de cobrança acontecendo.
 * - ATIVO: caso contrário (tem pagamento em dia, dentro da janela de 60 dias).
 */
export function calcularStatusSugerido(pagamentos: PagamentoParaStatus[]): StatusCliente {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const temAtrasado = pagamentos.some((p) => {
    if (!p.data_vencimento) return false;
    if (p.status === "PAGO") return false;
    return new Date(p.data_vencimento) < hoje;
  });
  if (temAtrasado) return "INADIMPLENTE";

  const limiteInatividade = new Date(hoje);
  limiteInatividade.setDate(limiteInatividade.getDate() - DIAS_INATIVIDADE);

  const temAtividadeRecente = pagamentos.some((p) => {
    if (!p.data_vencimento) return false;
    return new Date(p.data_vencimento) >= limiteInatividade;
  });
  if (!temAtividadeRecente) return "INATIVO";

  return "ATIVO";
}

/**
 * Status "sugerido" de UM pagamento, a partir do vencimento e (se houver) da
 * data em que foi recebido. Pura — não considera override manual (isso é
 * exatamente por isso que o status do pagamento continua editável na tela:
 * esta função só dá o palpite inicial, quem decide é o Gerente/Financeiro).
 */
export function determinarStatusPagamento(
  dataVencimento: string | null,
  dataPagamento: string | null
): StatusPagamento {
  if (dataPagamento) return "PAGO";
  if (!dataVencimento) return "PROJETADO";

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(dataVencimento);

  if (vencimento > hoje) return "PROJETADO";

  const diasAtraso = Math.floor((hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));
  return diasAtraso >= DIAS_INADIMPLENCIA_PAGAMENTO ? "INADIMPLENTE" : "ATRASADO";
}

/** Busca os pagamentos do cliente (via contrato_empresas) e calcula o status sugerido. */
export async function determinarStatusCliente(clienteId: string): Promise<StatusCliente> {
  const { data: contratosLigados, error: contratosError } = await supabase
    .from("contrato_empresas")
    .select("contrato_id")
    .eq("cliente_id", clienteId);
  if (contratosError) throw new Error(contratosError.message);

  const contratoIds = (contratosLigados ?? []).map((c: any) => c.contrato_id);
  if (contratoIds.length === 0) return "INATIVO";

  const { data: pagamentos, error: pagamentosError } = await supabase
    .from("pagamentos_projetados")
    .select("status, data_vencimento")
    .in("contrato_id", contratoIds);
  if (pagamentosError) throw new Error(pagamentosError.message);

  return calcularStatusSugerido((pagamentos ?? []) as PagamentoParaStatus[]);
}
