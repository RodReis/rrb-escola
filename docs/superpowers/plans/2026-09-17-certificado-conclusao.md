# Certificado de Conclusão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tela de parâmetros com preview onde a secretária configura o certificado de conclusão e emite, num PDF único, para a turma inteira — com o histórico escolar no verso.

**Architecture:** Três camadas independentes. Um gerador jsPDF puro (`certificado-pdf.ts`) que não conhece React nem Supabase; uma camada de dados (`certificados.ts`) que carrega config, elegíveis e snapshot do histórico; e a UI em abas com preview que chama o **mesmo** gerador da emissão. O histórico é um snapshot em jsonb por matrícula, pré-preenchido do que o sistema já tem.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres + RLS), jsPDF 4.2.1, jspdf-autotable 5.0.7, vitest (ambiente node), Tailwind com tokens do design system.

**Spec:** [docs/superpowers/specs/2026-09-17-certificado-conclusao-design.md](../specs/2026-09-17-certificado-conclusao-design.md)

## Global Constraints

- **Português (PT-BR)** em toda a UI, nomes de colunas e mensagens.
- **Cor só via token** (`var(--token)` ou classe Tailwind tokenizada). Proibido hex/rgb cru no JSX/CSS. Não vale para o PDF: jsPDF exige valores RGB numéricos e não lê CSS.
- **Sem serifa na UI.** Títulos em Bricolage Grotesque via `font-display`. O PDF usa `times` — é documento oficial impresso, fora do design system da aplicação.
- **Nunca usar `confirm()` nativo.** Usar `useConfirm` ou `ConfirmButton` de `src/components/ui/`.
- **Trava de qualidade por tarefa:** `npm run typecheck && npm run build` verdes antes do commit. `npm run test` antes do PR.
- **Branch dedicada:** `feat/certificados`. Um commit por tarefa.
- **Migrações:** nomear `2026MMDDNNNN_<descricao>.sql` em `supabase/migrations/`. Validar por review e `db push` — **não** rodar `supabase db reset --local`, que está quebrado neste repo (ordem de `inss_brackets`).
- **Escola padrão:** `DEFAULT_SCHOOL_ID` de `@/lib/constants`, como em `src/lib/data/pedagogico.ts`.
- **Módulo RBAC novo exige 3 lugares:** `MODULOS` em `src/lib/auth/permissions.ts`, `ROTA_PARA_MODULO` no mesmo arquivo, e seed em `modulos` + `role_permissoes` na migração. O comentário em `permissions.ts:87` documenta isso.
- **Menus do topbar são arrays hardcoded.** RBAC apenas filtra; um módulo novo não aparece sem editar o array.

---

## File Structure

**Criados:**

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/202609180001_certificados.sql` | Tabelas `certificado_config` e `certificado_historico`, coluna `nacionalidade`, seed RBAC |
| `src/lib/documents/pdf-utils.ts` | `urlToDataUrl` e `imgFitInBox` — hoje duplicados nos `export-*-button.tsx` |
| `src/lib/documents/certificado-tipos.ts` | Todos os tipos (`CertificadoData`, `CertificadoOptions`, `HistoricoEscolar`, …). Um lugar só, importado por dados, gerador e UI |
| `src/lib/documents/certificado-texto.ts` | Montagem do parágrafo do corpo em segmentos `{texto, negrito}`. Puro, sem jsPDF |
| `src/lib/documents/certificado-texto.test.ts` | Teste do montador de texto |
| `src/lib/documents/certificado-pdf.ts` | `renderCertificados()` e os blocos de render |
| `src/lib/documents/certificado-pdf.test.ts` | Teste do gerador |
| `src/lib/data/certificados.ts` | Config, elegíveis, `CertificadoData`, rascunho do histórico |
| `src/lib/actions/certificados.ts` | Server Actions: salvar config, salvar histórico |
| `src/app/(app)/certificados/page.tsx` | Server Component: carrega config, séries, turmas, anos |
| `src/app/(app)/certificados/certificado-form.tsx` | Client: estado das abas e orquestração |
| `src/app/(app)/certificados/abas/aba-filtros.tsx` | Filtros + lista de elegíveis com seleção |
| `src/app/(app)/certificados/abas/aba-conteudo.tsx` | Texto do certificado |
| `src/app/(app)/certificados/abas/aba-historico.tsx` | Toggle + seletor de aluno + editor de grade |
| `src/app/(app)/certificados/abas/aba-leiaute.tsx` | Orientação, margens, fonte, logos, moldura |
| `src/app/(app)/certificados/abas/aba-assinatura.tsx` | Linhas de assinatura |
| `src/app/(app)/certificados/certificado-preview.tsx` | Iframe com blob URL, debounce 400ms |
| `src/app/api/certificados/elegiveis/route.ts` | GET dos elegíveis — o filtro muda no cliente, então a lista não pode vir só do Server Component |

**Modificados:**

| Arquivo | Mudança |
|---|---|
| `src/lib/auth/permissions.ts` | `MODULOS` + `ROTA_PARA_MODULO` ganham `certificados` |
| `src/components/layout/topbar.tsx` | Item `/certificados` em `SECRETARIA_ITEMS` |

**Nota sobre o tamanho dos arquivos:** as abas são componentes separados porque `certificado-form.tsx` com as cinco inline passaria de 800 linhas — o limite do CLAUDE.md. Cada aba recebe seu pedaço do estado por props e não conhece as irmãs.

---

### Task 1: Migração e tipos

**Files:**
- Create: `supabase/migrations/202609180001_certificados.sql`
- Create: `src/lib/documents/certificado-tipos.ts`
- Modify: `src/lib/auth/permissions.ts` (`MODULOS` ~linha 38, `ROTA_PARA_MODULO` ~linha 108)

**Interfaces:**
- Consumes: nada (primeira tarefa)
- Produces: os tipos `LinhaGrade`, `SerieResumo`, `EnsinoAnterior`, `HistoricoEscolar`, `LinhaAssinatura`, `CertificadoLeiaute`, `CertificadoOptions`, `CertificadoAluno`, `CertificadoEscola`, `CertificadoData`, `CERTIFICADO_DEFAULTS` — todo o resto do plano importa daqui.

- [ ] **Step 1: Escrever a migração**

Criar `supabase/migrations/202609180001_certificados.sql`:

```sql
-- Certificado de conclusão: configuração por escola + snapshot do histórico por matrícula

alter table alunos add column if not exists nacionalidade text not null default 'BRASILEIRA';

create table if not exists certificado_config (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  texto_inicio text not null default 'O Diretor do',
  descricao_curso text not null default 'ENSINO MÉDIO',
  base_legal text not null default 'sob a Resolução CEE/CEB N.01, de 14 de janeiro de 2022 de acordo com a Lei Nº 9394 de 20 de dezembro de 1996.',
  titulo_certificado text not null default 'Certificado',
  mostrar_historico boolean not null default false,
  registro_em_branco boolean not null default false,
  leiaute jsonb not null default '{}'::jsonb,
  assinaturas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escola_id)
);

create table if not exists certificado_historico (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  matricula_id uuid not null references matriculas(id) on delete cascade,
  aluno_id uuid not null references alunos(id) on delete cascade,
  ensino_anterior jsonb not null default '{}'::jsonb,
  grade jsonb not null default '[]'::jsonb,
  series_resumo jsonb not null default '[]'::jsonb,
  observacoes text,
  registro_numero text,
  registro_livro text,
  registro_folha text,
  preenchido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (matricula_id)
);

create index if not exists certificado_historico_escola_idx
  on certificado_historico (escola_id, aluno_id);

create trigger certificado_config_updated_at before update on certificado_config
  for each row execute function set_updated_at();
create trigger certificado_historico_updated_at before update on certificado_historico
  for each row execute function set_updated_at();

alter table certificado_config enable row level security;
alter table certificado_historico enable row level security;

create policy certificado_config_rw on certificado_config for all
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy certificado_historico_rw on certificado_historico for all
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

-- RBAC
insert into modulos (codigo, grupo, nome, ordem) values
  ('certificados', 'secretaria', 'Certificados', 14)
on conflict (codigo) do update set grupo = excluded.grupo, nome = excluded.nome, ordem = excluded.ordem;

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar) values
  ('admin', 'certificados', true, true, true, true),
  ('secretaria', 'certificados', true, true, true, false),
  ('financeiro', 'certificados', false, false, false, false),
  ('professor', 'certificados', false, false, false, false)
on conflict (role_codigo, modulo_codigo) do update set
  pode_ler = excluded.pode_ler, pode_criar = excluded.pode_criar,
  pode_editar = excluded.pode_editar, pode_deletar = excluded.pode_deletar;

comment on table certificado_config is 'Parametros padrao do certificado de conclusao por escola';
comment on table certificado_historico is 'Snapshot do historico escolar usado no verso do certificado';
```

Antes de rodar, confirmar que `role_permissoes` tem unique em `(role_codigo, modulo_codigo)`:

```bash
grep -n "unique (role_codigo" supabase/migrations/202605300001_rbac_permissoes.sql
```

Se não houver, trocar o `on conflict (role_codigo, modulo_codigo) do update ...` por `on conflict do nothing`.

- [ ] **Step 2: Escrever os tipos**

Criar `src/lib/documents/certificado-tipos.ts`:

```typescript
/** Uma linha da grade do histórico: um componente curricular em várias séries. */
export type LinhaGrade = {
  componente: string;
  /** "comum" = Parte Nacional Comum; "diversificada" = Parte Diversificada. */
  parte: "comum" | "diversificada";
  /** Uma entrada por série cursada. `media` e `ch` nulos viram "-" no PDF. */
  series: Array<{ serie: string; media: number | null; ch: number | null }>;
  chTotal: number | null;
};

export type SerieResumo = {
  serie: string;
  ano: number;
  estabelecimento: string;
  cidade: string;
  uf: string;
  resultado: string;
  chAnual: number | null;
  diasLetivos: number | null;
};

export type EnsinoAnterior = {
  nivel: string;
  escola: string;
  cidade: string;
  uf: string;
  ano: number | null;
};

export type HistoricoEscolar = {
  ensinoAnterior: EnsinoAnterior | null;
  grade: LinhaGrade[];
  seriesResumo: SerieResumo[];
  observacoes: string;
  registroNumero: string;
  registroLivro: string;
  registroFolha: string;
  /** null = rascunho gerado na hora, ainda não salvo pela secretária. */
  preenchidoEm: string | null;
};

export type LinhaAssinatura = { nome: string; cargo: string };

export type CertificadoLeiaute = {
  orientacao: "landscape" | "portrait";
  margemMm: number;
  fonteCorpoPt: number;
  mostrarLogos: boolean;
  mostrarMoldura: boolean;
};

export type CertificadoOptions = {
  tituloCertificado: string;
  textoInicio: string;
  descricaoCurso: string;
  baseLegal: string;
  anoConclusao: number;
  dataEmissao: string;
  /** Quando preenchido, substitui o parágrafo padrão. Aceita {{aluno}}, {{ano}}, {{curso}}. */
  textoCustomizado: string | null;
  mostrarHistorico: boolean;
  registroEmBranco: boolean;
  leiaute: CertificadoLeiaute;
  assinaturas: LinhaAssinatura[];
};

export type CertificadoAluno = {
  alunoId: string;
  matriculaId: string;
  nome: string;
  nacionalidade: string;
  naturalidade: string | null;
  dataNascimento: string | null;
  rg: string | null;
  nomePai: string | null;
  nomeMae: string | null;
  serie: string;
  turma: string;
  anoLetivo: number;
  historico: HistoricoEscolar | null;
};

export type CertificadoEscola = {
  nome: string;
  mantenedora: string | null;
  cnpj: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  logoUrl: string | null;
};

export type CertificadoData = {
  escola: CertificadoEscola;
  aluno: CertificadoAluno;
};

export const CERTIFICADO_DEFAULTS: {
  leiaute: CertificadoLeiaute;
  assinaturas: LinhaAssinatura[];
} = {
  leiaute: {
    orientacao: "landscape",
    margemMm: 15,
    fonteCorpoPt: 11,
    mostrarLogos: true,
    mostrarMoldura: false,
  },
  assinaturas: [
    { nome: "", cargo: "Aluno(a)" },
    { nome: "", cargo: "Secretária" },
    { nome: "", cargo: "Diretora" },
  ],
};
```

`mantenedora` não existe em `escolas` hoje. A camada de dados devolve `null` e o cabeçalho omite a linha — **não** adicionar coluna nesta tarefa.

- [ ] **Step 3: Registrar o módulo RBAC**

Em `src/lib/auth/permissions.ts`, dentro de `MODULOS`, logo após a linha `"documentos.templates"`:

```typescript
  certificados: { grupo: "secretaria", nome: "Certificados" },
```

E em `ROTA_PARA_MODULO`, junto das outras rotas de secretaria:

```typescript
  "/certificados": "certificados",
```

- [ ] **Step 4: Verificar**

```bash
npm run typecheck
```
Esperado: sem erros. `certificado-tipos.ts` não importa nada, então só valida a sintaxe e a edição em `permissions.ts`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202609180001_certificados.sql src/lib/documents/certificado-tipos.ts src/lib/auth/permissions.ts
git commit -m "feat(certificados): migracao, tipos e modulo RBAC"
```

---

### Task 2: Extrair pdf-utils

**Files:**
- Create: `src/lib/documents/pdf-utils.ts`
- Modify: `src/components/pdf/export-boletim-button.tsx:11-46` (remover as duas funções locais, importar)

**Interfaces:**
- Consumes: nada
- Produces: `urlToDataUrl(url: string | null): Promise<{data: string; w: number; h: number} | null>` e `imgFitInBox(orig: {w,h}, maxW: number, maxH: number): {w: number; h: number}`

- [ ] **Step 1: Criar o módulo compartilhado**

Criar `src/lib/documents/pdf-utils.ts` — corpo copiado de `export-boletim-button.tsx:11-46`, sem alterações de comportamento:

```typescript
"use client";

/** Baixa uma imagem e devolve data URL + dimensões naturais. Null se falhar. */
export async function urlToDataUrl(
  url: string | null
): Promise<{ data: string; w: number; h: number } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const data: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims: { w: number; h: number } = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 100, h: 100 });
      img.src = data;
    });
    return { data, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

/** Escala preservando proporção para caber na caixa. */
export function imgFitInBox(
  orig: { w: number; h: number },
  maxW: number,
  maxH: number
): { w: number; h: number } {
  const ratio = Math.min(maxW / orig.w, maxH / orig.h);
  return { w: orig.w * ratio, h: orig.h * ratio };
}
```

- [ ] **Step 2: Trocar o boletim para usar o módulo**

Em `src/components/pdf/export-boletim-button.tsx`, apagar as funções `urlToDataUrl` e `imgFitInBox` e adicionar o import junto aos outros:

```typescript
import { urlToDataUrl, imgFitInBox } from "@/lib/documents/pdf-utils";
```

Mexer **apenas** no boletim. Os outros `export-*-button.tsx` ficam como estão — migrá-los é refactor não relacionado a esta feature.

- [ ] **Step 3: Verificar**

```bash
npm run typecheck && npm run build
```
Esperado: ambos verdes. Se o build reclamar de import não usado no boletim, foi sobra da remoção — apagar.

- [ ] **Step 4: Commit**

```bash
git add src/lib/documents/pdf-utils.ts src/components/pdf/export-boletim-button.tsx
git commit -m "refactor(pdf): extrai urlToDataUrl e imgFitInBox para pdf-utils"
```

---

### Task 3: Montador do texto do corpo

O parágrafo tem campos em negrito no meio do texto corrido. jsPDF não tem rich text, então o texto vira uma lista de segmentos que o gerador desenha com a fonte certa. Esta tarefa é só a montagem — pura, testável sem PDF.

**Files:**
- Create: `src/lib/documents/certificado-texto.ts`
- Test: `src/lib/documents/certificado-texto.test.ts`

