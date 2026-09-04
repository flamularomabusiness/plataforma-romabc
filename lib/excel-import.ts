import type ExcelJS from "exceljs";
import { STATUS_CLIENTE, STATUS_PAGAMENTO } from "./types";
import type {
  ImportClienteRow,
  ImportLinhaValidada,
  ImportPagamentoRow,
  ImportPreview,
} from "./types";

// ---------------------------------------------------------------------------
// CNPJ — validação real (dígitos verificadores), não só formato.
// ---------------------------------------------------------------------------

export function validarCNPJ(cnpjBruto: string): boolean {
  const cnpj = (cnpjBruto ?? "").replace(/\D/g, "");
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  function digitoVerificador(base: string, pesos: number[]): number {
    const soma = base
      .split("")
      .reduce((acc, digito, i) => acc + Number(digito) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const digito1 = digitoVerificador(cnpj.slice(0, 12), pesos1);
  const digito2 = digitoVerificador(cnpj.slice(0, 12) + digito1, pesos2);

  return cnpj.slice(12) === `${digito1}${digito2}`;
}

export function formatarCNPJ(cnpjBruto: string): string {
  const cnpj = (cnpjBruto ?? "").replace(/\D/g, "").padEnd(14, "").slice(0, 14);
  if (cnpj.length !== 14) return cnpjBruto;
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

// ---------------------------------------------------------------------------
// Parsing de célula (data em Date object OU string "DD/MM/AAAA"; valor
// numérico OU string "R$ 5.000,00") — exceljs entrega Date pra colunas
// formatadas como data na planilha, mas o CEO pode ter digitado como texto.
// ---------------------------------------------------------------------------

// Date object -> "YYYY-MM-DD" usando getters locais (não toISOString: isso
// desloca um dia pra trás em timezones à frente de UTC). String "DD/MM/AAAA"
// -> "YYYY-MM-DD". Qualquer outro formato -> null.
export function formatarDataExcel(valor: unknown): string | null {
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    const ano = valor.getFullYear();
    const mes = String(valor.getMonth() + 1).padStart(2, "0");
    const dia = String(valor.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  if (typeof valor === "string") {
    const match = valor.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    const dia = Number(match[1]);
    const mes = Number(match[2]);
    const ano = Number(match[3]);
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  }

  return null;
}

export function parseValorCelula(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "string") {
    const limpo = valor
      .replace(/[^\d,.-]/g, "")
      .replace(/\.(?=\d{3}(?:[.,]|$))/g, "")
      .replace(",", ".");
    const n = Number(limpo);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function textoCelula(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "object" && "text" in (valor as any)) return String((valor as any).text ?? "");
  return String(valor).trim();
}

// ---------------------------------------------------------------------------
// Leitura do arquivo (client-side) — duas sheets, "CLIENTES" e "PAGAMENTOS".
// ---------------------------------------------------------------------------

const DIACRITICOS_REGEX = new RegExp(String.fromCharCode(0x5b, 0x300, 0x2d, 0x36f, 0x5d), "g");

function normalizarHeader(h: string): string {
  return h.normalize("NFD").replace(DIACRITICOS_REGEX, "").trim().toLowerCase();
}

function lerLinhasBrutas(sheet: ExcelJS.Worksheet): Record<string, unknown>[] {
  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = normalizarHeader(textoCelula(cell.value));
  });

  const linhas: Record<string, unknown>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const valores = row.values as unknown[];
    const temAlgumValor = headers.some(
      (h, i) => h && valores[i] !== undefined && valores[i] !== null && valores[i] !== ""
    );
    if (!temAlgumValor) return;

    const linha: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (h) linha[h] = valores[i];
    });
    linhas.push(linha);
  });
  return linhas;
}

export async function lerPlanilhaExcel(
  file: File
): Promise<{ clientesBrutos: Record<string, unknown>[]; pagamentosBrutos: Record<string, unknown>[] }> {
  // exceljs é uma dependência pesada — só carrega quando alguém de fato
  // seleciona um arquivo nesta página, em vez de no bundle inicial (mesmo
  // motivo do lazy-load do RevenueChart no dashboard).
  const { default: ExcelJSRuntime } = await import("exceljs");
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJSRuntime.Workbook();
  await workbook.xlsx.load(buffer);

  const sheetClientes = workbook.worksheets.find(
    (ws) => normalizarHeader(ws.name) === "clientes"
  );
  const sheetPagamentos = workbook.worksheets.find(
    (ws) => normalizarHeader(ws.name) === "pagamentos"
  );

  if (!sheetClientes) {
    throw new Error('Formato inválido: sheet "CLIENTES" não encontrada no arquivo.');
  }
  if (!sheetPagamentos) {
    throw new Error('Formato inválido: sheet "PAGAMENTOS" não encontrada no arquivo.');
  }

  return {
    clientesBrutos: lerLinhasBrutas(sheetClientes),
    pagamentosBrutos: lerLinhasBrutas(sheetPagamentos),
  };
}

// ---------------------------------------------------------------------------
// Validação linha a linha.
// ---------------------------------------------------------------------------

const COLUNAS_CLIENTES_OBRIGATORIAS = ["empresa", "cnpj", "une", "produto", "valor", "status", "data inicio"];
const COLUNAS_PAGAMENTOS_OBRIGATORIAS = ["empresa", "data vencimento", "valor", "status"];

export function verificarColunasObrigatorias(
  linhas: Record<string, unknown>[],
  obrigatorias: string[]
): string[] {
  if (linhas.length === 0) return [];
  const presentes = new Set(Object.keys(linhas[0]));
  return obrigatorias.filter((c) => !presentes.has(c));
}

