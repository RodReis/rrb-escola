#!/usr/bin/env node
// Registra repasse Isaac: marca todas cobranças abertas de uma competencia como pagas.
// valor_pago = valor_final, forma_pagamento = transferencia, observacao = Repasse Isaac
// Usage: node scripts/registrar_repasse_isaac.js [competencia]
// Default competencia: mês atual (ex: 2026-05)

const path = require("path");
const fs = require("fs");

const envPath = path.join(__dirname, "../.env.local");
const envLines = fs.readFileSync(envPath, "utf8").split("\n");
for (const line of envLines) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const { createClient } = require(path.join(__dirname, "../node_modules/@supabase/supabase-js"));

const ESCOLA_ID = "00000000-0000-0000-0000-000000000001";

const arg = process.argv[2];
const now = new Date();
const defaultComp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const competencia = arg ?? defaultComp;

const [year, month] = competencia.split("-");
const dataPagamento = `${year}-${month}-05`;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log(`Competencia: ${competencia} | Data pagamento: ${dataPagamento}`);

  const { data: cobrancas, error } = await supabase
    .from("cobrancas")
    .select("id, aluno_id, matricula_id, valor_final")
    .eq("escola_id", ESCOLA_ID)
    .eq("competencia", competencia)
    .in("status", ["aberta", "parcial", "vencida"]);

  if (error) throw new Error(`Erro buscando cobranças: ${error.message}`);
  console.log(`${cobrancas.length} cobranças abertas encontradas.`);

  if (cobrancas.length === 0) {
    console.log("Nada a registrar.");
    return;
  }

  const rows = cobrancas.map((c) => ({
    escola_id: ESCOLA_ID,
    cobranca_id: c.id,
    aluno_id: c.aluno_id,
    matricula_id: c.matricula_id,
    data_pagamento: dataPagamento,
    valor_pago: Number(c.valor_final),
    forma_pagamento: "transferencia",
    observacao: "Repasse Isaac",
  }));

  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error: insErr } = await supabase.from("pagamentos").insert(batch);
    if (insErr) throw new Error(`Erro inserindo lote ${i}: ${insErr.message}`);
    inserted += batch.length;
    process.stdout.write(`\r  Inseridos: ${inserted}/${rows.length}`);
  }

  console.log("\nOK. Trigger recalcula status automaticamente.");
  console.log("Concluído.");
}

main().catch((err) => {
  console.error("ERRO:", err.message);
  process.exit(1);
});
