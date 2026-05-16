import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";

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

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatórios em .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

const FILES = [
  "public/04º F. pg 2026 (Escola Pinguinho ).xlsx",
  "public/04ºF. pg 2026 (Colegio Integrado).xlsx"
];

console.log("Seed payroll: iniciando.");
