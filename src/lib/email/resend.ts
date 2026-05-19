import "server-only";
import { Resend } from "resend";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
};

export type SendEmailResult = { ok: true } | { ok: false; reason: string };

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<SendEmailResult> {
  const resend = getResend();
  if (!resend) return { ok: false, reason: "RESEND_API_KEY not configured" };

  const from = process.env.RESEND_FROM ?? "RRB Escola <onboarding@resend.dev>";

  try {
    const { error } = await resend.emails.send({ from, to, subject, html });
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "send failed" };
  }
}

export function renderPasswordResetEmail({
  nome,
  email,
  password,
  appUrl,
}: {
  nome: string;
  email: string;
  password: string;
  appUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>RRB Escola — Nova senha</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f6f8; padding: 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
    <tr>
      <td style="background: linear-gradient(180deg, #1B3FB8 0%, #15349E 100%); padding: 24px; color: white;">
        <h1 style="margin: 0; font-size: 18px; font-weight: 600;">RRB Escola</h1>
        <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.7;">Sistema de Gestão Escolar</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 24px;">
        <h2 style="margin: 0 0 16px; font-size: 16px; color: #1a2240;">Olá, ${nome}</h2>
        <p style="margin: 0 0 16px; color: #4b5563; line-height: 1.5;">Sua senha foi redefinida por um administrador. Use as credenciais abaixo para acessar o sistema:</p>
        <table cellpadding="12" cellspacing="0" style="margin: 16px 0; background: #f5f6f8; border-radius: 6px; width: 100%;">
          <tr>
            <td style="font-size: 13px; color: #6b7280;">Email</td>
            <td style="font-size: 13px; font-family: monospace; color: #1a2240; text-align: right;">${email}</td>
          </tr>
          <tr>
            <td style="font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb;">Senha temporária</td>
            <td style="font-size: 13px; font-family: monospace; color: #1a2240; text-align: right; border-top: 1px solid #e5e7eb;">${password}</td>
          </tr>
        </table>
        <p style="margin: 24px 0 8px; color: #4b5563; line-height: 1.5;"><strong>Recomendamos alterar a senha após o primeiro acesso.</strong></p>
        <p style="margin: 24px 0 0;">
          <a href="${appUrl}" style="display: inline-block; background: #1B3FB8; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 13px;">Acessar o sistema</a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center;">
        Se você não solicitou esta alteração, entre em contato com um administrador.
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function renderUserCreatedEmail(args: {
  nome: string;
  email: string;
  password: string;
  appUrl: string;
}): string {
  const html = renderPasswordResetEmail(args);
  return html.replace(
    "Sua senha foi redefinida por um administrador",
    "Sua conta foi criada por um administrador",
  );
}
