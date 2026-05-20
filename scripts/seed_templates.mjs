#!/usr/bin/env node
// Migra os 6 templates de public/templates/* para o banco/Storage.
// Uso: node scripts/seed_templates.mjs <ESCOLA_ID>
// Requer SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no env.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const escolaId = process.argv[2];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!escolaId) {
  console.error("Uso: node scripts/seed_templates.mjs <ESCOLA_ID>");
  process.exit(1);
}

const SEED = [
  { arquivo: "contrato-colegio-integrado.docx",        nome: "Contrato — Colégio Integrado",           categoria: "contrato"   },
  { arquivo: "contrato-pinguinho.docx",                nome: "Contrato — Pinguinho de Gente",          categoria: "contrato"   },
  { arquivo: "declaracao-frequencia.docx",             nome: "Declaração de Frequência",               categoria: "declaracao" },
  { arquivo: "declaracao-transferencia.docx",          nome: "Declaração de Transferência",            categoria: "declaracao" },
  { arquivo: "termo-responsabilidade.docx",            nome: "Termo de Responsabilidade — Pinguinho",  categoria: "termo"      },
  { arquivo: "termo-responsabilidade-integrado.docx",  nome: "Termo de Responsabilidade — Integrado",  categoria: "termo"      },
];

const MAPPINGS = [
  { placeholder: "NOME_ALUNO",            type: "tabela",   table: "alunos",              column: "nome",         filter: null         },
  { placeholder: "SERIE_ALUNO",           type: "tabela",   table: "series",              column: "nome",         filter: null         },
  { placeholder: "TURNO_ALUNO",           type: "tabela",   table: "turmas",              column: "turno",        filter: null         },
  { placeholder: "ANO_LETIVO",            type: "tabela",   table: "matriculas",          column: "ano_letivo",   filter: "ativa"      },
  { placeholder: "NOME_PAI_ALUNO",        type: "tabela",   table: "responsaveis_aluno",  column: "nome",         filter: "pai"        },
  { placeholder: "RG_PAI_ALUNO",          type: "tabela",   table: "responsaveis_aluno",  column: "rg",           filter: "pai"        },
  { placeholder: "CPF_PAI_ALUNO",         type: "tabela",   table: "responsaveis_aluno",  column: "cpf",          filter: "pai"        },
  { placeholder: "NOME_MAE_ALUNO",        type: "tabela",   table: "responsaveis_aluno",  column: "nome",         filter: "mae"        },
  { placeholder: "RG_MAE_ALUNO",          type: "tabela",   table: "responsaveis_aluno",  column: "rg",           filter: "mae"        },
  { placeholder: "CPF_MAE_ALUNO",         type: "tabela",   table: "responsaveis_aluno",  column: "cpf",          filter: "mae"        },
  { placeholder: "NOME_RESP",             type: "tabela",   table: "responsaveis_aluno",  column: "nome",         filter: "financeiro" },
  { placeholder: "CPF_RESP",              type: "tabela",   table: "responsaveis_aluno",  column: "cpf",          filter: "financeiro" },
  { placeholder: "RG_RESP",               type: "tabela",   table: "responsaveis_aluno",  column: "rg",           filter: "financeiro" },
  { placeholder: "EMAIL_RESPONSAVEL",     type: "tabela",   table: "responsaveis_aluno",  column: "email",        filter: "financeiro" },
  { placeholder: "CELULAR_RESPONSAVEL",   type: "tabela",   table: "responsaveis_aluno",  column: "celular",      filter: "financeiro" },
  { placeholder: "TIPOENSINO_ALUNO",      type: "computed", fn: "tipo_ensino_via_series_segmentos" },
  { placeholder: "ENDERECO_PAI_ALUNO",    type: "computed", fn: "endereco_principal_formatado"     },
  { placeholder: "ENDERECO_MAE_ALUNO",    type: "computed", fn: "endereco_principal_formatado"     },
  { placeholder: "ENDERECO_RESP",         type: "computed", fn: "endereco_principal_formatado"     },
  { placeholder: "RAZAO_SOCIAL_EMPRESA",  type: "tabela",   table: "escolas",             column: "nome",         filter: null         },
  { placeholder: "FANTASIA_EMPRESA",      type: "tabela",   table: "escolas",             column: "nome",         filter: null         },
  { placeholder: "CIDADE_DATA_EXTENSO",   type: "computed", fn: "cidade_data_extenso"   },
  { placeholder: "DATA_HOJE_EXTENSO",     type: "computed", fn: "data_hoje_extenso"     },
];

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function main() {
  const dir = join(process.cwd(), "public", "templates");
  const files = new Set(await readdir(dir));

  for (const seed of SEED) {
    if (!files.has(seed.arquivo)) {
      console.warn(`Pulando ${seed.arquivo} (não encontrado em public/templates).`);
      continue;
    }
    const buffer = await readFile(join(dir, seed.arquivo));
    const id = randomUUID();
    const storagePath = `${escolaId}/templates/${id}.docx`;

    const { error: upErr } = await sb.storage.from("templates-documentos").upload(storagePath, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: false,
    });
    if (upErr) { console.error(`Storage falhou para ${seed.arquivo}:`, upErr.message); continue; }

    const { error: insErr } = await sb.from("templates_documentos").insert({
      id, escola_id: escolaId, nome: seed.nome, categoria: seed.categoria,
      storage_path: storagePath, ativo: true, mappings: MAPPINGS,
    });
    if (insErr) {
      console.error(`Insert falhou para ${seed.arquivo}:`, insErr.message);
      await sb.storage.from("templates-documentos").remove([storagePath]);
      continue;
    }
    console.log(`✓ ${seed.nome}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
