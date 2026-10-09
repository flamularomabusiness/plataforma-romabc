const AZUL = "#244DD8";
const AZUL_ESCURO = "#001C6B";

export interface DadosEmailNovoContrato {
  empresas: { razaoSocial: string; nomeFantasia: string | null; cnpj: string }[];
  produto: string;
  plano: string | null;
  une: string;
  dataInicio: string | null;
  responsavel: string;
  linkPainel: string;
  // Só o e-mail do Financeiro usa os três abaixo.
  valor?: string;
  tipoPagamento?: string;
  formaPagamento?: string;
  cadastradoPor?: string;
  // Só o e-mail do Responsável usa os dois abaixo.
  grauDificuldade?: string;
  contexto?: string | null;
}

export interface EmailMontado {
  assunto: string;
  html: string;
}

function escapar(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function linha(rotulo: string, valor: string | null | undefined): string {
  if (!valor) return "";
  return `<tr>
    <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#6B7280;width:38%;vertical-align:top;">${escapar(rotulo)}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:14px;color:#111827;vertical-align:top;">${escapar(valor)}</td>
  </tr>`;
}

function blocoEmpresas(empresas: DadosEmailNovoContrato["empresas"], incluirCnpj: boolean): string {
  return empresas
    .map((e, i) => {
      const sufixo = empresas.length > 1 ? ` ${i + 1}` : "";
      return (
        linha(`Razão Social${sufixo}`, e.razaoSocial) +
        linha(`Nome Fantasia${sufixo}`, e.nomeFantasia) +
        (incluirCnpj ? linha(`CNPJ/CPF${sufixo}`, e.cnpj) : "")
      );
    })
    .join("");
}

/** Estrutura comum: cabeçalho azul da marca, tabela de dados, botão e rodapé. */
function moldura(titulo: string, linhasTabela: string, linkPainel: string, extra = ""): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#F5F7FA;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7FA;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;">
        <tr><td style="background:${AZUL_ESCURO};background-image:linear-gradient(135deg,${AZUL_ESCURO},${AZUL});padding:22px 24px;">
          <div style="font-size:12px;letter-spacing:1px;color:#BFD0FF;text-transform:uppercase;">ROMABC ONE</div>
          <div style="font-size:20px;font-weight:bold;color:#FFFFFF;margin-top:4px;">${escapar(titulo)}</div>
        </td></tr>
        <tr><td style="padding:20px 24px 8px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:8px;border-collapse:separate;">
            ${linhasTabela}
          </table>
          ${extra}
        </td></tr>
        <tr><td align="center" style="padding:16px 24px 28px 24px;">
          <a href="${escapar(linkPainel)}" style="display:inline-block;background:${AZUL};color:#FFFFFF;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 28px;border-radius:8px;">Abrir no painel</a>
        </td></tr>
        <tr><td style="padding:14px 24px;background:#F9FAFB;border-top:1px solid #E5E7EB;font-size:11px;color:#9CA3AF;text-align:center;">
          Mensagem automática da plataforma ROMABC ONE. Não responda este e-mail.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function nomeEmpresas(empresas: DadosEmailNovoContrato["empresas"]): string {
  const primeira = empresas[0]?.razaoSocial ?? "";
  return empresas.length > 1 ? `${primeira} (+${empresas.length - 1})` : primeira;
}

export function emailParaFinanceiro(d: DadosEmailNovoContrato): EmailMontado {
  const tabela =
    blocoEmpresas(d.empresas, true) +
    linha("Produto", d.produto) +
    linha("Plano", d.plano) +
    linha("UNE", d.une) +
    linha("Valor", d.valor) +
    linha("Tipo de pagamento", d.tipoPagamento) +
    linha("Forma de pagamento", d.formaPagamento) +
    linha("Início do contrato", d.dataInicio) +
    linha("Responsável", d.responsavel) +
    linha("Cadastrado por", d.cadastradoPor);

  return {
    assunto: `Novo contrato: ${nomeEmpresas(d.empresas)} - ${d.produto}`,
    html: moldura("Novo contrato cadastrado", tabela, d.linkPainel),
  };
}

export function emailParaResponsavel(d: DadosEmailNovoContrato): EmailMontado {
  // Sem valores financeiros nem documentos — só o necessário pra começar o atendimento.
  const tabela =
    blocoEmpresas(d.empresas, false) +
    linha("Produto", d.produto) +
    linha("Plano", d.plano) +
    linha("UNE", d.une) +
    linha("Início do contrato", d.dataInicio) +
    linha("Grau de dificuldade", d.grauDificuldade);

  const contexto = d.contexto?.trim()
    ? `<div style="margin-top:16px;">
        <div style="font-size:13px;color:#6B7280;margin-bottom:6px;">Perfil e contexto do cliente</div>
        <div style="font-size:14px;color:#111827;white-space:pre-wrap;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:12px;">${escapar(d.contexto.trim().slice(0, 3000))}</div>
      </div>`
    : "";

  return {
    assunto: `Novo cliente atribuído a você: ${nomeEmpresas(d.empresas)}`,
    html: moldura("Novo cliente atribuído a você", tabela, d.linkPainel, contexto),
  };
}