**Interfaces:**
- Consumes: `CertificadoData`, `CertificadoOptions` de `./certificado-tipos`
- Produces: `type Segmento = { texto: string; negrito: boolean }`, `montarCorpo(data: CertificadoData, opts: CertificadoOptions): Segmento[]`, `formatarDataExtenso(iso: string): string`, `formatarDataCurta(iso: string | null): string`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/documents/certificado-texto.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { montarCorpo, formatarDataExtenso, formatarDataCurta } from "./certificado-texto";
import { CERTIFICADO_DEFAULTS } from "./certificado-tipos";
import type { CertificadoData, CertificadoOptions } from "./certificado-tipos";

const escola: CertificadoData["escola"] = {
  nome: "EPG TRINDADE",
  mantenedora: null,
  cnpj: "35.027.047/0001-23",
  endereco: "RUA EUGÊNIO JARDIM, 473",
  cidade: "TRINDADE",
  uf: "GO",
  cep: "75388-686",
  logoUrl: null,
};

const aluno: CertificadoData["aluno"] = {
  alunoId: "a1",
  matriculaId: "m1",
  nome: "VITÓRIA VIEIRA VÍTOR",
  nacionalidade: "BRASILEIRA",
  naturalidade: "GOIÂNIA-GO",
  dataNascimento: "2006-11-22",
  rg: "6063621 2ª VIA PC GO",
  nomePai: "JANIRO VIEIRA DA COSTA",
  nomeMae: "MARIA JOSÉ DA SILVA VITOR",
  serie: "3ª SÉRIE - EM",
  turma: "A",
  anoLetivo: 2024,
  historico: null,
};

const opts: CertificadoOptions = {
  tituloCertificado: "Certificado",
  textoInicio: "A Diretora da",
  descricaoCurso: "ENSINO MÉDIO",
  baseLegal: "sob a Resolução CEE/CEB N.01, de 14 de janeiro de 2022.",
  anoConclusao: 2024,
  dataEmissao: "2026-09-17",
  textoCustomizado: null,
  mostrarHistorico: false,
  registroEmBranco: false,
  leiaute: CERTIFICADO_DEFAULTS.leiaute,
  assinaturas: CERTIFICADO_DEFAULTS.assinaturas,
};

const data: CertificadoData = { escola, aluno };
const juntar = (segs: Array<{ texto: string }>) => segs.map((s) => s.texto).join("");

describe("montarCorpo", () => {
  it("põe nome, filiação, naturalidade, nascimento, ano e curso em negrito", () => {
    const segs = montarCorpo(data, opts);
    const negrito = segs.filter((s) => s.negrito).map((s) => s.texto);
    expect(negrito).toContain("VITÓRIA VIEIRA VÍTOR");
    expect(negrito).toContain("BRASILEIRA");
    expect(negrito).toContain("JANIRO VIEIRA DA COSTA");
    expect(negrito).toContain("MARIA JOSÉ DA SILVA VITOR");
    expect(negrito).toContain("GOIÂNIA-GO");
    expect(negrito).toContain("22/11/2006");
    expect(negrito).toContain("2024");
    expect(negrito).toContain("ENSINO MÉDIO");
  });

  it("monta um parágrafo legível com a base legal ao final", () => {
    const texto = juntar(montarCorpo(data, opts));
    expect(texto).toContain("A Diretora da EPG TRINDADE, certifica que VITÓRIA VIEIRA VÍTOR");
    expect(texto).toContain("concluiu no ano letivo de 2024 o ENSINO MÉDIO");
    expect(texto).toContain("sob a Resolução CEE/CEB N.01");
    expect(texto).not.toContain("  ");
  });

  it("omite trechos de campos ausentes sem deixar buraco", () => {
    const semDados: CertificadoData = {
      escola,
      aluno: { ...aluno, rg: null, nomePai: null, nomeMae: null, naturalidade: null },
    };
    const texto = juntar(montarCorpo(semDados, opts));
    expect(texto).not.toContain("null");
    expect(texto).not.toContain("undefined");
    expect(texto).not.toContain("filho(a) de  e de");
    expect(texto).not.toContain("  ");
    expect(texto).toContain("concluiu no ano letivo de 2024");
  });

  it("usa o texto customizado com placeholders quando fornecido", () => {
    const segs = montarCorpo(data, {
      ...opts,
      textoCustomizado: "O aluno {{aluno}} concluiu {{curso}} em {{ano}}.",
    });
    const texto = juntar(segs);
    expect(texto).toBe("O aluno VITÓRIA VIEIRA VÍTOR concluiu ENSINO MÉDIO em 2024.");
    expect(segs.filter((s) => s.negrito).map((s) => s.texto)).toContain("VITÓRIA VIEIRA VÍTOR");
  });
});

describe("formatarDataExtenso", () => {
  it("formata em português por extenso", () => {
    expect(formatarDataExtenso("2026-09-17")).toBe("17 de setembro de 2026");
  });

  it("não desloca o dia por fuso horário", () => {
    expect(formatarDataExtenso("2026-01-01")).toBe("1 de janeiro de 2026");
  });
});

