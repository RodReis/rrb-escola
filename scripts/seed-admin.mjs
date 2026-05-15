import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(file) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.APP_DEFAULT_ADMIN_EMAIL ?? "admin@rrbescola.local";
const password = process.env.APP_DEFAULT_ADMIN_PASSWORD ?? "rrb123456";
const escolaId = process.env.DEFAULT_SCHOOL_ID ?? "00000000-0000-0000-0000-000000000001";

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

const { data: list, error: listError } = await supabase.auth.admin.listUsers();
if (listError) {
  console.error("Falha ao listar usuários:", listError.message);
  process.exit(1);
}

let user = list.users.find((item) => item.email === email);
if (!user) {
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome: "Administrador RRB Escola" }
  });
  if (createError) {
    console.error("Falha ao criar admin:", createError.message);
    process.exit(1);
  }
  user = created.user;
  console.log("Admin criado:", email);
} else {
  console.log("Admin já existe:", email);
}

if (user) {
  const { error: upsertError } = await supabase.from("perfis").upsert(
    {
      user_id: user.id,
      escola_id: escolaId,
      nome: "Administrador RRB Escola",
      email,
      perfil: "admin",
      ativo: true
    },
    { onConflict: "user_id" }
  );
  if (upsertError) {
    console.error("Falha ao garantir perfil:", upsertError.message);
    process.exit(1);
  }
  console.log("Perfil admin garantido.");
}
