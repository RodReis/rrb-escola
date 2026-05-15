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

if (!url || !serviceKey) {
  throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const { data: users, error: listError } = await supabase.auth.admin.listUsers();
if (listError) throw listError;

let user = users.users.find((item) => item.email === email);
if (!user) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome: "Administrador RRB Escola" }
  });
  if (error) throw error;
  user = data.user;
}

const { error: profileError } = await supabase.from("perfis").upsert(
  {
    user_id: user.id,
    escola_id: "00000000-0000-0000-0000-000000000001",
    nome: "Administrador RRB Escola",
    email,
    perfil: "admin",
    ativo: true
  },
  { onConflict: "user_id" }
);

if (profileError) throw profileError;

console.log(`Usuario admin pronto: ${email}`);