describe("formatarDataCurta", () => {
  it("formata como dd/mm/aaaa", () => {
    expect(formatarDataCurta("2006-11-22")).toBe("22/11/2006");
  });

  it("devolve string vazia para data ausente", () => {
    expect(formatarDataCurta(null)).toBe("");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx vitest run src/lib/documents/certificado-texto.test.ts
```
Esperado: FAIL — `Failed to resolve import "./certificado-texto"`.

- [ ] **Step 3: Implementar**

Criar `src/lib/documents/certificado-texto.ts`:

```typescript
import type { CertificadoData, CertificadoOptions } from "./certificado-tipos";

export type Segmento = { texto: string; negrito: boolean };

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Parte "YYYY-MM-DD" como data local — `new Date(iso)` trata como UTC e desloca o dia. */
function partesData(iso: string): { dia: number; mes: number; ano: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return { ano: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };
}

export function formatarDataExtenso(iso: string): string {
  const p = partesData(iso);
  if (!p) return "";
  return `${p.dia} de ${MESES[p.mes - 1]} de ${p.ano}`;
}

export function formatarDataCurta(iso: string | null): string {
  if (!iso) return "";
  const p = partesData(iso);
  if (!p) return "";
  const dd = String(p.dia).padStart(2, "0");
  const mm = String(p.mes).padStart(2, "0");
  return `${dd}/${mm}/${p.ano}`;
}

/** Junta segmentos e normaliza espaços, para que campos ausentes não deixem buraco. */
function normalizar(segs: Segmento[]): Segmento[] {
  const limpos = segs.filter((s) => s.texto !== "");
  const saida: Segmento[] = [];
  for (const seg of limpos) {
    const anterior = saida[saida.length - 1];
    const texto = seg.texto.replace(/\s+/g, " ");
    if (anterior && anterior.negrito === seg.negrito) {
      anterior.texto += texto;
    } else {
      saida.push({ texto, negrito: seg.negrito });
    }
  }
  if (saida.length > 0) {
    saida[0].texto = saida[0].texto.replace(/^\s+/, "");
    const ultimo = saida[saida.length - 1];
    ultimo.texto = ultimo.texto.replace(/\s+$/, "");
  }
  // Espaço duplicado na junção de segmentos (ex.: campo ausente no meio).
  for (let i = 0; i < saida.length - 1; i++) {
    if (saida[i].texto.endsWith(" ") && saida[i + 1].texto.startsWith(" ")) {
      saida[i + 1].texto = saida[i + 1].texto.replace(/^\s+/, "");
    }
  }
  return saida.filter((s) => s.texto !== "");
}

function montarFiliacao(nomePai: string | null, nomeMae: string | null): Segmento[] {
  const pai = nomePai?.trim() ?? "";
  const mae = nomeMae?.trim() ?? "";
  if (pai && mae) {
    return [
      { texto: " filho(a) de ", negrito: false },
      { texto: pai, negrito: true },
      { texto: " e de ", negrito: false },
      { texto: mae, negrito: true },
    ];
  }
  const unico = pai || mae;
  if (unico) {
    return [
      { texto: " filho(a) de ", negrito: false },
      { texto: unico, negrito: true },
    ];
  }
  return [];
}

function montarCustomizado(
  modelo: string,
  data: CertificadoData,
  opts: CertificadoOptions
): Segmento[] {
  const valores: Record<string, string> = {
    aluno: data.aluno.nome,
    curso: opts.descricaoCurso,
    ano: String(opts.anoConclusao),
    escola: data.escola.nome,
    serie: data.aluno.serie,
    nascimento: formatarDataCurta(data.aluno.dataNascimento),
    naturalidade: data.aluno.naturalidade ?? "",
    rg: data.aluno.rg ?? "",
    pai: data.aluno.nomePai ?? "",
    mae: data.aluno.nomeMae ?? "",
  };
  const segs: Segmento[] = [];
  const re = /\{\{(\w+)\}\}/g;
  let pos = 0;
  let achado: RegExpExecArray | null;
  while ((achado = re.exec(modelo)) !== null) {
    if (achado.index > pos) {
      segs.push({ texto: modelo.slice(pos, achado.index), negrito: false });
    }
    // Placeholder desconhecido fica literal, para a secretária ver o erro de digitação.
    const valor = valores[achado[1]];
    segs.push(
      valor === undefined
        ? { texto: achado[0], negrito: false }
        : { texto: valor, negrito: true }
    );
    pos = achado.index + achado[0].length;
  }
  if (pos < modelo.length) segs.push({ texto: modelo.slice(pos), negrito: false });
  return normalizar(segs);
}

export function montarCorpo(data: CertificadoData, opts: CertificadoOptions): Segmento[] {
  if (opts.textoCustomizado && opts.textoCustomizado.trim() !== "") {
    return montarCustomizado(opts.textoCustomizado, data, opts);
  }

  const { aluno, escola } = data;
  const segs: Segmento[] = [
    { texto: `${opts.textoInicio} `, negrito: false },
    { texto: escola.nome, negrito: true },
    { texto: ", certifica que ", negrito: false },
    { texto: aluno.nome, negrito: true },
  ];

  if (aluno.nacionalidade?.trim()) {
    segs.push({ texto: " de nacionalidade ", negrito: false });
    segs.push({ texto: aluno.nacionalidade.trim(), negrito: true });
  }

  segs.push(...montarFiliacao(aluno.nomePai, aluno.nomeMae));

  if (aluno.naturalidade?.trim()) {
    segs.push({ texto: " natural de ", negrito: false });
    segs.push({ texto: aluno.naturalidade.trim(), negrito: true });
  }

  const nascimento = formatarDataCurta(aluno.dataNascimento);
  if (nascimento) {
    segs.push({ texto: " nascido(a) em ", negrito: false });
    segs.push({ texto: nascimento, negrito: true });
  }

  if (aluno.rg?.trim()) {
    segs.push({ texto: ", portador(a) do RG Nº ", negrito: false });
    segs.push({ texto: aluno.rg.trim(), negrito: false });
  }

  segs.push({ texto: ", concluiu no ano letivo de ", negrito: false });
  segs.push({ texto: String(opts.anoConclusao), negrito: true });
  segs.push({ texto: " o ", negrito: false });
  segs.push({ texto: opts.descricaoCurso, negrito: true });
  segs.push({ texto: " neste Estabelecimento de Ensino ", negrito: false });
  segs.push({ texto: opts.baseLegal, negrito: false });

  return normalizar(segs);
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx vitest run src/lib/documents/certificado-texto.test.ts
```
Esperado: PASS, 9 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/documents/certificado-texto.ts src/lib/documents/certificado-texto.test.ts
git commit -m "feat(certificados): montador do texto do corpo com negrito inline"
```

---

### Task 4: Gerador PDF — página 1

**Files:**
- Create: `src/lib/documents/certificado-pdf.ts`
- Test: `src/lib/documents/certificado-pdf.test.ts`

**Interfaces:**
- Consumes: `montarCorpo`, `formatarDataExtenso` de `./certificado-texto`; tipos de `./certificado-tipos`; `urlToDataUrl`, `imgFitInBox` de `./pdf-utils`
- Produces: `renderCertificados(alunos: CertificadoData[], opts: CertificadoOptions, imagens?: Map<string, {data: string; w: number; h: number}>): jsPDF`

`renderCertificados` é **síncrona**. As imagens já vêm baixadas num Map (chave = URL), porque quem chama — preview e emissão — precisa controlar quando o download acontece, e porque teste em ambiente node não tem `fetch` de imagem nem `Image`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/documents/certificado-pdf.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { renderCertificados } from "./certificado-pdf";
import { CERTIFICADO_DEFAULTS } from "./certificado-tipos";
import type { CertificadoData, CertificadoOptions } from "./certificado-tipos";

const escola: CertificadoData["escola"] = {
  nome: "EPG TRINDADE",
  mantenedora: "ESCOLA INFANTIL PINGUINHO DE GENTE LTDA",
  cnpj: "35.027.047/0001-23",
  endereco: "RUA EUGÊNIO JARDIM, 473, SALA 02, CENTRO",
  cidade: "TRINDADE",
  uf: "GO",
  cep: "75388-686",
  logoUrl: null,
};

function alunoFake(n: number): CertificadoData["aluno"] {
  return {
    alunoId: `a${n}`,
    matriculaId: `m${n}`,
    nome: `ALUNO TESTE ${n}`,
    nacionalidade: "BRASILEIRA",
    naturalidade: "GOIÂNIA-GO",
    dataNascimento: "2006-11-22",
    rg: "6063621",
    nomePai: "PAI TESTE",
    nomeMae: "MAE TESTE",
    serie: "3ª SÉRIE - EM",
    turma: "A",
    anoLetivo: 2024,
    historico: null,
  };
}

const opts: CertificadoOptions = {
  tituloCertificado: "Certificado",
  textoInicio: "A Diretora da",
  descricaoCurso: "ENSINO MÉDIO",
  baseLegal: "sob a Resolução CEE/CEB N.01, de 14 de janeiro de 2022 de acordo com a Lei Nº 9394 de 20 de dezembro de 1996.",
  anoConclusao: 2024,
  dataEmissao: "2026-09-17",
  textoCustomizado: null,
  mostrarHistorico: false,
  registroEmBranco: false,
  leiaute: CERTIFICADO_DEFAULTS.leiaute,
  assinaturas: [
    { nome: "ALUNO TESTE 1", cargo: "Aluno(a)" },
    { nome: "ROSSANIA BRÍGIDA", cargo: "Secretária" },
    { nome: "RAFAELA MARGARIDA", cargo: "Diretora" },
  ],
};

const dados = (n: number): CertificadoData => ({ escola, aluno: alunoFake(n) });

describe("renderCertificados", () => {
  it("gera uma página por aluno sem histórico", () => {
    const doc = renderCertificados([dados(1), dados(2)], opts);
    expect(doc.getNumberOfPages()).toBe(2);
  });

  it("usa paisagem A4 por padrão", () => {
    const doc = renderCertificados([dados(1)], opts);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    expect(Math.round(w)).toBe(297);
    expect(Math.round(h)).toBe(210);
    expect(w).toBeGreaterThan(h);
  });

  it("respeita orientação retrato quando configurada", () => {
    const doc = renderCertificados([dados(1)], {
      ...opts,
      leiaute: { ...opts.leiaute, orientacao: "portrait" },
    });
    expect(doc.internal.pageSize.getWidth()).toBeLessThan(doc.internal.pageSize.getHeight());
  });

  it("não estoura a largura útil com o parágrafo do corpo", () => {
    const doc = renderCertificados([dados(1)], opts);
    const util = doc.internal.pageSize.getWidth() - opts.leiaute.margemMm * 2;
    doc.setFont("times", "normal");
    doc.setFontSize(opts.leiaute.fonteCorpoPt);
    // A palavra mais larga precisa caber sozinha numa linha.
    const palavras = "Estabelecimento".split(" ");
    for (const p of palavras) {
      expect(doc.getTextWidth(p)).toBeLessThan(util);
    }
  });

  it("não quebra quando o aluno não tem RG nem filiação", () => {
    const magro: CertificadoData = {
      escola,
      aluno: { ...alunoFake(9), rg: null, nomePai: null, nomeMae: null },
    };
    expect(() => renderCertificados([magro], opts)).not.toThrow();
  });

  it("gera documento vazio de uma página quando a lista está vazia", () => {
    const doc = renderCertificados([], opts);
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx vitest run src/lib/documents/certificado-pdf.test.ts
```
Esperado: FAIL — `Failed to resolve import "./certificado-pdf"`.

- [ ] **Step 3: Implementar a página 1**

Criar `src/lib/documents/certificado-pdf.ts`:

```typescript
import jsPDF from "jspdf";
import { montarCorpo, formatarDataExtenso, type Segmento } from "./certificado-texto";
import { imgFitInBox } from "./pdf-utils";
import type { CertificadoData, CertificadoOptions } from "./certificado-tipos";

export type ImagemCache = Map<string, { data: string; w: number; h: number }>;

const COR_TEXTO: [number, number, number] = [0, 0, 0];
const COR_LINHA: [number, number, number] = [0, 0, 0];

function renderMoldura(doc: jsPDF, opts: CertificadoOptions): void {
  if (!opts.leiaute.mostrarMoldura) return;
  const m = opts.leiaute.margemMm / 2;
  doc.setDrawColor(...COR_LINHA);
  doc.setLineWidth(0.8);
  doc.rect(m, m, doc.internal.pageSize.getWidth() - m * 2, doc.internal.pageSize.getHeight() - m * 2);
}

function renderCabecalho(
  doc: jsPDF,
  y: number,
  data: CertificadoData,
  opts: CertificadoOptions,
  imagens: ImagemCache
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const centro = pageW / 2;
  let cursor = y;

  const logo = data.escola.logoUrl ? imagens.get(data.escola.logoUrl) : undefined;
  if (opts.leiaute.mostrarLogos && logo) {
    const box = imgFitInBox(logo, 60, 22);
    doc.addImage(logo.data, "PNG", centro - box.w / 2, cursor, box.w, box.h, undefined, "FAST");
    cursor += box.h + 3;
  }

  doc.setTextColor(...COR_TEXTO);
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.text(data.escola.nome, centro, cursor, { align: "center" });
  cursor += 4.5;

  doc.setFont("times", "normal");
  doc.setFontSize(7.5);
  const linhas = [
    data.escola.mantenedora ? `Entidade Mantenedora: ${data.escola.mantenedora}` : null,
    data.escola.cnpj ? `CNPJ: ${data.escola.cnpj}` : null,
    data.escola.endereco,
    [
      data.escola.cidade && data.escola.uf ? `${data.escola.cidade} - ${data.escola.uf}` : data.escola.cidade,
      data.escola.cep ? `CEP: ${data.escola.cep}` : null,
    ]
      .filter(Boolean)
      .join(" "),
  ].filter((l): l is string => Boolean(l && l.trim()));

  for (const linha of linhas) {
    doc.text(linha, centro, cursor, { align: "center" });
    cursor += 3.5;
  }
  return cursor;
}

function renderTitulo(doc: jsPDF, y: number, opts: CertificadoOptions): number {
  const centro = doc.internal.pageSize.getWidth() / 2;
  doc.setFont("times", "normal");
  doc.setFontSize(30);
  doc.text(opts.tituloCertificado, centro, y + 12, { align: "center" });
  return y + 20;
}

/**
 * Desenha os segmentos como parágrafo justificado, palavra a palavra.
 * jsPDF não tem rich text: cada palavra é medida com a fonte do seu segmento
 * e a linha quebra quando a próxima palavra não cabe na largura útil.
 */
function renderCorpo(
  doc: jsPDF,
  y: number,
  segmentos: Segmento[],
  opts: CertificadoOptions
): number {
  const margem = opts.leiaute.margemMm;
  const util = doc.internal.pageSize.getWidth() - margem * 2;
  const tamanho = opts.leiaute.fonteCorpoPt;
  const alturaLinha = tamanho * 0.42;

  doc.setFontSize(tamanho);
  doc.setTextColor(...COR_TEXTO);

  type Palavra = { texto: string; negrito: boolean; largura: number };
  const palavras: Palavra[] = [];
  for (const seg of segmentos) {
    doc.setFont("times", seg.negrito ? "bold" : "normal");
    for (const bruta of seg.texto.split(" ")) {
      if (bruta === "") continue;
      palavras.push({ texto: bruta, negrito: seg.negrito, largura: doc.getTextWidth(bruta) });
    }
  }

  doc.setFont("times", "normal");
  const larguraEspaco = doc.getTextWidth(" ");

  const linhas: Palavra[][] = [];
  let atual: Palavra[] = [];
  let larguraAtual = 0;
  for (const p of palavras) {
    const extra = atual.length === 0 ? 0 : larguraEspaco;
    if (atual.length > 0 && larguraAtual + extra + p.largura > util) {
      linhas.push(atual);
      atual = [p];
      larguraAtual = p.largura;
    } else {
      atual.push(p);
      larguraAtual += extra + p.largura;
    }
  }
  if (atual.length > 0) linhas.push(atual);

  let cursor = y;
  linhas.forEach((linha, i) => {
    const somaPalavras = linha.reduce((s, p) => s + p.largura, 0);
    const vaos = linha.length - 1;
    const ultima = i === linhas.length - 1;
    // Justifica distribuindo a sobra nos vãos; a última linha fica alinhada à esquerda.
    const espaco = ultima || vaos === 0 ? larguraEspaco : (util - somaPalavras) / vaos;
    let x = margem;
    for (const p of linha) {
      doc.setFont("times", p.negrito ? "bold" : "normal");
      doc.text(p.texto, x, cursor);
      x += p.largura + espaco;
    }
    cursor += alturaLinha;
  });

  return cursor;
}

function renderDataLocal(
  doc: jsPDF,
  y: number,
  data: CertificadoData,
  opts: CertificadoOptions
): number {
  const margem = opts.leiaute.margemMm;
  const direita = doc.internal.pageSize.getWidth() - margem;
  const cidade = data.escola.cidade?.trim() || "Trindade";
  doc.setFont("times", "normal");
  doc.setFontSize(opts.leiaute.fonteCorpoPt - 1);
  doc.text(`${cidade}, ${formatarDataExtenso(opts.dataEmissao)}`, direita, y + 8, {
    align: "right",
  });
  return y + 14;
}

function renderAssinaturas(doc: jsPDF, y: number, opts: CertificadoOptions): number {
  const assinaturas = opts.assinaturas.filter((a) => a.nome.trim() || a.cargo.trim());
  if (assinaturas.length === 0) return y;

  const margem = opts.leiaute.margemMm;
  const util = doc.internal.pageSize.getWidth() - margem * 2;
  const larguraColuna = util / assinaturas.length;
  const larguraLinha = Math.min(larguraColuna - 10, 80);

  assinaturas.forEach((a, i) => {
    const centro = margem + larguraColuna * i + larguraColuna / 2;
    doc.setDrawColor(...COR_LINHA);
    doc.setLineWidth(0.3);
    doc.line(centro - larguraLinha / 2, y, centro + larguraLinha / 2, y);

    doc.setFont("times", "bold");
    doc.setFontSize(9);
    // splitTextToSize quebra nomes longos em vez de invadir a coluna vizinha.
    const nome = doc.splitTextToSize(a.nome.toUpperCase(), larguraLinha) as string[];
    let cursor = y + 4;
    for (const linha of nome) {
      doc.text(linha, centro, cursor, { align: "center" });
      cursor += 4;
    }
    doc.setFont("times", "normal");
    doc.setFontSize(8.5);
    doc.text(a.cargo, centro, cursor, { align: "center" });
  });

  return y + 16;
}

function renderPagina1(
  doc: jsPDF,
  data: CertificadoData,
  opts: CertificadoOptions,
  imagens: ImagemCache
): void {
  const margem = opts.leiaute.margemMm;
  const alturaPagina = doc.internal.pageSize.getHeight();

  renderMoldura(doc, opts);
  let y = renderCabecalho(doc, margem, data, opts, imagens);
  y = renderTitulo(doc, y, opts);
  y = renderCorpo(doc, y + 6, montarCorpo(data, opts), opts);
  y = renderDataLocal(doc, y, data, opts);

  // Assinaturas ancoradas ao rodapé, ou logo abaixo do texto se ele for longo.
  const yAssinaturas = Math.max(y + 10, alturaPagina - margem - 22);
  renderAssinaturas(doc, yAssinaturas, opts);
}

export function renderCertificados(
  alunos: CertificadoData[],
  opts: CertificadoOptions,
  imagens: ImagemCache = new Map()
): jsPDF {
  const doc = new jsPDF({
    orientation: opts.leiaute.orientacao,
    unit: "mm",
    format: "a4",
  });

  // Lista vazia devolve o documento em branco que o jsPDF já cria — o preview
  // mostra uma página vazia em vez de estourar.
  alunos.forEach((data, i) => {
    if (i > 0) doc.addPage();
    renderPagina1(doc, data, opts, imagens);
  });

  return doc;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx vitest run src/lib/documents/certificado-pdf.test.ts
```
Esperado: PASS, 6 testes.

- [ ] **Step 5: Verificar e commitar**

```bash
npm run typecheck && npm run test
git add src/lib/documents/certificado-pdf.ts src/lib/documents/certificado-pdf.test.ts
git commit -m "feat(certificados): gerador jsPDF da pagina do certificado"
```

---

### Task 5: Gerador PDF — página 2 (histórico e registro)

**Files:**
- Modify: `src/lib/documents/certificado-pdf.ts` (adicionar `renderHistorico`, `renderRegistro`, chamada em `renderCertificados`)
- Modify: `src/lib/documents/certificado-pdf.test.ts` (novos casos)

**Interfaces:**
- Consumes: `HistoricoEscolar`, `LinhaGrade`, `SerieResumo` de `./certificado-tipos`; `autoTable` de `jspdf-autotable`
- Produces: mesma assinatura de `renderCertificados` — agora emite 2 páginas por aluno quando `opts.mostrarHistorico` e o aluno tem histórico

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao final de `src/lib/documents/certificado-pdf.test.ts`:

```typescript
import type { HistoricoEscolar } from "./certificado-tipos";

const historico: HistoricoEscolar = {
  ensinoAnterior: {
    nivel: "ENSINO FUNDAMENTAL",
    escola: "COLÉGIO ESTADUAL MENINO JESUS",
    cidade: "TRINDADE",
    uf: "GO",
    ano: 2021,
  },
  grade: [
    {
      componente: "Matemática",
      parte: "comum",
      series: [
        { serie: "1ª SÉRIE - EM", media: 9.4, ch: 280 },
        { serie: "2ª SÉRIE - EM", media: 9.4, ch: 280 },
        { serie: "3ª SÉRIE - EM", media: null, ch: null },
      ],
      chTotal: 560,
    },
    {
      componente: "Língua Portuguesa",
      parte: "comum",
      series: [
        { serie: "1ª SÉRIE - EM", media: 9.2, ch: 80 },
        { serie: "2ª SÉRIE - EM", media: 9.4, ch: 80 },
        { serie: "3ª SÉRIE - EM", media: 7.9, ch: 80 },
      ],
      chTotal: 240,
    },
  ],
  seriesResumo: [
    { serie: "1ª SÉRIE - EM", ano: 2022, estabelecimento: "EPG TRINDADE", cidade: "TRINDADE", uf: "GO", resultado: "Aprovado", chAnual: 1460, diasLetivos: 213 },
    { serie: "2ª SÉRIE - EM", ano: 2023, estabelecimento: "EPG TRINDADE", cidade: "TRINDADE", uf: "GO", resultado: "Aprovado", chAnual: 1440, diasLetivos: 209 },
    { serie: "3ª SÉRIE - EM", ano: 2024, estabelecimento: "EPG TRINDADE", cidade: "TRINDADE", uf: "GO", resultado: "Aprovado", chAnual: 1400, diasLetivos: 214 },
  ],
  observacoes: "Dados retirados do Histórico Escolar de origem.",
  registroNumero: "",
  registroLivro: "",
  registroFolha: "",
  preenchidoEm: "2026-09-17T10:00:00Z",
};

describe("renderCertificados com histórico", () => {
  const comHistorico = (n: number): CertificadoData => ({
    escola,
    aluno: { ...alunoFake(n), historico },
  });
  const optsHist: CertificadoOptions = { ...opts, mostrarHistorico: true };

  it("gera duas páginas por aluno", () => {
    const doc = renderCertificados([comHistorico(1), comHistorico(2)], optsHist);
    expect(doc.getNumberOfPages()).toBe(4);
  });

  it("gera só a página do certificado quando o aluno não tem histórico", () => {
    const doc = renderCertificados([dados(1)], optsHist);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("gera só a página do certificado quando o histórico está desligado", () => {
    const doc = renderCertificados([comHistorico(1)], { ...optsHist, mostrarHistorico: false });
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("não quebra com grade vazia", () => {
    const vazio: CertificadoData = {
      escola,
      aluno: { ...alunoFake(3), historico: { ...historico, grade: [], seriesResumo: [] } },
    };
    expect(() => renderCertificados([vazio], optsHist)).not.toThrow();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx vitest run src/lib/documents/certificado-pdf.test.ts
```
Esperado: FAIL — "gera duas páginas por aluno" recebe 2, esperava 4.

- [ ] **Step 3: Implementar a página 2**

Em `src/lib/documents/certificado-pdf.ts`, adicionar o import no topo:

```typescript
import autoTable from "jspdf-autotable";
import type { HistoricoEscolar, LinhaGrade, SerieResumo } from "./certificado-tipos";
```

E acrescentar antes de `renderCertificados`:

```typescript
/** Largura da coluna lateral de registro, na direita da página 2. */
const LARGURA_REGISTRO = 62;

function num(v: number | null, casas = 1): string {
  return v === null || v === undefined ? "-" : v.toFixed(casas);
}

function inteiro(v: number | null): string {
  return v === null || v === undefined ? "-" : String(v);
}

/** Séries da grade, na ordem em que aparecem — as colunas da tabela. */
function seriesDaGrade(grade: LinhaGrade[]): string[] {
  const vistas: string[] = [];
  for (const linha of grade) {
    for (const s of linha.series) {
      if (!vistas.includes(s.serie)) vistas.push(s.serie);
    }
  }
  return vistas;
}

function renderGrade(
  doc: jsPDF,
  y: number,
  hist: HistoricoEscolar,
  larguraUtil: number,
  margem: number
): number {
  const series = seriesDaGrade(hist.grade);
  if (series.length === 0) return y;

  const head = [
    [
      { content: "Componentes Curriculares", rowSpan: 2 },
      ...series.map((s) => ({ content: s, colSpan: 2, styles: { halign: "center" as const } })),
      { content: "C.H. Total", rowSpan: 2 },
    ],
    series.flatMap(() => [
      { content: "Média", styles: { halign: "center" as const } },
      { content: "C.H.", styles: { halign: "center" as const } },
    ]),
  ];

  const body = hist.grade.map((linha) => [
    linha.componente,
    ...series.flatMap((serie) => {
      const achado = linha.series.find((s) => s.serie === serie);
      return [num(achado?.media ?? null), inteiro(achado?.ch ?? null)];
    }),
    inteiro(linha.chTotal),
  ]);

  const resumoPorSerie = (serie: string): SerieResumo | undefined =>
    hist.seriesResumo.find((r) => r.serie === serie);

  const chTotalGeral = hist.seriesResumo.reduce(
    (soma, r) => soma + (r.chAnual ?? 0),
    0
  );

  body.push([
    "Resultado Final",
    ...series.flatMap((s) => [resumoPorSerie(s)?.resultado ?? "-", ""]),
    "-",
  ]);
  body.push([
    "Carga Horária Anual",
    ...series.flatMap((s) => [inteiro(resumoPorSerie(s)?.chAnual ?? null), ""]),
    chTotalGeral > 0 ? String(chTotalGeral) : "-",
  ]);
  body.push([
    "Dias Letivos",
    ...series.flatMap((s) => [inteiro(resumoPorSerie(s)?.diasLetivos ?? null), ""]),
    "-",
  ]);

  autoTable(doc, {
    head,
    body,
    startY: y,
    margin: { left: margem, right: margem + LARGURA_REGISTRO + 4 },
    tableWidth: larguraUtil,
    theme: "grid",
    styles: { font: "times", fontSize: 6.5, cellPadding: 0.8, textColor: COR_TEXTO, lineColor: COR_LINHA, lineWidth: 0.1 },
    headStyles: { fontStyle: "bold", fillColor: false, textColor: COR_TEXTO },
    columnStyles: { 0: { halign: "left", cellWidth: 38 } },
    bodyStyles: { halign: "center" },
    didParseCell: (hook) => {
      if (hook.section === "body" && hook.column.index === 0) {
        hook.cell.styles.halign = "left";
      }
    },
  });

  // `lastAutoTable` é como o autotable v5 devolve a posição final.
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;
}

function renderResumoSeries(
  doc: jsPDF,
  y: number,
  hist: HistoricoEscolar,
  larguraUtil: number,
  margem: number
): number {
  let cursor = y;

  if (hist.ensinoAnterior && hist.ensinoAnterior.escola.trim()) {
    const e = hist.ensinoAnterior;
    autoTable(doc, {
      head: [["Série", "Ano", "Estabelecimento", "Cidade", "UF"]],
      body: [[e.nivel, e.ano === null ? "-" : String(e.ano), e.escola, e.cidade, e.uf]],
      startY: cursor,
      margin: { left: margem, right: margem + LARGURA_REGISTRO + 4 },
      tableWidth: larguraUtil,
      theme: "grid",
      styles: { font: "times", fontSize: 6.5, cellPadding: 0.8, textColor: COR_TEXTO, lineColor: COR_LINHA, lineWidth: 0.1 },
      headStyles: { fontStyle: "bold", fillColor: false, textColor: COR_TEXTO },
    });
    cursor = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2;
  }

  if (hist.seriesResumo.length > 0) {
    autoTable(doc, {
      head: [["Série", "Ano", "Estabelecimento", "Cidade", "UF"]],
      body: hist.seriesResumo.map((r) => [r.serie, String(r.ano), r.estabelecimento, r.cidade, r.uf]),
      startY: cursor,
      margin: { left: margem, right: margem + LARGURA_REGISTRO + 4 },
      tableWidth: larguraUtil,
      theme: "grid",
      styles: { font: "times", fontSize: 6.5, cellPadding: 0.8, textColor: COR_TEXTO, lineColor: COR_LINHA, lineWidth: 0.1 },
      headStyles: { fontStyle: "bold", fillColor: false, textColor: COR_TEXTO },
    });
    cursor = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2;
  }

  if (hist.observacoes.trim()) {
    autoTable(doc, {
      head: [["Observações"]],
      body: [[hist.observacoes]],
      startY: cursor,
      margin: { left: margem, right: margem + LARGURA_REGISTRO + 4 },
      tableWidth: larguraUtil,
      theme: "grid",
      styles: { font: "times", fontSize: 6.5, cellPadding: 1.2, textColor: COR_TEXTO, lineColor: COR_LINHA, lineWidth: 0.1 },
      headStyles: { fontStyle: "bold", halign: "center", fillColor: false, textColor: COR_TEXTO },
    });
    cursor = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2;
  }

  return cursor;
}

/** Caixa lateral direita: autotable não faz layout lado a lado, então é desenhada à mão. */
function renderRegistro(
  doc: jsPDF,
  data: CertificadoData,
  opts: CertificadoOptions,
  hist: HistoricoEscolar
): void {
  const margem = opts.leiaute.margemMm;
  const x = doc.internal.pageSize.getWidth() - margem - LARGURA_REGISTRO;
  const topo = margem;
  const altura = doc.internal.pageSize.getHeight() - margem * 2;
  const centro = x + LARGURA_REGISTRO / 2;
  const interno = LARGURA_REGISTRO - 6;

  doc.setDrawColor(...COR_LINHA);
  doc.setLineWidth(0.3);
  doc.rect(x, topo, LARGURA_REGISTRO, altura);

  doc.setTextColor(...COR_TEXTO);
  doc.setFont("times", "bold");
  doc.setFontSize(9);
  let cursor = topo + 6;
  doc.text("REGISTRO", centro, cursor, { align: "center" });
  cursor += 6;

  doc.setFontSize(7);
  for (const linha of ["ESTADO DE GOIÁS", "SECRETARIA DA EDUCAÇÃO", data.escola.nome]) {
    doc.text(linha, x + 3, cursor);
    cursor += 3.5;
  }
  cursor += 3;

  doc.setFont("times", "normal");
  doc.setFontSize(7);
  const texto = doc.splitTextToSize(
    `Documento expedido conforme ${opts.baseLegal.replace(/^sob a\s*/i, "")}`,
    interno
  ) as string[];
  for (const linha of texto) {
    doc.text(linha, x + 3, cursor);
    cursor += 3.2;
  }
  cursor += 2;

  const autenticidade = doc.splitTextToSize(
    "Declaramos a autenticidade e regularidade do presente documento.",
    interno
  ) as string[];
  for (const linha of autenticidade) {
    doc.text(linha, x + 3, cursor);
    cursor += 3.2;
  }
  cursor += 2;

  // Com "registro em branco", as linhas ficam vazias para preenchimento à caneta.
  const valor = (v: string) => (opts.registroEmBranco ? "__________" : v || "__________");
  doc.text(`Registro nº ${valor(hist.registroNumero)}`, x + 3, cursor);
  cursor += 4;
  doc.text(`Livro nº ${valor(hist.registroLivro)}`, x + 3, cursor);
  cursor += 4;
  doc.text(`Fls nº ${valor(hist.registroFolha)}`, x + 3, cursor);
  cursor += 6;

  const cidade = data.escola.cidade?.trim() || "Trindade";
  doc.setFont("times", "bold");
  doc.text(`${cidade}, ${formatarDataExtenso(opts.dataEmissao)}`, centro, cursor, {
    align: "center",
  });

  // As assinaturas do registro (secretária e diretora) vão no rodapé da caixa.
  const doRegistro = opts.assinaturas.filter((a) => !/aluno/i.test(a.cargo));
  let assY = topo + altura - 8 - doRegistro.length * 14;
  for (const a of doRegistro) {
    doc.setDrawColor(...COR_LINHA);
    doc.setLineWidth(0.3);
    doc.line(x + 4, assY, x + LARGURA_REGISTRO - 4, assY);
    doc.setFont("times", "bold");
    doc.setFontSize(7);
    const nome = doc.splitTextToSize(a.nome.toUpperCase(), interno) as string[];
    let c = assY + 3.2;
    for (const linha of nome) {
      doc.text(linha, centro, c, { align: "center" });
      c += 3.2;
    }
    doc.setFont("times", "normal");
    doc.text(a.cargo, centro, c, { align: "center" });
    assY += 14;
  }
}

function renderPagina2(doc: jsPDF, data: CertificadoData, opts: CertificadoOptions): void {
  const hist = data.aluno.historico;
  if (!hist) return;

  const margem = opts.leiaute.margemMm;
  const larguraUtil =
    doc.internal.pageSize.getWidth() - margem * 2 - LARGURA_REGISTRO - 4;

  renderMoldura(doc, opts);

  doc.setTextColor(...COR_TEXTO);
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.text("HISTÓRICO ESCOLAR", margem, margem + 4);

  let y = margem + 9;
  if (hist.ensinoAnterior && hist.ensinoAnterior.escola.trim()) {
    const e = hist.ensinoAnterior;
    doc.setFont("times", "normal");
    doc.setFontSize(7.5);
    const frase = doc.splitTextToSize(
      `O(A) aluno(a) ${data.aluno.nome} concluiu o ${e.nivel.toLowerCase()} no(a) ${e.escola} - ${e.cidade}/${e.uf} no ano ${e.ano ?? "-"}.`,
      larguraUtil
    ) as string[];
    for (const linha of frase) {
      doc.text(linha, margem, y);
      y += 3.4;
    }
    y += 2;
  }

  y = renderGrade(doc, y, hist, larguraUtil, margem);
  renderResumoSeries(doc, y, hist, larguraUtil, margem);
  renderRegistro(doc, data, opts, hist);
}
```

E trocar o corpo de `renderCertificados` para emitir a página 2:

```typescript
export function renderCertificados(
  alunos: CertificadoData[],
  opts: CertificadoOptions,
  imagens: ImagemCache = new Map()
): jsPDF {
  const doc = new jsPDF({
    orientation: opts.leiaute.orientacao,
    unit: "mm",
    format: "a4",
  });

  let primeira = true;
  for (const data of alunos) {
    if (!primeira) doc.addPage();
    primeira = false;
    renderPagina1(doc, data, opts, imagens);

    if (opts.mostrarHistorico && data.aluno.historico) {
      doc.addPage();
      renderPagina2(doc, data, opts);
    }
  }

  return doc;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx vitest run src/lib/documents/certificado-pdf.test.ts
```
Esperado: PASS, 10 testes.

- [ ] **Step 5: Verificar e commitar**

```bash
npm run typecheck && npm run test
git add src/lib/documents/certificado-pdf.ts src/lib/documents/certificado-pdf.test.ts
git commit -m "feat(certificados): pagina do historico escolar com grade e registro"
```

---

### Task 6: Camada de dados

**Files:**
- Create: `src/lib/data/certificados.ts`

**Interfaces:**
- Consumes: tipos de `@/lib/documents/certificado-tipos`; `createServerClient` de `@/lib/supabase/server`; `DEFAULT_SCHOOL_ID` de `@/lib/constants`
- Produces:
  - `getCertificadoConfig(escolaId?): Promise<CertificadoConfigRow>`
  - `getAnosLetivos(escolaId?): Promise<number[]>`
  - `getSeriesETurmas(anoLetivo, escolaId?): Promise<{series: OpcaoSelect[]; turmas: TurmaOpcao[]}>`
  - `getAlunosElegiveis(filtro: FiltroElegiveis, escolaId?): Promise<CertificadoData[]>`
  - `getEscolaCertificado(escolaId?): Promise<CertificadoEscola>`
  - `montarRascunhoHistorico(alunoId, escolaId?): Promise<HistoricoEscolar>`
  - tipos `CertificadoConfigRow`, `FiltroElegiveis`, `OpcaoSelect`, `TurmaOpcao`

- [ ] **Step 1: Confirmar o nome da constante da escola**

```bash
grep -n "DEFAULT_SCHOOL_ID" src/lib/constants.ts
```
Esperado: a constante existe. Se o nome for outro, usar o encontrado em todo o arquivo desta tarefa.

- [ ] **Step 2: Escrever a camada de dados**

Criar `src/lib/data/certificados.ts`:

```typescript
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import {
  CERTIFICADO_DEFAULTS,
  type CertificadoData,
  type CertificadoEscola,
  type CertificadoLeiaute,
  type HistoricoEscolar,
  type LinhaAssinatura,
  type LinhaGrade,
} from "@/lib/documents/certificado-tipos";

export type CertificadoConfigRow = {
  textoInicio: string;
  descricaoCurso: string;
  baseLegal: string;
  tituloCertificado: string;
  mostrarHistorico: boolean;
  registroEmBranco: boolean;
  leiaute: CertificadoLeiaute;
  assinaturas: LinhaAssinatura[];
};

export type OpcaoSelect = { id: string; nome: string };
export type TurmaOpcao = { id: string; nome: string; serieId: string; serieNome: string };

export type FiltroElegiveis = {
  anoLetivo: number;
  /** Um dos dois, nunca ambos. */
  serieId?: string;
  turmaId?: string;
};

const CONFIG_PADRAO: CertificadoConfigRow = {
  textoInicio: "O Diretor do",
  descricaoCurso: "ENSINO MÉDIO",
  baseLegal:
    "sob a Resolução CEE/CEB N.01, de 14 de janeiro de 2022 de acordo com a Lei Nº 9394 de 20 de dezembro de 1996.",
  tituloCertificado: "Certificado",
  mostrarHistorico: false,
  registroEmBranco: false,
  leiaute: CERTIFICADO_DEFAULTS.leiaute,
  assinaturas: CERTIFICADO_DEFAULTS.assinaturas,
};

export async function getCertificadoConfig(
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<CertificadoConfigRow> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("certificado_config")
    .select("*")
    .eq("escola_id", escolaId)
    .maybeSingle();

  if (!data) return CONFIG_PADRAO;

  const leiaute = (data.leiaute ?? {}) as Partial<CertificadoLeiaute>;
  const assinaturas = (data.assinaturas ?? []) as LinhaAssinatura[];

  return {
    textoInicio: data.texto_inicio ?? CONFIG_PADRAO.textoInicio,
    descricaoCurso: data.descricao_curso ?? CONFIG_PADRAO.descricaoCurso,
    baseLegal: data.base_legal ?? CONFIG_PADRAO.baseLegal,
    tituloCertificado: data.titulo_certificado ?? CONFIG_PADRAO.tituloCertificado,
    mostrarHistorico: Boolean(data.mostrar_historico),
    registroEmBranco: Boolean(data.registro_em_branco),
    // Merge com o padrão: config antiga não tem campos de leiaute adicionados depois.
    leiaute: { ...CERTIFICADO_DEFAULTS.leiaute, ...leiaute },
    assinaturas: assinaturas.length > 0 ? assinaturas : CERTIFICADO_DEFAULTS.assinaturas,
  };
}

export async function getEscolaCertificado(
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<CertificadoEscola> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("escolas")
    .select("nome, cnpj, endereco, cidade, uf, cep, logo_url")
    .eq("id", escolaId)
    .maybeSingle();

  return {
    nome: data?.nome ?? "",
    // `escolas` não tem coluna de mantenedora; o cabeçalho omite a linha.
    mantenedora: null,
    cnpj: data?.cnpj ?? null,
    endereco: data?.endereco ?? null,
    cidade: data?.cidade ?? null,
    uf: data?.uf ?? null,
    cep: data?.cep ?? null,
    logoUrl: data?.logo_url ?? null,
  };
}

export async function getAnosLetivos(
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<number[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("matriculas")
    .select("ano_letivo")
    .eq("escola_id", escolaId);

  const anos = new Set<number>((data ?? []).map((m) => Number(m.ano_letivo)));
  anos.add(new Date().getFullYear());
  return Array.from(anos).sort((a, b) => b - a);
}

export async function getSeriesETurmas(
  anoLetivo: number,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<{ series: OpcaoSelect[]; turmas: TurmaOpcao[] }> {
  const supabase = await createServerClient();

  const { data: series } = await supabase
    .from("series")
    .select("id, nome, ordem")
    .eq("escola_id", escolaId)
    .eq("ativo", true)
    .order("ordem");

  const { data: turmas } = await supabase
    .from("turmas")
    .select("id, nome, turno, serie_id, series(nome)")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", anoLetivo)
    .eq("ativo", true)
    .order("nome");

  return {
    series: (series ?? []).map((s) => ({ id: s.id, nome: s.nome })),
    turmas: (turmas ?? []).map((t) => {
      const rel = t.series as unknown as { nome: string } | { nome: string }[] | null;
      const serieNome = Array.isArray(rel) ? rel[0]?.nome ?? "" : rel?.nome ?? "";
      return {
        id: t.id,
        nome: `${serieNome} · ${t.nome} (${t.turno})`,
        serieId: t.serie_id,
        serieNome,
      };
    }),
  };
}

/** Responsáveis marcados como pai/mãe viram a filiação do certificado. */
function extrairFiliacao(
  responsaveis: Array<{ nome: string; parentesco: string | null }>
): { nomePai: string | null; nomeMae: string | null } {
  const acha = (re: RegExp) =>
    responsaveis.find((r) => r.parentesco && re.test(r.parentesco))?.nome ?? null;
  return { nomePai: acha(/pai/i), nomeMae: acha(/m[ãa]e/i) };
}

export async function getAlunosElegiveis(
  filtro: FiltroElegiveis,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<CertificadoData[]> {
  const supabase = await createServerClient();
  const escola = await getEscolaCertificado(escolaId);

  let query = supabase
    .from("matriculas")
    .select(`
      id, ano_letivo, aluno_id,
      alunos(id, nome, nacionalidade, naturalidade, data_nascimento, rg),
      series(nome),
      turmas(nome)
    `)
    .eq("escola_id", escolaId)
    .eq("ano_letivo", filtro.anoLetivo)
    .eq("status", "ativa");

  if (filtro.turmaId) query = query.eq("turma_id", filtro.turmaId);
  else if (filtro.serieId) query = query.eq("serie_id", filtro.serieId);

  const { data: matriculas, error } = await query;
  if (error) throw error;

  const linhas = (matriculas ?? []) as unknown as Array<{
    id: string;
    ano_letivo: number;
    aluno_id: string;
    alunos: { id: string; nome: string; nacionalidade: string | null; naturalidade: string | null; data_nascimento: string | null; rg: string | null } | null;
    series: { nome: string } | null;
    turmas: { nome: string } | null;
  }>;

  const alunoIds = linhas.map((l) => l.aluno_id);
  const matriculaIds = linhas.map((l) => l.id);

  const { data: responsaveis } = alunoIds.length
    ? await supabase
        .from("responsaveis_aluno")
        .select("aluno_id, nome, parentesco")
        .in("aluno_id", alunoIds)
    : { data: [] };

  const { data: historicos } = matriculaIds.length
    ? await supabase
        .from("certificado_historico")
        .select("*")
        .in("matricula_id", matriculaIds)
    : { data: [] };

  const respPorAluno = new Map<string, Array<{ nome: string; parentesco: string | null }>>();
  for (const r of (responsaveis ?? []) as Array<{ aluno_id: string; nome: string; parentesco: string | null }>) {
    const lista = respPorAluno.get(r.aluno_id) ?? [];
    lista.push({ nome: r.nome, parentesco: r.parentesco });
    respPorAluno.set(r.aluno_id, lista);
  }

  const histPorMatricula = new Map<string, HistoricoEscolar>();
  for (const h of (historicos ?? []) as Array<Record<string, unknown>>) {
    histPorMatricula.set(String(h.matricula_id), {
      ensinoAnterior: (h.ensino_anterior as HistoricoEscolar["ensinoAnterior"]) ?? null,
      grade: (h.grade as LinhaGrade[]) ?? [],
      seriesResumo: (h.series_resumo as HistoricoEscolar["seriesResumo"]) ?? [],
      observacoes: (h.observacoes as string) ?? "",
      registroNumero: (h.registro_numero as string) ?? "",
      registroLivro: (h.registro_livro as string) ?? "",
      registroFolha: (h.registro_folha as string) ?? "",
      preenchidoEm: (h.preenchido_em as string) ?? null,
    });
  }

  return linhas
    .filter((l) => l.alunos !== null)
    .map((l) => {
      const a = l.alunos!;
      const { nomePai, nomeMae } = extrairFiliacao(respPorAluno.get(l.aluno_id) ?? []);
      return {
        escola,
        aluno: {
          alunoId: a.id,
          matriculaId: l.id,
          nome: a.nome,
          nacionalidade: a.nacionalidade ?? "BRASILEIRA",
          naturalidade: a.naturalidade,
          dataNascimento: a.data_nascimento,
          rg: a.rg,
          nomePai,
          nomeMae,
          serie: l.series?.nome ?? "",
          turma: l.turmas?.nome ?? "",
          anoLetivo: l.ano_letivo,
          historico: histPorMatricula.get(l.id) ?? null,
        },
      };
    })
    .sort((x, y) => x.aluno.nome.localeCompare(y.aluno.nome, "pt-BR"));
}

/**
 * Rascunho do histórico a partir do que o sistema tem: um ano por matrícula,
 * médias anuais das notas consolidadas. C.H., dias letivos, resultado e escola
 * de origem ficam em branco — não existem no banco.
 */
export async function montarRascunhoHistorico(
  alunoId: string,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<HistoricoEscolar> {
  const supabase = await createServerClient();

  const { data: matriculas } = await supabase
    .from("matriculas")
    .select("id, ano_letivo, series(nome)")
    .eq("escola_id", escolaId)
    .eq("aluno_id", alunoId)
    .order("ano_letivo");

  const linhasMatricula = (matriculas ?? []) as unknown as Array<{
    id: string;
    ano_letivo: number;
    series: { nome: string } | null;
  }>;

  const escola = await getEscolaCertificado(escolaId);

  const seriesResumo = linhasMatricula.map((m) => ({
    serie: m.series?.nome ?? String(m.ano_letivo),
    ano: m.ano_letivo,
    estabelecimento: escola.nome,
    cidade: escola.cidade ?? "",
    uf: escola.uf ?? "",
    resultado: "",
    chAnual: null,
    diasLetivos: null,
  }));

  const { data: consolidadas } = linhasMatricula.length
    ? await supabase
        .from("notas_consolidadas")
        .select("matricula_id, disciplina_id, bimestre, media")
        .in("matricula_id", linhasMatricula.map((m) => m.id))
    : { data: [] };

  const consol = (consolidadas ?? []) as Array<{
    matricula_id: string;
    disciplina_id: string;
    bimestre: number;
    media: number | string | null;
  }>;

  const disciplinaIds = Array.from(new Set(consol.map((c) => c.disciplina_id)));
  const { data: disciplinas } = disciplinaIds.length
    ? await supabase.from("disciplinas").select("id, nome, ordem").in("id", disciplinaIds)
    : { data: [] };

  const nomeDisciplina = new Map<string, { nome: string; ordem: number }>();
  for (const d of (disciplinas ?? []) as Array<{ id: string; nome: string; ordem: number }>) {
    nomeDisciplina.set(d.id, { nome: d.nome, ordem: d.ordem });
  }

  const serieDaMatricula = new Map(
    linhasMatricula.map((m) => [m.id, m.series?.nome ?? String(m.ano_letivo)])
  );

  // Média anual = média simples dos bimestres com nota, igual ao boletim.
  const acumulado = new Map<string, Map<string, number[]>>();
  for (const c of consol) {
    if (c.media === null) continue;
    const serie = serieDaMatricula.get(c.matricula_id);
    if (!serie) continue;
    const porSerie = acumulado.get(c.disciplina_id) ?? new Map<string, number[]>();
    const medias = porSerie.get(serie) ?? [];
    medias.push(Number(c.media));
    porSerie.set(serie, medias);
    acumulado.set(c.disciplina_id, porSerie);
  }

  const todasSeries = seriesResumo.map((r) => r.serie);

  const grade: LinhaGrade[] = Array.from(acumulado.entries())
    .map(([disciplinaId, porSerie]) => {
      const info = nomeDisciplina.get(disciplinaId) ?? { nome: "—", ordem: 999 };
      return {
        componente: info.nome,
        parte: "comum" as const,
        series: todasSeries.map((serie) => {
          const medias = porSerie.get(serie) ?? [];
          const media =
            medias.length > 0
              ? Math.round((medias.reduce((s, v) => s + v, 0) / medias.length) * 10) / 10
              : null;
          return { serie, media, ch: null };
        }),
        chTotal: null,
        ordem: info.ordem,
      };
    })
    .sort((a, b) => (a.ordem !== b.ordem ? a.ordem - b.ordem : a.componente.localeCompare(b.componente, "pt-BR")))
    .map(({ ordem: _ordem, ...linha }) => linha);

  return {
    ensinoAnterior: null,
    grade,
    seriesResumo,
    observacoes: "",
    registroNumero: "",
    registroLivro: "",
    registroFolha: "",
    preenchidoEm: null,
  };
}
```

- [ ] **Step 3: Verificar**

```bash
npm run typecheck
```
Esperado: verde. Se o TS reclamar que `alunos.nacionalidade` não existe nos tipos gerados do Supabase, é porque o projeto usa tipos gerados — nesse caso confirmar com `grep -rn "nacionalidade" src/lib/types.ts` e regenerar ou ajustar o cast.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/certificados.ts
git commit -m "feat(certificados): camada de dados com elegiveis e rascunho do historico"
```

---

### Task 7: Server Actions

**Files:**
- Create: `src/lib/actions/certificados.ts`

**Interfaces:**
- Consumes: tipos de `@/lib/documents/certificado-tipos`; `CertificadoConfigRow` de `@/lib/data/certificados`
- Produces:
  - `salvarCertificadoConfigAction(config: CertificadoConfigRow): Promise<{ok: true} | {ok: false; erro: string}>`
  - `salvarHistoricoAction(matriculaId: string, alunoId: string, hist: HistoricoEscolar): Promise<{ok: true} | {ok: false; erro: string}>`
  - `carregarRascunhoHistoricoAction(alunoId: string): Promise<HistoricoEscolar>`

- [ ] **Step 1: Conferir o padrão de action do projeto**

```bash
sed -n 1,30p src/lib/actions/documents.ts
```
Observar como o arquivo obtém o cliente Supabase e se usa `revalidatePath`. Seguir o mesmo padrão abaixo.

- [ ] **Step 2: Escrever as actions**

Criar `src/lib/actions/certificados.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { montarRascunhoHistorico, type CertificadoConfigRow } from "@/lib/data/certificados";
import type { HistoricoEscolar } from "@/lib/documents/certificado-tipos";

export type ResultadoAction = { ok: true } | { ok: false; erro: string };

const leiauteSchema = z.object({
  orientacao: z.enum(["landscape", "portrait"]),
  margemMm: z.number().min(5).max(40),
  fonteCorpoPt: z.number().min(6).max(20),
  mostrarLogos: z.boolean(),
  mostrarMoldura: z.boolean(),
});

const assinaturaSchema = z.object({
  nome: z.string().max(120),
  cargo: z.string().max(60),
});

const configSchema = z.object({
  textoInicio: z.string().min(1).max(200),
  descricaoCurso: z.string().min(1).max(200),
  baseLegal: z.string().max(600),
  tituloCertificado: z.string().min(1).max(100),
  mostrarHistorico: z.boolean(),
  registroEmBranco: z.boolean(),
  leiaute: leiauteSchema,
  assinaturas: z.array(assinaturaSchema).max(6),
});

const serieGradeSchema = z.object({
  serie: z.string().max(60),
  media: z.number().nullable(),
  ch: z.number().nullable(),
});

const historicoSchema = z.object({
  ensinoAnterior: z
    .object({
      nivel: z.string().max(80),
      escola: z.string().max(160),
      cidade: z.string().max(80),
      uf: z.string().max(2),
      ano: z.number().nullable(),
    })
    .nullable(),
  grade: z
    .array(
      z.object({
        componente: z.string().max(120),
        parte: z.enum(["comum", "diversificada"]),
        series: z.array(serieGradeSchema),
        chTotal: z.number().nullable(),
      })
    )
    .max(80),
  seriesResumo: z
    .array(
      z.object({
        serie: z.string().max(60),
        ano: z.number(),
        estabelecimento: z.string().max(160),
        cidade: z.string().max(80),
        uf: z.string().max(2),
        resultado: z.string().max(40),
        chAnual: z.number().nullable(),
        diasLetivos: z.number().nullable(),
      })
    )
    .max(20),
  observacoes: z.string().max(4000),
  registroNumero: z.string().max(40),
  registroLivro: z.string().max(40),
  registroFolha: z.string().max(40),
  preenchidoEm: z.string().nullable(),
});

export async function salvarCertificadoConfigAction(
  config: CertificadoConfigRow
): Promise<ResultadoAction> {
  const parsed = configSchema.safeParse(config);
  if (!parsed.success) {
    return { ok: false, erro: "Configuração inválida. Revise os campos." };
  }

  const supabase = await createServerClient();
  const c = parsed.data;
  const { error } = await supabase.from("certificado_config").upsert(
    {
      escola_id: DEFAULT_SCHOOL_ID,
      texto_inicio: c.textoInicio,
      descricao_curso: c.descricaoCurso,
      base_legal: c.baseLegal,
      titulo_certificado: c.tituloCertificado,
      mostrar_historico: c.mostrarHistorico,
      registro_em_branco: c.registroEmBranco,
      leiaute: c.leiaute,
      assinaturas: c.assinaturas,
    },
    { onConflict: "escola_id" }
  );

  if (error) return { ok: false, erro: "Não foi possível salvar a configuração." };

  revalidatePath("/certificados");
  return { ok: true };
}

export async function salvarHistoricoAction(
  matriculaId: string,
  alunoId: string,
  hist: HistoricoEscolar
): Promise<ResultadoAction> {
  const parsed = historicoSchema.safeParse(hist);
  if (!parsed.success) {
    return { ok: false, erro: "Histórico inválido. Revise a grade." };
  }

  const supabase = await createServerClient();
  const h = parsed.data;
  const { error } = await supabase.from("certificado_historico").upsert(
    {
      escola_id: DEFAULT_SCHOOL_ID,
      matricula_id: matriculaId,
      aluno_id: alunoId,
      ensino_anterior: h.ensinoAnterior ?? {},
      grade: h.grade,
      series_resumo: h.seriesResumo,
      observacoes: h.observacoes,
      registro_numero: h.registroNumero,
      registro_livro: h.registroLivro,
      registro_folha: h.registroFolha,
      preenchido_em: new Date().toISOString(),
    },
    { onConflict: "matricula_id" }
  );

  if (error) return { ok: false, erro: "Não foi possível salvar o histórico." };

  revalidatePath("/certificados");
  return { ok: true };
}

export async function carregarRascunhoHistoricoAction(
  alunoId: string
): Promise<HistoricoEscolar> {
  return montarRascunhoHistorico(alunoId);
}
```

- [ ] **Step 3: Verificar**

```bash
npm run typecheck && npm run build
```
Esperado: verdes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/certificados.ts
git commit -m "feat(certificados): actions de salvar config e historico"
```

---

### Task 8: Tela — filtros, conteúdo, leiaute, assinatura e preview

O histórico editável fica na Task 9; aqui a aba já existe com os dois toggles, e o editor entra depois.

**Files:**
- Create: `src/app/(app)/certificados/page.tsx`
- Create: `src/app/(app)/certificados/certificado-form.tsx`
- Create: `src/app/(app)/certificados/certificado-preview.tsx`
- Create: `src/app/(app)/certificados/abas/aba-filtros.tsx`
- Create: `src/app/(app)/certificados/abas/aba-conteudo.tsx`
- Create: `src/app/(app)/certificados/abas/aba-leiaute.tsx`
- Create: `src/app/(app)/certificados/abas/aba-assinatura.tsx`
- Modify: `src/components/layout/topbar.tsx` (`SECRETARIA_ITEMS`, bloco "Aluno")

**Interfaces:**
- Consumes: `getCertificadoConfig`, `getAnosLetivos`, `getSeriesETurmas`, `getAlunosElegiveis` de `@/lib/data/certificados`; `renderCertificados` de `@/lib/documents/certificado-pdf`; `salvarCertificadoConfigAction`
- Produces: a rota `/certificados`

- [ ] **Step 1: Conferir o padrão de página do projeto**

```bash
sed -n 1,40p "src/app/(app)/relatorios/alunos/page.tsx"
```
Observar `PageHeader`, `Panel` e como os filtros chegam por `searchParams`. Seguir o mesmo padrão.

- [ ] **Step 2: Escrever a página server**

Criar `src/app/(app)/certificados/page.tsx`:

```typescript
import { PageHeader } from "@/components/ui/page-header";
import {
  getAnosLetivos,
  getCertificadoConfig,
  getSeriesETurmas,
} from "@/lib/data/certificados";
import { CertificadoForm } from "./certificado-form";

export const dynamic = "force-dynamic";

export default async function CertificadosPage({
  searchParams,
}: {
  searchParams: { ano?: string };
}) {
  const anos = await getAnosLetivos();
  const anoSelecionado = Number(searchParams.ano) || anos[0] || new Date().getFullYear();
  const [config, { series, turmas }] = await Promise.all([
    getCertificadoConfig(),
    getSeriesETurmas(anoSelecionado),
  ]);

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Certificados de conclusão"
        description="Configure, confira no preview e emita para a turma inteira."
      />
      <CertificadoForm
        anos={anos}
        anoInicial={anoSelecionado}
        series={series}
        turmas={turmas}
        config={config}
      />
    </div>
  );
}
```

Se `PageHeader` tiver props diferentes de `title`/`description`, ajustar conforme o arquivo real (checado no Step 1).

- [ ] **Step 3: Escrever as abas simples**

Criar `src/app/(app)/certificados/abas/aba-conteudo.tsx`:

```typescript
"use client";

import type { CertificadoOptions } from "@/lib/documents/certificado-tipos";

type Props = {
  opts: CertificadoOptions;
  onChange: (patch: Partial<CertificadoOptions>) => void;
};

export function AbaConteudo({ opts, onChange }: Props) {
  const customizado = opts.textoCustomizado !== null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="grid gap-1.5 text-sm">
        <span className="font-bold text-ink">Conteúdo customizado</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange({ textoCustomizado: "" })}
            className={`flex-1 rounded-ui border px-3 py-2 text-sm ${customizado ? "border-brand bg-brand/10 text-brand" : "border-line text-muted"}`}
          >
            Sim
          </button>
          <button
            type="button"
            onClick={() => onChange({ textoCustomizado: null })}
            className={`flex-1 rounded-ui border px-3 py-2 text-sm ${!customizado ? "border-brand bg-brand/10 text-brand" : "border-line text-muted"}`}
          >
            Não
          </button>
        </div>
      </label>

      <label className="grid gap-1.5 text-sm">
        <span className="font-bold text-ink">Início do texto</span>
        <input
          value={opts.textoInicio}
          onChange={(e) => onChange({ textoInicio: e.target.value })}
          className="rounded-ui border border-line bg-surface px-3 py-2 text-ink"
        />
      </label>

      <label className="grid gap-1.5 text-sm">
        <span className="font-bold text-ink">Ano de conclusão</span>
        <input
          type="number"
          value={opts.anoConclusao}
          onChange={(e) => onChange({ anoConclusao: Number(e.target.value) })}
          className="rounded-ui border border-line bg-surface px-3 py-2 text-ink"
        />
      </label>

      <label className="grid gap-1.5 text-sm">
        <span className="font-bold text-ink">Descrição do curso</span>
        <input
          value={opts.descricaoCurso}
          onChange={(e) => onChange({ descricaoCurso: e.target.value })}
          className="rounded-ui border border-line bg-surface px-3 py-2 text-ink"
        />
      </label>

      <label className="grid gap-1.5 text-sm md:col-span-2">
        <span className="font-bold text-ink">Base legal</span>
        <textarea
          rows={2}
          value={opts.baseLegal}
          onChange={(e) => onChange({ baseLegal: e.target.value })}
          className="rounded-ui border border-line bg-surface px-3 py-2 text-ink"
        />
      </label>

      {customizado ? (
        <label className="grid gap-1.5 text-sm md:col-span-2">
          <span className="font-bold text-ink">Texto do certificado</span>
          <textarea
            rows={5}
            value={opts.textoCustomizado ?? ""}
            onChange={(e) => onChange({ textoCustomizado: e.target.value })}
            className="rounded-ui border border-line bg-surface px-3 py-2 font-mono text-xs text-ink"
          />
          <span className="text-xs text-muted">
            Disponíveis: {"{{aluno}} {{curso}} {{ano}} {{escola}} {{serie}} {{nascimento}} {{naturalidade}} {{rg}} {{pai}} {{mae}}"}
          </span>
        </label>
      ) : null}
    </div>
  );
}
```

Criar `src/app/(app)/certificados/abas/aba-leiaute.tsx`:

```typescript
"use client";

import type { CertificadoLeiaute } from "@/lib/documents/certificado-tipos";

type Props = {
  leiaute: CertificadoLeiaute;
  onChange: (patch: Partial<CertificadoLeiaute>) => void;
};

export function AbaLeiaute({ leiaute, onChange }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="grid gap-1.5 text-sm">
        <span className="font-bold text-ink">Orientação</span>
        <select
          value={leiaute.orientacao}
          onChange={(e) => onChange({ orientacao: e.target.value as CertificadoLeiaute["orientacao"] })}
          className="rounded-ui border border-line bg-surface px-3 py-2 text-ink"
        >
          <option value="landscape">Paisagem</option>
          <option value="portrait">Retrato</option>
        </select>
      </label>

      <label className="grid gap-1.5 text-sm">
        <span className="font-bold text-ink">Margem (mm)</span>
        <input
          type="number"
          min={5}
          max={40}
          value={leiaute.margemMm}
          onChange={(e) => onChange({ margemMm: Number(e.target.value) })}
          className="rounded-ui border border-line bg-surface px-3 py-2 text-ink"
        />
      </label>

      <label className="grid gap-1.5 text-sm">
        <span className="font-bold text-ink">Tamanho da fonte (pt)</span>
        <input
          type="number"
          min={6}
          max={20}
          value={leiaute.fonteCorpoPt}
          onChange={(e) => onChange({ fonteCorpoPt: Number(e.target.value) })}
          className="rounded-ui border border-line bg-surface px-3 py-2 text-ink"
        />
      </label>

      <div className="grid gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={leiaute.mostrarLogos}
            onChange={(e) => onChange({ mostrarLogos: e.target.checked })}
          />
          <span className="text-ink">Mostrar logo da escola</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={leiaute.mostrarMoldura}
            onChange={(e) => onChange({ mostrarMoldura: e.target.checked })}
          />
          <span className="text-ink">Mostrar moldura</span>
        </label>
      </div>
    </div>
  );
}
```

Criar `src/app/(app)/certificados/abas/aba-assinatura.tsx`:

```typescript
"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LinhaAssinatura } from "@/lib/documents/certificado-tipos";

type Props = {
  assinaturas: LinhaAssinatura[];
  onChange: (assinaturas: LinhaAssinatura[]) => void;
};

export function AbaAssinatura({ assinaturas, onChange }: Props) {
  function atualizar(i: number, patch: Partial<LinhaAssinatura>) {
    onChange(assinaturas.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }

  return (
    <div className="grid gap-3">
      {assinaturas.map((a, i) => (
        <div key={i} className="grid gap-2 md:grid-cols-[1fr_200px_44px]">
          <input
            value={a.nome}
            placeholder="Nome (vazio usa o nome do aluno em 'Aluno(a)')"
            onChange={(e) => atualizar(i, { nome: e.target.value })}
            className="rounded-ui border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
          <input
            value={a.cargo}
            placeholder="Cargo"
            onChange={(e) => atualizar(i, { cargo: e.target.value })}
            className="rounded-ui border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
          <Button
            variant="ghost"
            onClick={() => onChange(assinaturas.filter((_, idx) => idx !== i))}
            aria-label={`Remover assinatura ${i + 1}`}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ))}

      {assinaturas.length < 6 ? (
        <Button variant="ghost" onClick={() => onChange([...assinaturas, { nome: "", cargo: "" }])}>
          <Plus size={16} />
          Adicionar assinatura
        </Button>
      ) : null}
    </div>
  );
}
```

Se `Button` não aceitar `variant="ghost"`, usar a variante existente mais próxima — checar `src/components/ui/button.tsx`.

- [ ] **Step 4: Escrever a aba de filtros com seleção**

Criar `src/app/(app)/certificados/abas/aba-filtros.tsx`:

```typescript
"use client";

import { Badge } from "@/components/ui/badge";
import type { OpcaoSelect, TurmaOpcao } from "@/lib/data/certificados";
import type { CertificadoData } from "@/lib/documents/certificado-tipos";

export type Filtro = {
  anoLetivo: number;
  modo: "serie" | "turma";
  serieId: string;
  turmaId: string;
  dataEmissao: string;
  titulo: string;
};

type Props = {
  anos: number[];
  series: OpcaoSelect[];
  turmas: TurmaOpcao[];
  filtro: Filtro;
  onFiltroChange: (patch: Partial<Filtro>) => void;
  alunos: CertificadoData[];
  carregando: boolean;
  selecionados: Set<string>;
  onSelecionadosChange: (ids: Set<string>) => void;
};

export function AbaFiltros({
  anos, series, turmas, filtro, onFiltroChange,
  alunos, carregando, selecionados, onSelecionadosChange,
}: Props) {
  const todosMarcados = alunos.length > 0 && alunos.every((a) => selecionados.has(a.aluno.matriculaId));

  function alternar(matriculaId: string) {
    const novo = new Set(selecionados);
    if (novo.has(matriculaId)) novo.delete(matriculaId);
    else novo.add(matriculaId);
    onSelecionadosChange(novo);
  }

  function alternarTodos() {
    onSelecionadosChange(todosMarcados ? new Set() : new Set(alunos.map((a) => a.aluno.matriculaId)));
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <span className="font-bold text-ink">Ano letivo</span>
          <select
            value={filtro.anoLetivo}
            onChange={(e) => onFiltroChange({ anoLetivo: Number(e.target.value) })}
            className="rounded-ui border border-line bg-surface px-3 py-2 text-ink"
          >
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-bold text-ink">Filtrar por</span>
          <select
            value={filtro.modo}
            onChange={(e) => onFiltroChange({ modo: e.target.value as Filtro["modo"] })}
            className="rounded-ui border border-line bg-surface px-3 py-2 text-ink"
          >
            <option value="serie">Série</option>
            <option value="turma">Turma</option>
          </select>
        </label>

        {filtro.modo === "serie" ? (
          <label className="grid gap-1.5 text-sm md:col-span-2">
            <span className="font-bold text-ink">Série</span>
            <select
              value={filtro.serieId}
              onChange={(e) => onFiltroChange({ serieId: e.target.value })}
              className="rounded-ui border border-line bg-surface px-3 py-2 text-ink"
            >
              <option value="">Selecione…</option>
              {series.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </label>
        ) : (
          <label className="grid gap-1.5 text-sm md:col-span-2">
            <span className="font-bold text-ink">Turma</span>
            <select
              value={filtro.turmaId}
              onChange={(e) => onFiltroChange({ turmaId: e.target.value })}
              className="rounded-ui border border-line bg-surface px-3 py-2 text-ink"
            >
              <option value="">Selecione…</option>
              {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </label>
        )}

        <label className="grid gap-1.5 text-sm">
          <span className="font-bold text-ink">Data de emissão</span>
          <input
            type="date"
            value={filtro.dataEmissao}
            onChange={(e) => onFiltroChange({ dataEmissao: e.target.value })}
            className="rounded-ui border border-line bg-surface px-3 py-2 text-ink"
          />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-bold text-ink">Título do certificado</span>
          <input
            value={filtro.titulo}
            onChange={(e) => onFiltroChange({ titulo: e.target.value })}
            className="rounded-ui border border-line bg-surface px-3 py-2 text-ink"
          />
        </label>
      </div>

      <div className="grid gap-2 rounded-ui border border-line">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <label className="flex items-center gap-2 text-sm font-bold text-ink">
            <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} disabled={alunos.length === 0} />
            Alunos elegíveis
          </label>
          <span className="text-xs text-muted">
            {selecionados.size} de {alunos.length} selecionados
          </span>
        </div>

        {carregando ? (
          <p className="px-3 py-4 text-sm text-muted">Carregando alunos…</p>
        ) : alunos.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted">
            Nenhum aluno com matrícula ativa neste filtro.
          </p>
        ) : (
          <ul className="max-h-72 overflow-y-auto">
            {alunos.map((a) => (
              <li key={a.aluno.matriculaId} className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
                <input
                  type="checkbox"
                  checked={selecionados.has(a.aluno.matriculaId)}
                  onChange={() => alternar(a.aluno.matriculaId)}
                />
                <span className="flex-1 text-sm text-ink">{a.aluno.nome}</span>
                <span className="text-xs text-muted">{a.aluno.serie}</span>
                {a.aluno.historico?.preenchidoEm ? (
                  <Badge tone="green">Histórico ok</Badge>
                ) : (
                  <Badge tone="gray">Sem histórico</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

Se `Badge` não aceitar `tone="green"`/`"gray"`, usar os tones existentes — checar `src/components/ui/badge.tsx`.

- [ ] **Step 5: Escrever o preview**

Criar `src/app/(app)/certificados/certificado-preview.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { renderCertificados, type ImagemCache } from "@/lib/documents/certificado-pdf";
import type { CertificadoData, CertificadoOptions } from "@/lib/documents/certificado-tipos";

type Props = {
  aluno: CertificadoData | null;
  opts: CertificadoOptions;
  imagens: ImagemCache;
};

export function CertificadoPreview({ aluno, opts, imagens }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aluno) {
      setUrl(null);
      return;
    }

    // Debounce: digitar no formulário não deve gerar um PDF por tecla.
    const timer = setTimeout(() => {
      let criada: string | null = null;
      try {
        const doc = renderCertificados([aluno], opts, imagens);
        criada = URL.createObjectURL(doc.output("blob"));
        setUrl((anterior) => {
          if (anterior) URL.revokeObjectURL(anterior);
          return criada;
        });
        setErro(null);
      } catch {
        setErro("Não foi possível gerar o preview com estes parâmetros.");
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [aluno, opts, imagens]);

  // Revoga a última URL ao desmontar.
  useEffect(() => {
    return () => {
      setUrl((anterior) => {
        if (anterior) URL.revokeObjectURL(anterior);
        return null;
      });
    };
  }, []);

  if (erro) {
    return <p className="rounded-ui border border-line bg-surface p-4 text-sm text-muted">{erro}</p>;
  }

  if (!aluno || !url) {
    return (
      <p className="rounded-ui border border-line bg-surface p-4 text-sm text-muted">
        Selecione ao menos um aluno para ver o preview.
      </p>
    );
  }

  return (
    <iframe
      title="Preview do certificado"
      src={url}
      className="h-[70vh] w-full rounded-ui border border-line bg-surface"
    />
  );
}
```

- [ ] **Step 6: Escrever o formulário que orquestra tudo**

Criar `src/app/(app)/certificados/certificado-form.tsx`:

```typescript
"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { FileText, Filter, PenLine, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { salvarCertificadoConfigAction } from "@/lib/actions/certificados";
import type { CertificadoConfigRow, OpcaoSelect, TurmaOpcao } from "@/lib/data/certificados";
import { renderCertificados, type ImagemCache } from "@/lib/documents/certificado-pdf";
import { urlToDataUrl } from "@/lib/documents/pdf-utils";
import type { CertificadoData, CertificadoOptions } from "@/lib/documents/certificado-tipos";
import { AbaAssinatura } from "./abas/aba-assinatura";
import { AbaConteudo } from "./abas/aba-conteudo";
import { AbaFiltros, type Filtro } from "./abas/aba-filtros";
import { AbaLeiaute } from "./abas/aba-leiaute";
import { CertificadoPreview } from "./certificado-preview";

type Aba = "filtros" | "conteudo" | "historico" | "leiaute" | "assinatura";

const ABAS: Array<{ id: Aba; label: string; Icon: typeof Filter }> = [
  { id: "filtros", label: "Filtros", Icon: Filter },
  { id: "conteudo", label: "Conteúdo", Icon: FileText },
  { id: "historico", label: "Histórico escolar", Icon: FileText },
  { id: "leiaute", label: "Opções de leiaute", Icon: Settings2 },
  { id: "assinatura", label: "Assinatura", Icon: PenLine },
];

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

type Props = {
  anos: number[];
  anoInicial: number;
  series: OpcaoSelect[];
  turmas: TurmaOpcao[];
  config: CertificadoConfigRow;
};

export function CertificadoForm({ anos, anoInicial, series, turmas, config }: Props) {
  const [aba, setAba] = useState<Aba>("filtros");
  const [salvando, iniciarSalvamento] = useTransition();

  const [filtro, setFiltro] = useState<Filtro>({
    anoLetivo: anoInicial,
    modo: "serie",
    serieId: "",
    turmaId: "",
    dataEmissao: hoje(),
    titulo: config.tituloCertificado,
  });

  const [opts, setOpts] = useState<CertificadoOptions>({
    tituloCertificado: config.tituloCertificado,
    textoInicio: config.textoInicio,
    descricaoCurso: config.descricaoCurso,
    baseLegal: config.baseLegal,
    anoConclusao: anoInicial,
    dataEmissao: hoje(),
    textoCustomizado: null,
    mostrarHistorico: config.mostrarHistorico,
    registroEmBranco: config.registroEmBranco,
    leiaute: config.leiaute,
    assinaturas: config.assinaturas,
  });

  const [alunos, setAlunos] = useState<CertificadoData[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [imagens, setImagens] = useState<ImagemCache>(new Map());

  // Título e data vivem no filtro (é onde a secretária os vê) mas alimentam o PDF.
  useEffect(() => {
    setOpts((o) => ({ ...o, tituloCertificado: filtro.titulo, dataEmissao: filtro.dataEmissao }));
  }, [filtro.titulo, filtro.dataEmissao]);

  // Carrega elegíveis a cada mudança de filtro relevante.
  useEffect(() => {
    const alvo = filtro.modo === "serie" ? filtro.serieId : filtro.turmaId;
    if (!alvo) {
      setAlunos([]);
      setSelecionados(new Set());
      return;
    }

    let cancelado = false;
    setCarregando(true);

    const params = new URLSearchParams({ ano: String(filtro.anoLetivo) });
    if (filtro.modo === "serie") params.set("serieId", filtro.serieId);
    else params.set("turmaId", filtro.turmaId);

    fetch(`/api/certificados/elegiveis?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
      .then((lista: CertificadoData[]) => {
        if (cancelado) return;
        setAlunos(lista);
        setSelecionados(new Set(lista.map((a) => a.aluno.matriculaId)));
      })
      .catch(() => {
        if (!cancelado) {
          setAlunos([]);
          toast.error("Não foi possível carregar os alunos deste filtro.");
        }
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [filtro.anoLetivo, filtro.modo, filtro.serieId, filtro.turmaId]);

  // Baixa o logo uma vez; o gerador é síncrono e recebe as imagens prontas.
  const logoUrl = alunos[0]?.escola.logoUrl ?? null;
  useEffect(() => {
    if (!logoUrl || imagens.has(logoUrl)) return;
    let cancelado = false;
    urlToDataUrl(logoUrl).then((img) => {
      if (cancelado || !img) return;
      setImagens((anterior) => new Map(anterior).set(logoUrl, img));
    });
    return () => {
      cancelado = true;
    };
  }, [logoUrl, imagens]);

  const selecionadosLista = useMemo(
    () => alunos.filter((a) => selecionados.has(a.aluno.matriculaId)),
    [alunos, selecionados]
  );

  const patchOpts = useCallback((patch: Partial<CertificadoOptions>) => {
    setOpts((o) => ({ ...o, ...patch }));
  }, []);

  function salvarPadrao() {
    iniciarSalvamento(async () => {
      const res = await salvarCertificadoConfigAction({
        textoInicio: opts.textoInicio,
        descricaoCurso: opts.descricaoCurso,
        baseLegal: opts.baseLegal,
        tituloCertificado: opts.tituloCertificado,
        mostrarHistorico: opts.mostrarHistorico,
        registroEmBranco: opts.registroEmBranco,
        leiaute: opts.leiaute,
        assinaturas: opts.assinaturas,
      });
      if (res.ok) toast.success("Parâmetros salvos como padrão.");
      else toast.error(res.erro);
    });
  }

  function emitir() {
    if (selecionadosLista.length === 0) {
      toast.error("Selecione ao menos um aluno.");
      return;
    }

    const invalidos = selecionadosLista.filter(
      (a) => !a.aluno.nome.trim() || !a.aluno.dataNascimento
    );
    const validos = selecionadosLista.filter((a) => !invalidos.includes(a));

    if (invalidos.length > 0) {
      toast.warning(
        `Fora do lote por falta de nome ou data de nascimento: ${invalidos
          .map((a) => a.aluno.nome || "(sem nome)")
          .join(", ")}`,
        { duration: 8000 }
      );
    }

    if (validos.length === 0) {
      toast.error("Nenhum aluno com dados suficientes para emitir.");
      return;
    }

    try {
      // Cada aluno assina o próprio certificado: a linha "Aluno(a)" sem nome
      // recebe o nome dele. Por isso o PDF é montado aluno a aluno.
      const doc = renderCertificados(validos, opts, imagens);
      const serie = validos[0]?.aluno.serie.replace(/\s+/g, "-").toLowerCase() || "turma";
      doc.save(`certificados-${serie}-${opts.anoConclusao}.pdf`);
      toast.success(`${validos.length} certificado(s) gerado(s).`);
    } catch {
      toast.error("Erro ao gerar o PDF. Revise os parâmetros.");
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel className="grid gap-4">
        <div className="flex flex-wrap gap-1.5">
          {ABAS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setAba(id)}
              className={`flex items-center gap-1.5 rounded-ui border px-3 py-1.5 text-sm ${
                aba === id ? "border-brand bg-brand text-white" : "border-line text-muted"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {aba === "filtros" ? (
          <AbaFiltros
            anos={anos}
            series={series}
            turmas={turmas}
            filtro={filtro}
            onFiltroChange={(patch) => setFiltro((f) => ({ ...f, ...patch }))}
            alunos={alunos}
            carregando={carregando}
            selecionados={selecionados}
            onSelecionadosChange={setSelecionados}
          />
        ) : null}

        {aba === "conteudo" ? <AbaConteudo opts={opts} onChange={patchOpts} /> : null}

        {aba === "historico" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="font-bold text-ink">Histórico escolar</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => patchOpts({ mostrarHistorico: true })}
                  className={`flex-1 rounded-ui border px-3 py-2 text-sm ${opts.mostrarHistorico ? "border-brand bg-brand/10 text-brand" : "border-line text-muted"}`}
                >
                  Mostrar
                </button>
                <button
                  type="button"
                  onClick={() => patchOpts({ mostrarHistorico: false })}
                  className={`flex-1 rounded-ui border px-3 py-2 text-sm ${!opts.mostrarHistorico ? "border-brand bg-brand/10 text-brand" : "border-line text-muted"}`}
                >
                  Ocultar
                </button>
              </div>
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="font-bold text-ink">Registro em branco</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => patchOpts({ registroEmBranco: true })}
                  className={`flex-1 rounded-ui border px-3 py-2 text-sm ${opts.registroEmBranco ? "border-brand bg-brand/10 text-brand" : "border-line text-muted"}`}
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => patchOpts({ registroEmBranco: false })}
                  className={`flex-1 rounded-ui border px-3 py-2 text-sm ${!opts.registroEmBranco ? "border-brand bg-brand/10 text-brand" : "border-line text-muted"}`}
                >
                  Não
                </button>
              </div>
            </label>
          </div>
        ) : null}

        {aba === "leiaute" ? (
          <AbaLeiaute
            leiaute={opts.leiaute}
            onChange={(patch) => patchOpts({ leiaute: { ...opts.leiaute, ...patch } })}
          />
        ) : null}

        {aba === "assinatura" ? (
          <AbaAssinatura
            assinaturas={opts.assinaturas}
            onChange={(assinaturas) => patchOpts({ assinaturas })}
          />
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          <Button variant="ghost" onClick={salvarPadrao} disabled={salvando}>
            <Save size={16} />
            Salvar como padrão
          </Button>
          <Button variant="accent" onClick={emitir} disabled={selecionadosLista.length === 0}>
            <FileText size={16} />
            Emitir selecionados ({selecionadosLista.length})
          </Button>
        </div>
      </Panel>

      <Panel className="grid gap-3">
        <h2 className="font-display text-lg text-ink">Preview</h2>
        <CertificadoPreview aluno={selecionadosLista[0] ?? null} opts={opts} imagens={imagens} />
      </Panel>
    </div>
  );
}
```

- [ ] **Step 7: Criar a rota de API dos elegíveis**

O formulário busca elegíveis por `fetch`. Criar `src/app/api/certificados/elegiveis/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getAlunosElegiveis } from "@/lib/data/certificados";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ano = Number(searchParams.get("ano"));
  const serieId = searchParams.get("serieId") ?? undefined;
  const turmaId = searchParams.get("turmaId") ?? undefined;

  if (!Number.isFinite(ano) || (!serieId && !turmaId)) {
    return NextResponse.json({ erro: "Filtro inválido." }, { status: 400 });
  }

  try {
    const alunos = await getAlunosElegiveis({ anoLetivo: ano, serieId, turmaId });
    return NextResponse.json(alunos);
  } catch {
    return NextResponse.json({ erro: "Falha ao carregar alunos." }, { status: 500 });
  }
}
```

- [ ] **Step 8: Adicionar o link no menu**

Em `src/components/layout/topbar.tsx`, dentro de `SECRETARIA_ITEMS`, no bloco `"Aluno"`, após a linha de Matrículas:

```typescript
      { href: "/certificados", label: "Certificados", iconName: "Award" },
```

Confirmar que `"Award"` existe no tipo de ícones do topbar:

```bash
grep -rn "Award" src/components/layout/topbar-icons.tsx src/components/layout/*.tsx | head -5
```
Se não existir, registrar o ícone junto dos outros ou usar `"FileText"`, que já é usado ali.

- [ ] **Step 9: Verificar**

```bash
npm run typecheck && npm run build
```
Esperado: verdes. Erros prováveis e o que fazer: props de `Panel`/`Button`/`Badge` diferentes do assumido (ajustar ao arquivo real); ícone inexistente no topbar (trocar por `FileText`).

- [ ] **Step 10: Commit**

```bash
git add "src/app/(app)/certificados" src/app/api/certificados src/components/layout/topbar.tsx
git commit -m "feat(certificados): tela com abas, selecao de alunos e preview"
```

---

### Task 9: Editor do histórico escolar

**Files:**
- Create: `src/app/(app)/certificados/abas/aba-historico.tsx`
- Modify: `src/app/(app)/certificados/certificado-form.tsx` (substituir o bloco inline da aba histórico pelo componente; bloquear emissão com pendentes)

**Interfaces:**
- Consumes: `carregarRascunhoHistoricoAction`, `salvarHistoricoAction` de `@/lib/actions/certificados`; `HistoricoEscolar`, `LinhaGrade` de `@/lib/documents/certificado-tipos`
- Produces: `AbaHistorico` — recebe `alunos`, `opts`, `onOptsChange`, `onHistoricoSalvo(matriculaId, hist)`

- [ ] **Step 1: Escrever o editor**

Criar `src/app/(app)/certificados/abas/aba-historico.tsx`:

```typescript
"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  carregarRascunhoHistoricoAction,
  salvarHistoricoAction,
} from "@/lib/actions/certificados";
import type {
  CertificadoData,
  CertificadoOptions,
  HistoricoEscolar,
  LinhaGrade,
} from "@/lib/documents/certificado-tipos";

const HISTORICO_VAZIO: HistoricoEscolar = {
  ensinoAnterior: null,
  grade: [],
  seriesResumo: [],
  observacoes: "",
  registroNumero: "",
  registroLivro: "",
  registroFolha: "",
  preenchidoEm: null,
};

function seriesDaGrade(hist: HistoricoEscolar): string[] {
  const dasSeries = hist.seriesResumo.map((r) => r.serie);
  if (dasSeries.length > 0) return dasSeries;
  const vistas: string[] = [];
  for (const linha of hist.grade) {
    for (const s of linha.series) if (!vistas.includes(s.serie)) vistas.push(s.serie);
  }
  return vistas;
}

/** Campo numérico que aceita vazio como null, sem virar NaN. */
function numeroOuNull(valor: string): number | null {
  const limpo = valor.trim().replace(",", ".");
  if (limpo === "") return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

type Props = {
  alunos: CertificadoData[];
  opts: CertificadoOptions;
  onOptsChange: (patch: Partial<CertificadoOptions>) => void;
  onHistoricoSalvo: (matriculaId: string, hist: HistoricoEscolar) => void;
};

export function AbaHistorico({ alunos, opts, onOptsChange, onHistoricoSalvo }: Props) {
  const [matriculaId, setMatriculaId] = useState<string>(alunos[0]?.aluno.matriculaId ?? "");
  const [hist, setHist] = useState<HistoricoEscolar>(HISTORICO_VAZIO);
  const [carregando, setCarregando] = useState(false);
  const [salvando, iniciarSalvamento] = useTransition();

  const alunoAtual = alunos.find((a) => a.aluno.matriculaId === matriculaId) ?? null;

  useEffect(() => {
    if (alunos.length > 0 && !alunos.some((a) => a.aluno.matriculaId === matriculaId)) {
      setMatriculaId(alunos[0].aluno.matriculaId);
    }
  }, [alunos, matriculaId]);

  // Histórico salvo entra direto; sem salvo, pede o rascunho ao servidor.
  useEffect(() => {
    if (!alunoAtual) {
      setHist(HISTORICO_VAZIO);
      return;
    }
    if (alunoAtual.aluno.historico) {
      setHist(alunoAtual.aluno.historico);
      return;
    }

    let cancelado = false;
    setCarregando(true);
    carregarRascunhoHistoricoAction(alunoAtual.aluno.alunoId)
      .then((rascunho) => {
        if (!cancelado) setHist(rascunho);
      })
      .catch(() => {
        if (!cancelado) {
          setHist(HISTORICO_VAZIO);
          toast.error("Não foi possível montar o rascunho do histórico.");
        }
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [alunoAtual]);

  const series = seriesDaGrade(hist);

  function atualizarLinha(i: number, patch: Partial<LinhaGrade>) {
    setHist((h) => ({ ...h, grade: h.grade.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) }));
  }

  function atualizarCelula(i: number, serie: string, campo: "media" | "ch", valor: string) {
    setHist((h) => ({
      ...h,
      grade: h.grade.map((linha, idx) => {
        if (idx !== i) return linha;
        const existe = linha.series.some((s) => s.serie === serie);
        const series = existe
          ? linha.series.map((s) => (s.serie === serie ? { ...s, [campo]: numeroOuNull(valor) } : s))
          : [...linha.series, { serie, media: null, ch: null, [campo]: numeroOuNull(valor) }];
        return { ...linha, series } as LinhaGrade;
      }),
    }));
  }

  function salvar() {
    if (!alunoAtual) return;
    iniciarSalvamento(async () => {
      const res = await salvarHistoricoAction(
        alunoAtual.aluno.matriculaId,
        alunoAtual.aluno.alunoId,
        hist
      );
      if (res.ok) {
        const salvo = { ...hist, preenchidoEm: new Date().toISOString() };
        setHist(salvo);
        onHistoricoSalvo(alunoAtual.aluno.matriculaId, salvo);
        toast.success("Histórico salvo.");
      } else {
        toast.error(res.erro);
      }
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <span className="font-bold text-ink">Histórico escolar</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onOptsChange({ mostrarHistorico: true })}
              className={`flex-1 rounded-ui border px-3 py-2 text-sm ${opts.mostrarHistorico ? "border-brand bg-brand/10 text-brand" : "border-line text-muted"}`}
            >
              Mostrar
            </button>
            <button
              type="button"
              onClick={() => onOptsChange({ mostrarHistorico: false })}
              className={`flex-1 rounded-ui border px-3 py-2 text-sm ${!opts.mostrarHistorico ? "border-brand bg-brand/10 text-brand" : "border-line text-muted"}`}
            >
              Ocultar
            </button>
          </div>
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-bold text-ink">Registro em branco</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onOptsChange({ registroEmBranco: true })}
              className={`flex-1 rounded-ui border px-3 py-2 text-sm ${opts.registroEmBranco ? "border-brand bg-brand/10 text-brand" : "border-line text-muted"}`}
            >
              Sim
            </button>
            <button
              type="button"
              onClick={() => onOptsChange({ registroEmBranco: false })}
              className={`flex-1 rounded-ui border px-3 py-2 text-sm ${!opts.registroEmBranco ? "border-brand bg-brand/10 text-brand" : "border-line text-muted"}`}
            >
              Não
            </button>
          </div>
        </label>
      </div>

      {!opts.mostrarHistorico ? (
        <p className="rounded-ui border border-line bg-surface p-4 text-sm text-muted">
          O histórico está oculto. Ligue &quot;Mostrar&quot; para editar a grade.
        </p>
      ) : alunos.length === 0 ? (
        <p className="rounded-ui border border-line bg-surface p-4 text-sm text-muted">
          Selecione um filtro na aba Filtros para escolher o aluno.
        </p>
      ) : (
        <>
          <label className="grid gap-1.5 text-sm">
            <span className="font-bold text-ink">Aluno</span>
            <select
              value={matriculaId}
              onChange={(e) => setMatriculaId(e.target.value)}
              className="rounded-ui border border-line bg-surface px-3 py-2 text-ink"
            >
              {alunos.map((a) => (
                <option key={a.aluno.matriculaId} value={a.aluno.matriculaId}>
                  {a.aluno.nome}
                  {a.aluno.historico?.preenchidoEm ? " ✓" : " (pendente)"}
                </option>
              ))}
            </select>
          </label>

          {carregando ? (
            <p className="text-sm text-muted">Montando rascunho…</p>
          ) : (
            <>
              <div className="grid gap-2 rounded-ui border border-line p-3">
                <h3 className="text-sm font-bold text-ink">Ensino anterior</h3>
                <div className="grid gap-2 md:grid-cols-5">
                  <input
                    placeholder="Nível"
                    value={hist.ensinoAnterior?.nivel ?? ""}
                    onChange={(e) =>
                      setHist((h) => ({
                        ...h,
                        ensinoAnterior: {
                          nivel: e.target.value,
                          escola: h.ensinoAnterior?.escola ?? "",
                          cidade: h.ensinoAnterior?.cidade ?? "",
                          uf: h.ensinoAnterior?.uf ?? "",
                          ano: h.ensinoAnterior?.ano ?? null,
                        },
                      }))
                    }
                    className="rounded-ui border border-line bg-surface px-2 py-1.5 text-sm text-ink md:col-span-2"
                  />
                  <input
                    placeholder="Estabelecimento"
                    value={hist.ensinoAnterior?.escola ?? ""}
                    onChange={(e) =>
                      setHist((h) => ({
                        ...h,
                        ensinoAnterior: {
                          nivel: h.ensinoAnterior?.nivel ?? "",
                          escola: e.target.value,
                          cidade: h.ensinoAnterior?.cidade ?? "",
                          uf: h.ensinoAnterior?.uf ?? "",
                          ano: h.ensinoAnterior?.ano ?? null,
                        },
                      }))
                    }
                    className="rounded-ui border border-line bg-surface px-2 py-1.5 text-sm text-ink md:col-span-2"
                  />
                  <input
                    placeholder="Ano"
                    inputMode="numeric"
                    value={hist.ensinoAnterior?.ano ?? ""}
                    onChange={(e) =>
                      setHist((h) => ({
                        ...h,
                        ensinoAnterior: {
                          nivel: h.ensinoAnterior?.nivel ?? "",
                          escola: h.ensinoAnterior?.escola ?? "",
                          cidade: h.ensinoAnterior?.cidade ?? "",
                          uf: h.ensinoAnterior?.uf ?? "",
                          ano: numeroOuNull(e.target.value),
                        },
                      }))
                    }
                    className="rounded-ui border border-line bg-surface px-2 py-1.5 text-sm text-ink"
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-ui border border-line">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="px-2 py-1.5 text-left text-ink">Componente</th>
                      {series.map((s) => (
                        <th key={s} colSpan={2} className="px-2 py-1.5 text-center text-ink">{s}</th>
                      ))}
                      <th className="px-2 py-1.5 text-center text-ink">C.H. Total</th>
                      <th className="px-2 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {hist.grade.map((linha, i) => (
                      <tr key={i} className="border-b border-line last:border-b-0">
                        <td className="px-2 py-1">
                          <input
                            value={linha.componente}
                            onChange={(e) => atualizarLinha(i, { componente: e.target.value })}
                            className="w-40 rounded-ui border border-line bg-surface px-1.5 py-1 text-ink"
                          />
                        </td>
                        {series.map((serie) => {
                          const celula = linha.series.find((s) => s.serie === serie);
                          return (
                            <td key={serie} className="px-1 py-1">
                              <div className="flex gap-1">
                                <input
                                  aria-label={`Média de ${linha.componente} em ${serie}`}
                                  value={celula?.media ?? ""}
                                  onChange={(e) => atualizarCelula(i, serie, "media", e.target.value)}
                                  className="w-12 rounded-ui border border-line bg-surface px-1 py-1 text-center text-ink"
                                />
                                <input
                                  aria-label={`Carga horária de ${linha.componente} em ${serie}`}
                                  value={celula?.ch ?? ""}
                                  onChange={(e) => atualizarCelula(i, serie, "ch", e.target.value)}
                                  className="w-12 rounded-ui border border-line bg-surface px-1 py-1 text-center text-ink"
                                />
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-1 py-1">
                          <input
                            aria-label={`Carga horária total de ${linha.componente}`}
                            value={linha.chTotal ?? ""}
                            onChange={(e) => atualizarLinha(i, { chTotal: numeroOuNull(e.target.value) })}
                            className="w-14 rounded-ui border border-line bg-surface px-1 py-1 text-center text-ink"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <button
                            type="button"
                            aria-label={`Remover ${linha.componente}`}
                            onClick={() =>
                              setHist((h) => ({ ...h, grade: h.grade.filter((_, idx) => idx !== i) }))
                            }
                            className="text-muted hover:text-ink"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Button
                variant="ghost"
                onClick={() =>
                  setHist((h) => ({
                    ...h,
                    grade: [
                      ...h.grade,
                      {
                        componente: "",
                        parte: "comum",
                        series: series.map((serie) => ({ serie, media: null, ch: null })),
                        chTotal: null,
                      },
                    ],
                  }))
                }
              >
                <Plus size={16} />
                Adicionar componente
              </Button>

              <div className="grid gap-2 rounded-ui border border-line p-3">
                <h3 className="text-sm font-bold text-ink">Séries cursadas</h3>
                {hist.seriesResumo.map((r, i) => (
                  <div key={i} className="grid gap-2 md:grid-cols-6">
                    <input
                      value={r.serie}
                      aria-label={`Série ${i + 1}`}
                      onChange={(e) =>
                        setHist((h) => ({
                          ...h,
                          seriesResumo: h.seriesResumo.map((x, idx) => (idx === i ? { ...x, serie: e.target.value } : x)),
                        }))
                      }
                      className="rounded-ui border border-line bg-surface px-2 py-1.5 text-sm text-ink"
                    />
                    <input
                      value={r.estabelecimento}
                      aria-label={`Estabelecimento da série ${i + 1}`}
                      onChange={(e) =>
                        setHist((h) => ({
                          ...h,
                          seriesResumo: h.seriesResumo.map((x, idx) => (idx === i ? { ...x, estabelecimento: e.target.value } : x)),
                        }))
                      }
                      className="rounded-ui border border-line bg-surface px-2 py-1.5 text-sm text-ink md:col-span-2"
                    />
                    <input
                      value={r.resultado}
                      placeholder="Resultado"
                      aria-label={`Resultado da série ${i + 1}`}
                      onChange={(e) =>
                        setHist((h) => ({
                          ...h,
                          seriesResumo: h.seriesResumo.map((x, idx) => (idx === i ? { ...x, resultado: e.target.value } : x)),
                        }))
                      }
                      className="rounded-ui border border-line bg-surface px-2 py-1.5 text-sm text-ink"
                    />
                    <input
                      value={r.chAnual ?? ""}
                      placeholder="C.H. anual"
                      aria-label={`Carga horária anual da série ${i + 1}`}
                      onChange={(e) =>
                        setHist((h) => ({
                          ...h,
                          seriesResumo: h.seriesResumo.map((x, idx) => (idx === i ? { ...x, chAnual: numeroOuNull(e.target.value) } : x)),
                        }))
                      }
                      className="rounded-ui border border-line bg-surface px-2 py-1.5 text-sm text-ink"
                    />
                    <input
                      value={r.diasLetivos ?? ""}
                      placeholder="Dias letivos"
                      aria-label={`Dias letivos da série ${i + 1}`}
                      onChange={(e) =>
                        setHist((h) => ({
                          ...h,
                          seriesResumo: h.seriesResumo.map((x, idx) => (idx === i ? { ...x, diasLetivos: numeroOuNull(e.target.value) } : x)),
                        }))
                      }
                      className="rounded-ui border border-line bg-surface px-2 py-1.5 text-sm text-ink"
                    />
                  </div>
                ))}
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                <input
                  placeholder="Registro nº"
                  value={hist.registroNumero}
                  onChange={(e) => setHist((h) => ({ ...h, registroNumero: e.target.value }))}
                  className="rounded-ui border border-line bg-surface px-2 py-1.5 text-sm text-ink"
                />
                <input
                  placeholder="Livro nº"
                  value={hist.registroLivro}
                  onChange={(e) => setHist((h) => ({ ...h, registroLivro: e.target.value }))}
                  className="rounded-ui border border-line bg-surface px-2 py-1.5 text-sm text-ink"
                />
                <input
                  placeholder="Fls nº"
                  value={hist.registroFolha}
                  onChange={(e) => setHist((h) => ({ ...h, registroFolha: e.target.value }))}
                  className="rounded-ui border border-line bg-surface px-2 py-1.5 text-sm text-ink"
                />
              </div>

              <label className="grid gap-1.5 text-sm">
                <span className="font-bold text-ink">Observações</span>
                <textarea
                  rows={3}
                  value={hist.observacoes}
                  onChange={(e) => setHist((h) => ({ ...h, observacoes: e.target.value }))}
                  className="rounded-ui border border-line bg-surface px-3 py-2 text-ink"
                />
              </label>

              <div className="flex justify-end">
                <Button variant="accent" onClick={salvar} disabled={salvando || !alunoAtual}>
                  <Save size={16} />
                  Salvar histórico
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Ligar o editor ao formulário**

Em `src/app/(app)/certificados/certificado-form.tsx`:

Adicionar o import:

```typescript
import { AbaHistorico } from "./abas/aba-historico";
```

Substituir **todo** o bloco `{aba === "historico" ? ( ... ) : null}` por:

```typescript
        {aba === "historico" ? (
          <AbaHistorico
            alunos={selecionadosLista}
            opts={opts}
            onOptsChange={patchOpts}
            onHistoricoSalvo={(matriculaId, historico) =>
              setAlunos((lista) =>
                lista.map((a) =>
                  a.aluno.matriculaId === matriculaId
                    ? { ...a, aluno: { ...a.aluno, historico } }
                    : a
                )
              )
            }
          />
        ) : null}
```

- [ ] **Step 3: Bloquear a emissão com histórico pendente**

Ainda em `certificado-form.tsx`, dentro de `emitir()`, logo depois do bloco que calcula `validos` e antes do `if (validos.length === 0)`:

```typescript
    if (opts.mostrarHistorico) {
      const pendentes = validos.filter((a) => !a.aluno.historico?.preenchidoEm);
      if (pendentes.length > 0) {
        toast.error(
          `Histórico pendente: ${pendentes.map((a) => a.aluno.nome).join(", ")}. Preencha na aba Histórico escolar ou desligue o histórico.`,
          { duration: 10000 }
        );
        return;
      }
    }
```

- [ ] **Step 4: Verificar**

```bash
npm run typecheck && npm run build && npm run test
```
Esperado: os três verdes.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/certificados"
git commit -m "feat(certificados): editor do historico escolar com bloqueio de pendentes"
```

---

### Task 10: Verificação no app real

Nenhum teste automatizado prova que o PDF *parece* certo. Esta tarefa é a conferência visual contra o PDF de referência.

**Files:** nenhum (só correções pontuais, se aparecerem)

**Interfaces:**
- Consumes: tudo das tarefas 1–9
- Produces: nada

- [ ] **Step 1: Aplicar a migração**

```bash
npx supabase db push
```
Esperado: `202609180001_certificados.sql` aplicada. **Não** usar `db reset --local`.

- [ ] **Step 2: Subir o app**

```bash
npm run dev
```

- [ ] **Step 3: Conferir o certificado sem histórico**

Abrir `/certificados`. Escolher ano letivo e uma série com alunos. Conferir:

- a lista traz os alunos com matrícula ativa, todos marcados;
- o preview aparece à direita em paisagem;
- o cabeçalho traz nome da escola, CNPJ e endereço;
- o parágrafo mostra nome, nacionalidade, filiação, naturalidade, nascimento e RG em negrito, sem espaço duplo nem "null";
- as três assinaturas aparecem no rodapé, sem sobrepor o texto;
- alterar "Descrição do curso" atualiza o preview em menos de um segundo.

- [ ] **Step 4: Conferir o histórico**

Na aba Histórico escolar, ligar "Mostrar", escolher um aluno, conferir que a grade veio pré-preenchida com as disciplinas e médias do ano no sistema. Preencher C.H. e dias letivos de uma série, salvar, e conferir no preview: a página 2 traz a grade, a caixa de registro na direita e as observações.

- [ ] **Step 5: Conferir o lote**

Selecionar 3 alunos e emitir. Conferir que o PDF baixado tem 3 páginas (sem histórico) ou 6 (com histórico), e que cada certificado traz o nome do aluno certo.

Com o histórico ligado e um aluno pendente, conferir que a emissão é bloqueada com o nome dele na mensagem.

- [ ] **Step 6: Corrigir o que estiver errado**

Ajustes de espaçamento, tamanho de fonte e posição vivem em `certificado-pdf.ts`. Cada correção é um commit próprio:

```bash
git add src/lib/documents/certificado-pdf.ts
git commit -m "fix(certificados): ajusta <o que foi ajustado>"
```

- [ ] **Step 7: Rodar a suíte antes do PR**

```bash
npm run typecheck && npm run build && npm run test
```
Esperado: os três verdes.

---

## Notas de execução

**Se `renderCorpo` produzir um parágrafo feio** (espaçamento irregular na justificação, quebra em lugar estranho), o plano B do spec é trocar por `doc.html()`. Antes disso, tentar: desligar a justificação (usar sempre `larguraEspaco`) e conferir se o problema some. Justificação com fonte serifada e palavras longas em português costuma precisar de vãos mínimos.

**Se o autotable v5 não expuser `lastAutoTable`**, ele devolve o resultado na chamada: `const res = autoTable(doc, {...})` e o Y final sai de `res.finalY`. Conferir com `grep -n "finalY" node_modules/jspdf-autotable/dist/index.d.ts`.

**`escolas` não tem coluna de mantenedora.** O cabeçalho omite essa linha. Se a escola quiser a linha, é uma migração de uma coluna em `escolas` mais um campo em Configurações da Escola — fora deste plano.