export function validarLinhasClientes(
  linhas: Record<string, unknown>[],
  unesValidas: Set<string>,
  produtosPorUne: Map<string, Set<string>>
): ImportLinhaValidada<ImportClienteRow>[] {
  return linhas.map((linha, index) => {
    const mensagens: string[] = [];
    let severidade: "ok" | "aviso" | "erro" = "ok";
    const marcarErro = (msg: string) => {
      mensagens.push(msg);
      severidade = "erro";
    };

    const empresa = textoCelula(linha["empresa"]);
    const cnpjBruto = textoCelula(linha["cnpj"]);
    const une = textoCelula(linha["une"]);
    const produto = textoCelula(linha["produto"]);
    const statusBruto = textoCelula(linha["status"]).toUpperCase();
    const valor = parseValorCelula(linha["valor"]);
    const dataInicio = formatarDataExcel(linha["data inicio"]);

    if (!empresa) marcarErro("Empresa é obrigatória");
    if (!cnpjBruto) marcarErro("CNPJ é obrigatório");
    else if (!validarCNPJ(cnpjBruto)) marcarErro(`CNPJ inválido (${cnpjBruto})`);

    if (!une) marcarErro("UNE é obrigatória");
    else if (!unesValidas.has(une.toUpperCase())) marcarErro(`UNE "${une}" não encontrada`);

    if (!produto) marcarErro("Produto é obrigatório");
    else if (une && unesValidas.has(une.toUpperCase())) {
      const produtosDaUne = produtosPorUne.get(une.toUpperCase());
      if (!produtosDaUne || !produtosDaUne.has(produto.toUpperCase())) {
        marcarErro(`Produto "${produto}" não encontrado na UNE "${une}"`);
      }
    }

    if (valor === null) marcarErro("Valor inválido");
    else if (valor <= 0) marcarErro("Valor precisa ser maior que zero");

    if (!STATUS_CLIENTE.includes(statusBruto as any)) {
      marcarErro(`Status "${statusBruto || "(vazio)"}" inválido — use ATIVO, INATIVO ou INADIMPLENTE`);
    }

    if (!dataInicio) marcarErro(`Data Início inválida (${textoCelula(linha["data inicio"]) || "vazia"})`);

    return {
      linha: index + 2, // +2: header é a linha 1 da planilha, dados começam na 2
      dados: {
        empresa,
        cnpj: cnpjBruto ? formatarCNPJ(cnpjBruto) : cnpjBruto,
        une,
        produto,
        valor: valor ?? 0,
        status: (STATUS_CLIENTE.includes(statusBruto as any) ? statusBruto : "ATIVO") as ImportClienteRow["status"],
        data_inicio: dataInicio ?? "",
      },
      severidade,
      mensagens,
    };
  });
}

export function validarLinhasPagamentos(
  linhas: Record<string, unknown>[],
  empresasDoArquivo: Set<string>
): ImportLinhaValidada<ImportPagamentoRow>[] {
  return linhas.map((linha, index) => {
    const mensagens: string[] = [];
    let severidade: "ok" | "aviso" | "erro" = "ok";
    const marcarErro = (msg: string) => {
      mensagens.push(msg);
      severidade = "erro";
    };
    const marcarAviso = (msg: string) => {
      mensagens.push(msg);
      if (severidade === "ok") severidade = "aviso";
    };

    const empresa = textoCelula(linha["empresa"]);
    const statusBruto = textoCelula(linha["status"]).toUpperCase();
    const valor = parseValorCelula(linha["valor"]);
    const dataVencimento = formatarDataExcel(linha["data vencimento"]);
    const dataPagamento = formatarDataExcel(linha["data pagamento"]);

    if (!empresa) marcarErro("Empresa é obrigatória");
    else if (!empresasDoArquivo.has(empresa)) {
      marcarErro(`Empresa "${empresa}" não está na sheet CLIENTES deste arquivo`);
    }

    if (!dataVencimento) {
      marcarErro(`Data Vencimento inválida (${textoCelula(linha["data vencimento"]) || "vazia"})`);
    }

    if (valor === null) marcarErro("Valor inválido");
    else if (valor <= 0) marcarErro("Valor precisa ser maior que zero");

    if (!STATUS_PAGAMENTO.includes(statusBruto as any)) {
      marcarErro(
        `Status "${statusBruto || "(vazio)"}" inválido — use PROJETADO, PAGO, ATRASADO ou INADIMPLENTE`
      );
    }

    if (statusBruto === "PAGO" && !dataPagamento) {
      marcarErro("Status PAGO exige Data Pagamento preenchida");
    } else if (statusBruto !== "PAGO" && dataPagamento) {
      marcarAviso("Data Pagamento preenchida mas status não é PAGO — será ignorada");
    }

    return {
      linha: index + 2,
      dados: {
        empresa,
        data_vencimento: dataVencimento ?? "",
        valor: valor ?? 0,
        status: (STATUS_PAGAMENTO.includes(statusBruto as any)
          ? statusBruto
          : "PROJETADO") as ImportPagamentoRow["status"],
        data_pagamento: statusBruto === "PAGO" ? dataPagamento : null,
      },
      severidade,
      mensagens,
    };
  });
}

export function construirPreview(
  arquivoNome: string,
  clientes: ImportLinhaValidada<ImportClienteRow>[],
  pagamentos: ImportLinhaValidada<ImportPagamentoRow>[]
): ImportPreview {
  return {
    arquivoNome,
    clientes,
    pagamentos,
    temErro:
      clientes.some((l) => l.severidade === "erro") || pagamentos.some((l) => l.severidade === "erro"),
  };
}

export { COLUNAS_CLIENTES_OBRIGATORIAS, COLUNAS_PAGAMENTOS_OBRIGATORIAS };
