// Supabase Auth Hook — registra eventos de autenticação no auth_evento_log.
//
// Captura eventos que NÃO passam pelo loginAction da app (ex.: tentativas via
// API direta do Supabase, magic links, recuperação de senha). Complementa o log
// que a aplicação já grava nos Server Actions.
//
// Registro (Dashboard → Authentication → Hooks) ou via config.toml:
//   [auth.hook.send_email]  -- não; este é um hook genérico HTTP
// Recomendado: registrar como "Before/After" hook apontando para a URL desta
// função e proteger com o header de assinatura (HOOK_SECRET).
//
// Deploy:  supabase functions deploy auth-event-hook --no-verify-jwt
// Secret:  supabase secrets set AUTH_HOOK_SECRET=<random>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HOOK_SECRET = Deno.env.get("AUTH_HOOK_SECRET") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Mapeia o tipo de evento do hook para o vocabulário do auth_evento_log.
function mapEvento(action: string | undefined): string {
  switch (action) {
    case "login":
      return "login_ok";
    case "login_failed":
    case "user_repeated_signup":
      return "login_falha";
    case "logout":
      return "logout";
    case "user_recovery_requested":
    case "password_recovery":
    case "user_updated_password":
      return "senha_alterada";
    case "user_deleted":
      return "dado_excluido";
    default:
      return action ?? "desconhecido";
  }
}

Deno.serve(async (req) => {
  // Proteção: o hook deve enviar o secret combinado (header ou query).
  if (HOOK_SECRET) {
    const provided =
      req.headers.get("x-hook-secret") ?? new URL(req.url).searchParams.get("secret");
    if (provided !== HOOK_SECRET) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // O payload do Auth Hook varia por versão; extraímos defensivamente.
  const user = (payload.user ?? payload.record ?? {}) as Record<string, unknown>;
  const metadata = (payload.metadata ?? {}) as Record<string, unknown>;
  const action = (payload.action ??
    payload.event ??
    metadata.action) as string | undefined;

  const userId = (user.id ?? payload.user_id ?? null) as string | null;
  const email = (user.email ?? payload.email ?? null) as string | null;
  const escolaId = ((user.app_metadata as Record<string, unknown> | undefined)
    ?.escola_id ?? null) as string | null;
  const ip = (metadata.ip_address ?? payload.ip ?? null) as string | null;

  const { error } = await admin.rpc("auth_gravar_evento", {
    p_escola_id: escolaId,
    p_user_id: userId,
    p_email: email,
    p_evento: mapEvento(action),
    p_recurso: null,
    p_recurso_id: null,
    p_detalhe: action ? `auth_hook:${action}` : "auth_hook",
    p_ip: ip,
    p_user_agent: (metadata.user_agent ?? null) as string | null,
  });

  if (error) {
    // Não bloquear o fluxo de auth do Supabase: responder 200 mesmo em erro de log.
    console.error("auth-event-hook: falha ao gravar log", error);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
