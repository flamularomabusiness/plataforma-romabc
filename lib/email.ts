import nodemailer from "nodemailer";

export interface EnviarEmailParams {
  para: string | string[];
  assunto: string;
  html: string;
}

/**
 * Envio via Gmail (SMTP + Senha de App). SÓ servidor: as credenciais vêm de
 * variáveis sem NEXT_PUBLIC_ e este módulo nunca deve ser importado de
 * componente client. Lança erro se algo falhar — quem chama decide o que
 * fazer (lib/notificacoes.ts registra no log e segue em frente).
 */
export async function enviarEmail({ para, assunto, html }: EnviarEmailParams): Promise<void> {
  const usuario = process.env.GMAIL_USER;
  const senha = process.env.GMAIL_APP_PASSWORD;
  if (!usuario || !senha) {
    throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD não configurados no ambiente do servidor");
  }

  const transporte = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: usuario, pass: senha },
    // Sem isso, um SMTP travado seguraria a função serverless até o timeout da Vercel.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  await transporte.sendMail({
    from: { name: process.env.EMAIL_FROM_NAME || "ROMABC ONE", address: usuario },
    to: Array.isArray(para) ? para.join(", ") : para,
    subject: assunto,
    html,
  });
}
