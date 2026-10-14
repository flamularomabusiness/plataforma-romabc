import { FUNCOES_PESSOA } from "./types";

/**
 * pessoas_cliente_funcao_check (banco) aceita exatamente DONO, FINANCEIRO,
 * SÓCIO (com acento) e OUTROS (com S). Nomes sem acento / no singular — como o
 * app mandava antes — reprovam com 23514 e derrubavam a criação do contrato.
 */
const APELIDOS: Record<string, string> = {
  SOCIO: "SÓCIO",
  OUTRO: "OUTROS",
};

export const FUNCOES_ACEITAS_TEXTO = FUNCOES_PESSOA.join(", ");

/** Trim + maiúsculas + NFC (acento precomposto, como na constraint) + apelidos antigos. Não-string passa direto. */
export function normalizarFuncaoPessoa(valor: unknown): unknown {
  if (typeof valor !== "string") return valor;
  const limpo = valor.normalize("NFC").trim().toUpperCase();
  return APELIDOS[limpo] ?? limpo;
}

/**
 * Normaliza `pessoas[].funcao` de um payload bruto (ainda não validado). Se
 * algum valor continuar fora dos aceitos, devolve a mensagem clara em `erro`
 * — melhor que o 23514 genérico do Postgres.
 */
export function normalizarFuncoesDoPayload(body: unknown): { body: unknown; erro: string | null } {
  const pessoas = (body as { pessoas?: unknown } | null)?.pessoas;
  if (!Array.isArray(pessoas)) return { body, erro: null };

  let erro: string | null = null;
  const pessoasNormalizadas = pessoas.map((pessoa) => {
    if (!pessoa || typeof pessoa !== "object" || !("funcao" in pessoa)) return pessoa;
    const original = (pessoa as { funcao: unknown }).funcao;
    const funcao = normalizarFuncaoPessoa(original);
    if (!(FUNCOES_PESSOA as readonly unknown[]).includes(funcao)) {
      erro ??= `Função inválida: ${String(original)}. Valores aceitos: ${FUNCOES_ACEITAS_TEXTO}`;
    }
    return { ...pessoa, funcao };
  });

  return { body: { ...(body as object), pessoas: pessoasNormalizadas }, erro };
}
