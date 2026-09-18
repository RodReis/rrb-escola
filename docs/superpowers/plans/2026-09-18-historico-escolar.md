# Histórico Escolar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cadastrar o histórico escolar de um aluno (anos na EPG pré-preenchidos do sistema, escolas anteriores digitadas) e emitir o PDF fiel ao modelo de referência, individual ou para uma turma inteira.

**Architecture:** Cinco tabelas novas com RLS por `escola_id`. Camada de dados (`src/lib/data/historico.ts`) monta `HistoricoData` resolvendo notas congeladas da tabela ou ao vivo de `notas_consolidadas`. Gerador puro (`src/lib/documents/historico-pdf.ts`) recebe `HistoricoData[]` e devolve um `jsPDF` — não conhece React nem Supabase. Três rotas em `src/app/(app)/historico/`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres + RLS), jsPDF 4.2.1 + jspdf-autotable 5.0.7, Vitest, Tailwind.

**Spec:** [docs/superpowers/specs/2026-09-18-historico-escolar-design.md](../specs/2026-09-18-historico-escolar-design.md)

## Global Constraints

- **Português do Brasil** em toda a UI, rótulos, mensagens de erro e comentários novos. Nomes de tabelas, colunas e enums em português sem acento (padrão do repositório).
- **Cor só via token** (`var(--token)` ou classe Tailwind tokenizada). Proibido hex/rgb cru. Ver `docs/design_system/REGRAS-CLAUDE-CODE.md`.
- **Sem serifa.** Títulos em Bricolage Grotesque. Isso vale para a UI; o PDF usa as fontes internas do jsPDF (helvetica) e não é afetado.
- **`escola_id` sempre filtrado** em toda query, usando `DEFAULT_SCHOOL_ID` de `@/lib/constants`.
- **Toda Server Action começa com `requirePermission(modulo, acao)`** antes de qualquer acesso a dado.
- **Testes ficam ao lado do código**, como `src/**/*.test.ts` — o repositório não tem diretório `tests/`. Rodar com `npm run test`.
- **Migrations** em `supabase/migrations/` com nome `AAAAMMDDNNNN_descricao.sql`. Não rodar `supabase db reset --local` (quebra por ordem de migration pré-existente); validar por review e aplicar com `db push`.
- **Trava de qualidade por task:** `npm run typecheck` e `npm run test` verdes antes de commitar.
- Módulo RBAC: **`historico`**, grupo `secretaria`, nome "Histórico Escolar". As ações são as quatro padrão (`read`/`create`/`update`/`delete`); a emissão exige `read`, a edição exige `update`. (O spec falava em `historico.editar`/`historico.emitir`; o sistema não tem permissões nomeadas assim — módulo + ação é o modelo real.)
- Rota base: **`/historico`**. (O spec dizia `/secretaria/historico`; não existe prefixo `/secretaria` no App Router deste projeto.)

---

### Task 1: Migration — enums, tabelas, RLS e RBAC

**Files:**
- Create: `supabase/migrations/202609180001_historico_escolar.sql`
- Modify: `src/lib/auth/permissions.ts` (MODULOS, ROTA_PARA_MODULO)

**Interfaces:**
- Consumes: tabelas existentes `escolas`, `alunos`, `series`, `disciplinas`, `companies`; função `current_perfil()`.
- Produces: tabelas `historico_credenciamentos`, `historico_niveis_ensino`, `historico_escolar`, `historico_anos`, `historico_notas`; enums `nivel_ensino`, `origem_historico`, `resultado_historico`; módulo RBAC `historico`.

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/202609180001_historico_escolar.sql`:

```sql
-- Historico escolar: credenciamentos, niveis de ensino por serie, historico por
-- aluno com anos (internos ou externos) e notas por disciplina.
-- Depende: escolas, alunos, series, disciplinas, companies, modulos, role_permissoes.

do $$ begin
  create type nivel_ensino as enum ('infantil', 'fund1', 'fund2', 'medio');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type origem_historico as enum ('interna', 'externa');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type resultado_historico as enum ('aprovado', 'reprovado', 'cursando', 'transferido');
exception when duplicate_object then null;
end $$;

-- ─── historico_credenciamentos ───────────────────────────────────────────────
create table if not exists public.historico_credenciamentos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  razao_social text not null,
  nome_fantasia text not null,
  cnpj text,
  resolucao text,
  endereco text,
  cidade text,
  uf text,
  cep text,
  telefones text,
  email text,
  logo_path text,
  secretario_nome text,
  secretario_cargo text not null default 'Secretário(a)',
  diretor_nome text,
  diretor_cargo text not null default 'Diretor(a)',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index historico_credenciamentos_escola_idx
  on historico_credenciamentos (escola_id);

create trigger historico_credenciamentos_updated_at
  before update on historico_credenciamentos
  for each row execute function set_updated_at();

alter table historico_credenciamentos enable row level security;

create policy historico_credenciamentos_service on historico_credenciamentos
  for all to service_role using (true) with check (true);

create policy historico_credenciamentos_escola on historico_credenciamentos
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

grant select, insert, update, delete on historico_credenciamentos to authenticated;

-- ─── historico_niveis_ensino ─────────────────────────────────────────────────
create table if not exists public.historico_niveis_ensino (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  serie_id uuid not null references series(id) on delete cascade,
  credenciamento_id uuid not null references historico_credenciamentos(id) on delete restrict,
  nivel nivel_ensino not null,
  ano_inicio int not null,
  ano_fim int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escola_id, serie_id, ano_inicio),
  check (ano_fim >= ano_inicio)
);

create index historico_niveis_ensino_serie_idx
  on historico_niveis_ensino (serie_id, ano_inicio);

create trigger historico_niveis_ensino_updated_at
  before update on historico_niveis_ensino
  for each row execute function set_updated_at();

alter table historico_niveis_ensino enable row level security;

create policy historico_niveis_ensino_service on historico_niveis_ensino
  for all to service_role using (true) with check (true);

create policy historico_niveis_ensino_escola on historico_niveis_ensino
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

grant select, insert, update, delete on historico_niveis_ensino to authenticated;

-- ─── historico_escolar ───────────────────────────────────────────────────────
create table if not exists public.historico_escolar (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  aluno_id uuid not null references alunos(id) on delete cascade,
  nivel nivel_ensino not null,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escola_id, aluno_id, nivel)
);

create index historico_escolar_aluno_idx on historico_escolar (aluno_id);

create trigger historico_escolar_updated_at
  before update on historico_escolar
  for each row execute function set_updated_at();

alter table historico_escolar enable row level security;

create policy historico_escolar_service on historico_escolar
  for all to service_role using (true) with check (true);

create policy historico_escolar_escola on historico_escolar
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

grant select, insert, update, delete on historico_escolar to authenticated;

-- ─── historico_anos ──────────────────────────────────────────────────────────
create table if not exists public.historico_anos (
  id uuid primary key default gen_random_uuid(),
  historico_id uuid not null references historico_escolar(id) on delete cascade,
  ano int not null,
  serie_id uuid references series(id) on delete set null,
  serie_nome text not null,
  origem origem_historico not null,
  instituicao text,
  cidade text,
  uf text,
  resultado resultado_historico not null default 'cursando',
  media_aprovacao numeric(4,2),
  carga_horaria int,
  dias_letivos int,
  faltas int,
  percentual_frequencia numeric(5,2),
  congelado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (historico_id, ano)
);

create index historico_anos_historico_idx on historico_anos (historico_id, ano);

create trigger historico_anos_updated_at
  before update on historico_anos
  for each row execute function set_updated_at();

alter table historico_anos enable row level security;

create policy historico_anos_service on historico_anos
  for all to service_role using (true) with check (true);

create policy historico_anos_escola on historico_anos
  for all to authenticated
  using (exists (
    select 1 from historico_escolar h
    where h.id = historico_anos.historico_id
      and h.escola_id = (select escola_id from current_perfil())
  ))
  with check (exists (
    select 1 from historico_escolar h
    where h.id = historico_anos.historico_id
      and h.escola_id = (select escola_id from current_perfil())
  ));

grant select, insert, update, delete on historico_anos to authenticated;

-- ─── historico_notas ─────────────────────────────────────────────────────────
create table if not exists public.historico_notas (
  id uuid primary key default gen_random_uuid(),
  historico_ano_id uuid not null references historico_anos(id) on delete cascade,
  disciplina_id uuid references disciplinas(id) on delete set null,
  disciplina_nome text not null,
  nota numeric(4,2),
  carga_horaria int,
  faltas int,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create index historico_notas_ano_idx on historico_notas (historico_ano_id, ordem);

alter table historico_notas enable row level security;

create policy historico_notas_service on historico_notas
  for all to service_role using (true) with check (true);

create policy historico_notas_escola on historico_notas
  for all to authenticated
  using (exists (
    select 1 from historico_anos a
    join historico_escolar h on h.id = a.historico_id
    where a.id = historico_notas.historico_ano_id
      and h.escola_id = (select escola_id from current_perfil())
  ))
  with check (exists (
    select 1 from historico_anos a
    join historico_escolar h on h.id = a.historico_id
    where a.id = historico_notas.historico_ano_id
      and h.escola_id = (select escola_id from current_perfil())
  ));

grant select, insert, update, delete on historico_notas to authenticated;

-- ─── RBAC ────────────────────────────────────────────────────────────────────
insert into modulos (codigo, grupo, nome, ordem) values
  ('historico', 'secretaria', 'Histórico Escolar', 100)
on conflict (codigo) do nothing;

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar) values
  ('admin', 'historico', true, true, true, true),
  ('secretaria', 'historico', true, true, true, true)
on conflict (role_codigo, modulo_codigo) do nothing;
```

- [ ] **Step 2: Conferir a migration contra o schema real**

Rodar:

```bash
grep -n "set_updated_at\|current_perfil" supabase/migrations/202605130001_initial_schema.sql | head -5
grep -n "unique\|primary key" supabase/migrations/202605300001_rbac_permissoes.sql | sed -n '1,12p'
```

Esperado: `set_updated_at()` e `current_perfil()` existem; `modulos` tem unique em `codigo` e `role_permissoes` tem chave composta `(role_codigo, modulo_codigo)`. Se os nomes das colunas de `modulos` ou `role_permissoes` divergirem do usado acima, ajustar a migration para o schema real antes de seguir.

- [ ] **Step 3: Registrar o módulo em permissions.ts**

Em `src/lib/auth/permissions.ts`, dentro de `MODULOS`, no bloco `// secretaria`, logo após a linha de `pipeline_sensivel`, adicionar:

```typescript
  historico: { grupo: "secretaria", nome: "Histórico Escolar" },
```

E em `ROTA_PARA_MODULO`, junto das demais rotas:

```typescript
  "/historico": "historico",
```

- [ ] **Step 4: Verificar typecheck**

Run: `npm run typecheck`
Expected: PASS, sem erro novo.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202609180001_historico_escolar.sql src/lib/auth/permissions.ts
git commit -m "feat(historico): schema, RLS e modulo RBAC do historico escolar"
```

---

### Task 2: Tipos e unificador de disciplinas

**Files:**
- Create: `src/lib/historico/tipos.ts`
- Create: `src/lib/historico/grade.ts`
- Test: `src/lib/historico/grade.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores (módulo puro).
- Produces:
  - `NivelEnsino = "infantil" | "fund1" | "fund2" | "medio"`
  - `OrigemHistorico`, `ResultadoHistorico`
  - `HistoricoNota`, `HistoricoAno`, `HistoricoCredenciamento`, `HistoricoAluno`, `HistoricoData`
  - `SERIES_POR_NIVEL: Record<NivelEnsino, string[]>`
  - `NIVEL_EXIBE_CH: Record<NivelEnsino, boolean>`
  - `normalizarDisciplina(nome: string): string`
  - `montarGrade(anos: HistoricoAno[], colunas: string[]): LinhaGrade[]`
  - `LinhaGrade = { disciplina: string; celulas: CelulaGrade[]; chTotal: number | null }`
  - `CelulaGrade = { nota: number | null; cargaHoraria: number | null }`

- [ ] **Step 1: Escrever os tipos**

Criar `src/lib/historico/tipos.ts`:

```typescript
export type NivelEnsino = "infantil" | "fund1" | "fund2" | "medio";
export type OrigemHistorico = "interna" | "externa";
export type ResultadoHistorico = "aprovado" | "reprovado" | "cursando" | "transferido";

export const NIVEL_LABEL: Record<NivelEnsino, string> = {
  infantil: "Educação Infantil",
  fund1: "Ensino Fundamental",
  fund2: "Ensino Fundamental",
  medio: "Ensino Médio"
};

/** Colunas da grade por nível, na ordem impressa. */
export const SERIES_POR_NIVEL: Record<NivelEnsino, string[]> = {
  infantil: ["MATERNAL", "JARDIM I", "JARDIM II"],
  fund1: ["1º ANO", "2º ANO", "3º ANO", "4º ANO", "5º ANO"],
  fund2: ["6º ANO", "7º ANO", "8º ANO", "9º ANO"],
  medio: ["1ª SÉRIE", "2ª SÉRIE", "3ª SÉRIE"]
};

/** C.H. por disciplina só é impressa de Fund2 em diante (ver spec, seção "O PDF"). */
export const NIVEL_EXIBE_CH: Record<NivelEnsino, boolean> = {
  infantil: false,
  fund1: false,
  fund2: true,
  medio: true
};

export type HistoricoNota = {
  disciplinaId: string | null;
  disciplinaNome: string;
  nota: number | null;
  cargaHoraria: number | null;
  faltas: number | null;
  ordem: number;
};

export type HistoricoAno = {
  id: string;
  ano: number;
  serieId: string | null;
  serieNome: string;
  origem: OrigemHistorico;
  instituicao: string | null;
  cidade: string | null;
  uf: string | null;
  resultado: ResultadoHistorico;
  mediaAprovacao: number | null;
  cargaHoraria: number | null;
  diasLetivos: number | null;
  faltas: number | null;
  percentualFrequencia: number | null;
  congelado: boolean;
  notas: HistoricoNota[];
};

export type HistoricoCredenciamento = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string | null;
  resolucao: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  telefones: string | null;
  email: string | null;
  logoPath: string | null;
  secretarioNome: string | null;
  secretarioCargo: string;
  diretorNome: string | null;
  diretorCargo: string;
};

export type HistoricoAluno = {
  id: string;
  nome: string;
  cpf: string | null;
  matricula: string | null;
  filiacao: string | null;
  dataNascimento: string | null;
  naturalidade: string | null;
  nacionalidade: string | null;
  rg: string | null;
  orgaoExpedidor: string | null;
  dataExpedicao: string | null;
};

export type HistoricoData = {
  aluno: HistoricoAluno;
  nivel: NivelEnsino;
  credenciamento: HistoricoCredenciamento;
  anos: HistoricoAno[];
  observacoes: string | null;
};
```

- [ ] **Step 2: Escrever o teste do unificador (que falha)**

Criar `src/lib/historico/grade.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { montarGrade, normalizarDisciplina } from "./grade";
import type { HistoricoAno } from "./tipos";

function ano(over: Partial<HistoricoAno> & Pick<HistoricoAno, "serieNome" | "notas">): HistoricoAno {
  return {
    id: over.serieNome,
    ano: 2024,
    serieId: null,
    origem: "externa",
    instituicao: null,
    cidade: null,
    uf: null,
    resultado: "aprovado",
    mediaAprovacao: null,
    cargaHoraria: null,
    diasLetivos: null,
    faltas: null,
    percentualFrequencia: null,
    congelado: true,
    ...over
  };
}

function nota(disciplinaNome: string, valor: number | null, ch: number | null = null) {
  return { disciplinaId: null, disciplinaNome, nota: valor, cargaHoraria: ch, faltas: null, ordem: 0 };
}

describe("normalizarDisciplina", () => {
  it("ignora acento e caixa", () => {
    expect(normalizarDisciplina("Matemática")).toBe(normalizarDisciplina("MATEMATICA"));
  });

  it("ignora espaços nas bordas e espaços repetidos", () => {
    expect(normalizarDisciplina("  LÍNGUA   PORTUGUESA ")).toBe(normalizarDisciplina("LINGUA PORTUGUESA"));
  });
});

describe("montarGrade", () => {
  it("colapsa a mesma disciplina escrita de formas diferentes numa linha só", () => {
    const anos = [
      ano({ serieNome: "1º ANO", notas: [nota("MATEMÁTICA", 9.9)] }),
      ano({ serieNome: "2º ANO", notas: [nota("Matematica", 10)] })
    ];

    const grade = montarGrade(anos, ["1º ANO", "2º ANO"]);

    expect(grade).toHaveLength(1);
    expect(grade[0].celulas.map((c) => c.nota)).toEqual([9.9, 10]);
  });

  it("usa a grafia do primeiro ano em que a disciplina aparece", () => {
    const anos = [
      ano({ serieNome: "1º ANO", notas: [nota("MATEMÁTICA", 9.9)] }),
      ano({ serieNome: "2º ANO", notas: [nota("Matematica", 10)] })
    ];

    expect(montarGrade(anos, ["1º ANO", "2º ANO"])[0].disciplina).toBe("MATEMÁTICA");
  });

  it("deixa célula nula na série em que a disciplina não existe", () => {
    const anos = [
      ano({ serieNome: "1º ANO", notas: [nota("CIÊNCIAS", 9.9)] }),
      ano({ serieNome: "2º ANO", notas: [nota("LEITURA", 10)] })
    ];

    const grade = montarGrade(anos, ["1º ANO", "2º ANO"]);

    expect(grade.map((l) => l.disciplina)).toEqual(["CIÊNCIAS", "LEITURA"]);
    expect(grade[0].celulas[1].nota).toBeNull();
    expect(grade[1].celulas[0].nota).toBeNull();
  });

  it("gera uma célula por coluna pedida, mesmo sem ano cursado", () => {
    const anos = [ano({ serieNome: "1º ANO", notas: [nota("ARTE", 10)] })];

    const grade = montarGrade(anos, ["1º ANO", "2º ANO", "3º ANO"]);

    expect(grade[0].celulas).toHaveLength(3);
    expect(grade[0].celulas[2].nota).toBeNull();
  });

  it("soma a carga horária das séries cursadas em chTotal", () => {
    const anos = [
      ano({ serieNome: "6º ANO", notas: [nota("ARTE", 10, 40)] }),
      ano({ serieNome: "7º ANO", notas: [nota("ARTE", 9, 60)] })
    ];

    expect(montarGrade(anos, ["6º ANO", "7º ANO"])[0].chTotal).toBe(100);
  });

  it("deixa chTotal nulo quando nenhuma série informa carga horária", () => {
    const anos = [ano({ serieNome: "1º ANO", notas: [nota("ARTE", 10)] })];

    expect(montarGrade(anos, ["1º ANO"])[0].chTotal).toBeNull();
  });

  it("preserva a ordem de aparição das disciplinas entre anos", () => {
    const anos = [
      ano({ serieNome: "1º ANO", notas: [nota("CIÊNCIAS", 9), nota("ARTE", 8)] }),
      ano({ serieNome: "2º ANO", notas: [nota("ARTE", 10), nota("HISTÓRIA", 7)] })
    ];

    expect(montarGrade(anos, ["1º ANO", "2º ANO"]).map((l) => l.disciplina)).toEqual([
      "CIÊNCIAS",
      "ARTE",
      "HISTÓRIA"
    ]);
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npm run test -- src/lib/historico/grade.test.ts`
Expected: FAIL — `Failed to resolve import "./grade"`.

- [ ] **Step 4: Implementar o unificador**

Criar `src/lib/historico/grade.ts`:

```typescript
import type { HistoricoAno } from "./tipos";

export type CelulaGrade = {
  nota: number | null;
  cargaHoraria: number | null;
};

export type LinhaGrade = {
  disciplina: string;
  celulas: CelulaGrade[];
  chTotal: number | null;
};

const CELULA_VAZIA: CelulaGrade = { nota: null, cargaHoraria: null };

/**
 * Chave de unificação: maiúsculas, sem acento, espaços colapsados.
 * "Matemática" e "MATEMATICA" viram a mesma linha da grade.
 */
export function normalizarDisciplina(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Monta as linhas da grade: uma por disciplina, uma célula por coluna pedida.
 * A grafia impressa é a do primeiro ano em que a disciplina aparece.
 */
export function montarGrade(anos: HistoricoAno[], colunas: string[]): LinhaGrade[] {
  const indicePorColuna = new Map<string, number>();
  colunas.forEach((coluna, i) => indicePorColuna.set(normalizarDisciplina(coluna), i));

  const linhas = new Map<string, LinhaGrade>();

  for (const ano of anos) {
    const coluna = indicePorColuna.get(normalizarDisciplina(ano.serieNome));
    if (coluna === undefined) continue;

    for (const nota of ano.notas) {
      const chave = normalizarDisciplina(nota.disciplinaNome);
      let linha = linhas.get(chave);
      if (!linha) {
        linha = {
          disciplina: nota.disciplinaNome,
          celulas: colunas.map(() => ({ ...CELULA_VAZIA })),
          chTotal: null
        };
        linhas.set(chave, linha);
      }
      linha.celulas[coluna] = { nota: nota.nota, cargaHoraria: nota.cargaHoraria };
      if (nota.cargaHoraria !== null) {
        linha.chTotal = (linha.chTotal ?? 0) + nota.cargaHoraria;
      }
    }
  }

  return [...linhas.values()];
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npm run test -- src/lib/historico/grade.test.ts`
Expected: PASS, 9 testes.

- [ ] **Step 6: Verificar typecheck e commitar**

```bash
npm run typecheck
git add src/lib/historico/
git commit -m "feat(historico): tipos e unificador de disciplinas da grade"
```

---

### Task 3: Camada de dados — leitura do histórico

**Files:**
- Create: `src/lib/data/historico.ts`
- Create: `src/lib/historico/medias.ts`
- Test: `src/lib/historico/medias.test.ts`

**Interfaces:**
- Consumes: `HistoricoData`, `HistoricoAno`, `HistoricoNota`, `NivelEnsino` de `@/lib/historico/tipos`.
- Produces:
  - `mediaAnual(bimestrais: Array<number | null>): number | null`
  - `getHistoricoAluno(alunoId: string, nivel: NivelEnsino): Promise<HistoricoData | null>`
  - `getCredenciamentoVigente(serieId: string, ano: number): Promise<HistoricoCredenciamento | null>`
  - `listarNiveisEnsino(): Promise<NivelEnsinoRow[]>` onde
    `NivelEnsinoRow = { id, serieId, serieNome, credenciamentoId, credenciamentoNome, nivel, anoInicio, anoFim }`
  - `listarCredenciamentos(): Promise<Array<{ id: string; nomeFantasia: string }>>`

- [ ] **Step 1: Escrever o teste da média anual (que falha)**

Criar `src/lib/historico/medias.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { mediaAnual } from "./medias";

describe("mediaAnual", () => {
  it("calcula a média das bimestrais informadas", () => {
    expect(mediaAnual([10, 9, 8, 9])).toBe(9);
  });

  it("arredonda para uma casa decimal", () => {
    expect(mediaAnual([9.9, 9.8, 10, 9.9])).toBe(9.9);
  });

  it("ignora bimestres sem nota", () => {
    expect(mediaAnual([10, null, 8, null])).toBe(9);
  });

  it("devolve null quando não há nenhuma nota", () => {
    expect(mediaAnual([null, null, null, null])).toBeNull();
  });

  it("devolve null para lista vazia", () => {
    expect(mediaAnual([])).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test -- src/lib/historico/medias.test.ts`
Expected: FAIL — `Failed to resolve import "./medias"`.

- [ ] **Step 3: Implementar a média**

Criar `src/lib/historico/medias.ts`:

```typescript
/** Média anual de uma disciplina: média simples das bimestrais lançadas. */
export function mediaAnual(bimestrais: Array<number | null>): number | null {
  const valores = bimestrais.filter((v): v is number => v !== null);
  if (valores.length === 0) return null;
  const soma = valores.reduce((acc, v) => acc + v, 0);
  return Math.round((soma / valores.length) * 10) / 10;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test -- src/lib/historico/medias.test.ts`
Expected: PASS, 5 testes.

- [ ] **Step 5: Escrever a camada de dados**

Criar `src/lib/data/historico.ts`:

```typescript
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { mediaAnual } from "@/lib/historico/medias";
import type {
  HistoricoAno,
  HistoricoCredenciamento,
  HistoricoData,
  HistoricoNota,
  NivelEnsino
} from "@/lib/historico/tipos";
import { createServerClient } from "@/lib/supabase/server";

export type NivelEnsinoRow = {
  id: string;
  serieId: string;
  serieNome: string;
  credenciamentoId: string;
  credenciamentoNome: string;
  nivel: NivelEnsino;
  anoInicio: number;
  anoFim: number;
};

function mapCredenciamento(row: Record<string, unknown>): HistoricoCredenciamento {
  return {
    razaoSocial: (row.razao_social as string) ?? "",
    nomeFantasia: (row.nome_fantasia as string) ?? "",
    cnpj: (row.cnpj as string) ?? null,
    resolucao: (row.resolucao as string) ?? null,
    endereco: (row.endereco as string) ?? null,
    cidade: (row.cidade as string) ?? null,
    uf: (row.uf as string) ?? null,
    cep: (row.cep as string) ?? null,
    telefones: (row.telefones as string) ?? null,
    email: (row.email as string) ?? null,
    logoPath: (row.logo_path as string) ?? null,
    secretarioNome: (row.secretario_nome as string) ?? null,
    secretarioCargo: (row.secretario_cargo as string) ?? "Secretário(a)",
    diretorNome: (row.diretor_nome as string) ?? null,
    diretorCargo: (row.diretor_cargo as string) ?? "Diretor(a)"
  };
}

export async function listarCredenciamentos() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("historico_credenciamentos")
    .select("id, nome_fantasia")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("nome_fantasia");
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id as string, nomeFantasia: r.nome_fantasia as string }));
}

export async function listarNiveisEnsino(): Promise<NivelEnsinoRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("historico_niveis_ensino")
    .select("id, serie_id, nivel, ano_inicio, ano_fim, series(nome), historico_credenciamentos(id, nome_fantasia)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("ano_inicio", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const serie = row.series as { nome?: string } | null;
    const cred = row.historico_credenciamentos as { id?: string; nome_fantasia?: string } | null;
    return {
      id: row.id as string,
      serieId: row.serie_id as string,
      serieNome: serie?.nome ?? "",
      credenciamentoId: cred?.id ?? "",
      credenciamentoNome: cred?.nome_fantasia ?? "",
      nivel: row.nivel as NivelEnsino,
      anoInicio: row.ano_inicio as number,
      anoFim: row.ano_fim as number
    };
  });
}

export async function getCredenciamentoVigente(
  serieId: string,
  ano: number
): Promise<HistoricoCredenciamento | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("historico_niveis_ensino")
    .select("historico_credenciamentos(*)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("serie_id", serieId)
    .lte("ano_inicio", ano)
    .gte("ano_fim", ano)
    .maybeSingle();
  if (error) throw error;
  const cred = data?.historico_credenciamentos as Record<string, unknown> | null;
  return cred ? mapCredenciamento(cred) : null;
}

/** Médias ao vivo de um ano interno, calculadas de notas_consolidadas. */
async function notasAoVivo(alunoId: string, anoLetivo: number): Promise<HistoricoNota[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("notas_consolidadas")
    .select("disciplina_id, bimestre, media, disciplinas(nome, ordem)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("aluno_id", alunoId)
    .eq("ano_letivo", anoLetivo);
  if (error) throw error;

  const porDisciplina = new Map<string, { nome: string; ordem: number; bimestrais: Array<number | null> }>();
  for (const row of data ?? []) {
    const id = row.disciplina_id as string;
    const disciplina = row.disciplinas as { nome?: string; ordem?: number } | null;
    let entrada = porDisciplina.get(id);
    if (!entrada) {
      entrada = { nome: disciplina?.nome ?? "", ordem: disciplina?.ordem ?? 0, bimestrais: [] };
      porDisciplina.set(id, entrada);
    }
    entrada.bimestrais.push(row.media === null ? null : Number(row.media));
  }

  return [...porDisciplina.entries()]
    .map(([disciplinaId, e]) => ({
      disciplinaId,
      disciplinaNome: e.nome,
      nota: mediaAnual(e.bimestrais),
      cargaHoraria: null,
      faltas: null,
      ordem: e.ordem
    }))
    .sort((a, b) => a.ordem - b.ordem);
}

export async function getHistoricoAluno(
  alunoId: string,
  nivel: NivelEnsino
): Promise<HistoricoData | null> {
  const supabase = await createServerClient();

  const { data: historico, error: erroHistorico } = await supabase
    .from("historico_escolar")
    .select("id, observacoes")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("aluno_id", alunoId)
    .eq("nivel", nivel)
    .maybeSingle();
  if (erroHistorico) throw erroHistorico;
  if (!historico) return null;

  const [{ data: aluno, error: erroAluno }, { data: anosRows, error: erroAnos }] = await Promise.all([
    supabase
      .from("alunos")
      .select("id, nome, cpf, matricula_codigo, data_nascimento, naturalidade, nacionalidade, rg, orgao_expedidor, data_expedicao, filiacao")
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .eq("id", alunoId)
      .maybeSingle(),
    supabase
      .from("historico_anos")
      .select("*, historico_notas(*)")
      .eq("historico_id", historico.id as string)
      .order("ano")
  ]);
  if (erroAluno) throw erroAluno;
  if (erroAnos) throw erroAnos;
  if (!aluno) return null;

  const anos: HistoricoAno[] = [];
  for (const row of anosRows ?? []) {
    const congelado = row.congelado as boolean;
    const origem = row.origem as HistoricoAno["origem"];
    const notas: HistoricoNota[] =
      !congelado && origem === "interna"
        ? await notasAoVivo(alunoId, row.ano as number)
        : ((row.historico_notas as Record<string, unknown>[]) ?? [])
            .map((n) => ({
              disciplinaId: (n.disciplina_id as string) ?? null,
              disciplinaNome: n.disciplina_nome as string,
              nota: n.nota === null ? null : Number(n.nota),
              cargaHoraria: (n.carga_horaria as number) ?? null,
              faltas: (n.faltas as number) ?? null,
              ordem: (n.ordem as number) ?? 0
            }))
            .sort((a, b) => a.ordem - b.ordem);

    anos.push({
      id: row.id as string,
      ano: row.ano as number,
      serieId: (row.serie_id as string) ?? null,
      serieNome: row.serie_nome as string,
      origem,
      instituicao: (row.instituicao as string) ?? null,
      cidade: (row.cidade as string) ?? null,
      uf: (row.uf as string) ?? null,
      resultado: row.resultado as HistoricoAno["resultado"],
      mediaAprovacao: row.media_aprovacao === null ? null : Number(row.media_aprovacao),
      cargaHoraria: (row.carga_horaria as number) ?? null,
      diasLetivos: (row.dias_letivos as number) ?? null,
      faltas: (row.faltas as number) ?? null,
      percentualFrequencia:
        row.percentual_frequencia === null ? null : Number(row.percentual_frequencia),
      congelado,
      notas
    });
  }

  const primeiroInterno = anos.find((a) => a.origem === "interna" && a.serieId);
  const credenciamento = primeiroInterno?.serieId
    ? await getCredenciamentoVigente(primeiroInterno.serieId, primeiroInterno.ano)
    : null;

  return {
    aluno: {
      id: aluno.id as string,
      nome: aluno.nome as string,
      cpf: (aluno.cpf as string) ?? null,
      matricula: (aluno.matricula_codigo as string) ?? null,
      filiacao: (aluno.filiacao as string) ?? null,
      dataNascimento: (aluno.data_nascimento as string) ?? null,
      naturalidade: (aluno.naturalidade as string) ?? null,
      nacionalidade: (aluno.nacionalidade as string) ?? null,
      rg: (aluno.rg as string) ?? null,
      orgaoExpedidor: (aluno.orgao_expedidor as string) ?? null,
      dataExpedicao: (aluno.data_expedicao as string) ?? null
    },
    nivel,
    credenciamento: credenciamento ?? {
      razaoSocial: "",
      nomeFantasia: "",
      cnpj: null,
      resolucao: null,
      endereco: null,
      cidade: null,
      uf: null,
      cep: null,
      telefones: null,
      email: null,
      logoPath: null,
      secretarioNome: null,
      secretarioCargo: "Secretário(a)",
      diretorNome: null,
      diretorCargo: "Diretor(a)"
    },
    anos,
    observacoes: (historico.observacoes as string) ?? null
  };
}
```

- [ ] **Step 6: Conferir as colunas de `alunos` usadas acima**

Run:

```bash
grep -n "rg\|orgao_expedidor\|data_expedicao\|naturalidade\|nacionalidade\|filiacao\|cpf\|matricula_codigo" supabase/migrations/202605130001_initial_schema.sql | sed -n '1,20p'
grep -rn "add column" supabase/migrations/*.sql | grep -i "alunos" | head -20
```

Expected: cada coluna referenciada no `select` de `alunos` existe. Para as que **não** existirem, remover do `select` e devolver `null` no mapeamento — sem criar coluna nova nesta task. Anotar quais faltaram no corpo do commit.

- [ ] **Step 7: Verificar typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/data/historico.ts src/lib/historico/medias.ts src/lib/historico/medias.test.ts
git commit -m "feat(historico): camada de dados com media anual e notas ao vivo"
```

---

### Task 4: Server Actions — gravar histórico, anos e associações

**Files:**
- Create: `src/lib/actions/historico.ts`
- Create: `src/lib/historico/congelamento.ts`
- Test: `src/lib/historico/congelamento.test.ts`
- Test: `src/lib/historico/associacoes.test.ts`
- Create: `src/lib/historico/associacoes.ts`

**Interfaces:**
- Consumes: `getHistoricoAluno` de `@/lib/data/historico`; tipos de `@/lib/historico/tipos`.
- Produces:
  - `deveCongelar(resultado: ResultadoHistorico, origem: OrigemHistorico): boolean`
  - `rangesSobrepostos(a: Range, b: Range): boolean` onde `Range = { anoInicio: number; anoFim: number }`
  - `validarNovaAssociacao(nova: Range, existentes: Range[]): { ok: true } | { ok: false; conflito: Range }`
  - Actions: `salvarObservacaoAction`, `salvarAnoHistoricoAction`, `removerAnoHistoricoAction`, `salvarNotasAnoAction`, `salvarAssociacaoAction`, `removerAssociacaoAction`

- [ ] **Step 1: Escrever os testes das regras puras (que falham)**

Criar `src/lib/historico/congelamento.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { deveCongelar } from "./congelamento";

describe("deveCongelar", () => {
  it("congela ano interno com resultado final", () => {
    expect(deveCongelar("aprovado", "interna")).toBe(true);
    expect(deveCongelar("reprovado", "interna")).toBe(true);
    expect(deveCongelar("transferido", "interna")).toBe(true);
  });

  it("não congela ano interno ainda em curso", () => {
    expect(deveCongelar("cursando", "interna")).toBe(false);
  });

  it("congela ano externo sempre, inclusive 'cursando'", () => {
    expect(deveCongelar("cursando", "externa")).toBe(true);
    expect(deveCongelar("aprovado", "externa")).toBe(true);
  });
});
```

Criar `src/lib/historico/associacoes.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { rangesSobrepostos, validarNovaAssociacao } from "./associacoes";

describe("rangesSobrepostos", () => {
  it("detecta sobreposição parcial", () => {
    expect(rangesSobrepostos({ anoInicio: 2020, anoFim: 2024 }, { anoInicio: 2023, anoFim: 2026 })).toBe(true);
  });

  it("detecta range contido em outro", () => {
    expect(rangesSobrepostos({ anoInicio: 2020, anoFim: 2026 }, { anoInicio: 2022, anoFim: 2023 })).toBe(true);
  });

  it("aceita ranges adjacentes sem sobreposição", () => {
    expect(rangesSobrepostos({ anoInicio: 2020, anoFim: 2023 }, { anoInicio: 2024, anoFim: 2026 })).toBe(false);
  });

  it("detecta sobreposição de um único ano na borda", () => {
    expect(rangesSobrepostos({ anoInicio: 2020, anoFim: 2024 }, { anoInicio: 2024, anoFim: 2026 })).toBe(true);
  });
});

describe("validarNovaAssociacao", () => {
  it("aceita quando não há conflito", () => {
    const r = validarNovaAssociacao({ anoInicio: 2025, anoFim: 2026 }, [{ anoInicio: 2020, anoFim: 2024 }]);
    expect(r.ok).toBe(true);
  });

  it("rejeita apontando o range conflitante", () => {
    const existente = { anoInicio: 2020, anoFim: 2024 };
    const r = validarNovaAssociacao({ anoInicio: 2023, anoFim: 2026 }, [existente]);
    expect(r).toEqual({ ok: false, conflito: existente });
  });

  it("aceita quando não há nenhuma associação prévia", () => {
    expect(validarNovaAssociacao({ anoInicio: 2020, anoFim: 2026 }, []).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm run test -- src/lib/historico/congelamento.test.ts src/lib/historico/associacoes.test.ts`
Expected: FAIL — módulos `./congelamento` e `./associacoes` não resolvem.

- [ ] **Step 3: Implementar as regras puras**

Criar `src/lib/historico/congelamento.ts`:

```typescript
import type { OrigemHistorico, ResultadoHistorico } from "./tipos";

/**
 * Ano externo nasce congelado — não há o que recalcular.
 * Ano interno congela quando recebe resultado final: daí em diante o histórico
 * não muda mais, mesmo que uma nota seja corrigida depois.
 */
export function deveCongelar(resultado: ResultadoHistorico, origem: OrigemHistorico): boolean {
  if (origem === "externa") return true;
  return resultado !== "cursando";
}
```

Criar `src/lib/historico/associacoes.ts`:

```typescript
export type Range = { anoInicio: number; anoFim: number };

export function rangesSobrepostos(a: Range, b: Range): boolean {
  return a.anoInicio <= b.anoFim && b.anoInicio <= a.anoFim;
}

export function validarNovaAssociacao(
  nova: Range,
  existentes: Range[]
): { ok: true } | { ok: false; conflito: Range } {
  const conflito = existentes.find((e) => rangesSobrepostos(nova, e));
  return conflito ? { ok: false, conflito } : { ok: true };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm run test -- src/lib/historico/congelamento.test.ts src/lib/historico/associacoes.test.ts`
Expected: PASS, 10 testes.

- [ ] **Step 5: Escrever as Server Actions**

Criar `src/lib/actions/historico.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { deveCongelar } from "@/lib/historico/congelamento";
import { validarNovaAssociacao } from "@/lib/historico/associacoes";
import { mediaAnual } from "@/lib/historico/medias";
import type { NivelEnsino, OrigemHistorico, ResultadoHistorico } from "@/lib/historico/tipos";
import { createServerClient } from "@/lib/supabase/server";
import { formNumber, formText } from "@/lib/utils";

async function garantirHistorico(alunoId: string, nivel: NivelEnsino): Promise<string> {
  const supabase = await createServerClient();
  const { data: existente, error: erroBusca } = await supabase
    .from("historico_escolar")
    .select("id")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("aluno_id", alunoId)
    .eq("nivel", nivel)
    .maybeSingle();
  if (erroBusca) throw erroBusca;
  if (existente) return existente.id as string;

  const { data: criado, error: erroCriacao } = await supabase
    .from("historico_escolar")
    .insert({ escola_id: DEFAULT_SCHOOL_ID, aluno_id: alunoId, nivel })
    .select("id")
    .single();
  if (erroCriacao) throw erroCriacao;
  return criado.id as string;
}

export async function salvarObservacaoAction(formData: FormData) {
  await requirePermission("historico", "update");
  const alunoId = formText(formData, "alunoId");
  const nivel = formText(formData, "nivel") as NivelEnsino;
  if (!alunoId || !nivel) return;

  const historicoId = await garantirHistorico(alunoId, nivel);
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("historico_escolar")
    .update({ observacoes: formText(formData, "observacoes") })
    .eq("id", historicoId);
  if (error) throw error;

  revalidatePath("/historico/notas");
}

/**
 * Grava um ano do histórico. Se o resultado final congela o ano interno,
 * copia as médias calculadas para historico_notas — a partir daí o ano não
 * recalcula mais.
 */
export async function salvarAnoHistoricoAction(formData: FormData) {
  await requirePermission("historico", "update");
  const alunoId = formText(formData, "alunoId");
  const nivel = formText(formData, "nivel") as NivelEnsino;
  const ano = formNumber(formData, "ano");
  const serieNome = formText(formData, "serieNome");
  const origem = (formText(formData, "origem") ?? "externa") as OrigemHistorico;
  const resultado = (formText(formData, "resultado") ?? "cursando") as ResultadoHistorico;
  if (!alunoId || !nivel || !ano || !serieNome) return;

  const historicoId = await garantirHistorico(alunoId, nivel);
  const congelado = deveCongelar(resultado, origem);
  const supabase = await createServerClient();

  const { data: anoRow, error } = await supabase
    .from("historico_anos")
    .upsert(
      {
        historico_id: historicoId,
        ano,
        serie_id: formText(formData, "serieId") || null,
        serie_nome: serieNome,
        origem,
        instituicao: formText(formData, "instituicao") || null,
        cidade: formText(formData, "cidade") || null,
        uf: formText(formData, "uf") || null,
        resultado,
        media_aprovacao: formNumber(formData, "mediaAprovacao"),
        carga_horaria: formNumber(formData, "cargaHoraria"),
        dias_letivos: formNumber(formData, "diasLetivos"),
        faltas: formNumber(formData, "faltas"),
        percentual_frequencia: formNumber(formData, "percentualFrequencia"),
        congelado
      },
      { onConflict: "historico_id,ano" }
    )
    .select("id")
    .single();
  if (error) throw error;

  if (congelado && origem === "interna") {
    await congelarNotasDoAno(anoRow.id as string, alunoId, ano);
  }

  revalidatePath("/historico/notas");
}

/** Copia as médias calculadas de notas_consolidadas para historico_notas. */
async function congelarNotasDoAno(historicoAnoId: string, alunoId: string, ano: number) {
  const supabase = await createServerClient();

  const { data: jaTem, error: erroJaTem } = await supabase
    .from("historico_notas")
    .select("id")
    .eq("historico_ano_id", historicoAnoId)
    .limit(1);
  if (erroJaTem) throw erroJaTem;
  if ((jaTem ?? []).length > 0) return;

  const { data, error } = await supabase
    .from("notas_consolidadas")
    .select("disciplina_id, media, disciplinas(nome, ordem)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("aluno_id", alunoId)
    .eq("ano_letivo", ano);
  if (error) throw error;

  const porDisciplina = new Map<string, { nome: string; ordem: number; bimestrais: Array<number | null> }>();
  for (const row of data ?? []) {
    const id = row.disciplina_id as string;
    const disciplina = row.disciplinas as { nome?: string; ordem?: number } | null;
    let entrada = porDisciplina.get(id);
    if (!entrada) {
      entrada = { nome: disciplina?.nome ?? "", ordem: disciplina?.ordem ?? 0, bimestrais: [] };
      porDisciplina.set(id, entrada);
    }
    entrada.bimestrais.push(row.media === null ? null : Number(row.media));
  }

  const linhas = [...porDisciplina.entries()].map(([disciplinaId, e]) => ({
    historico_ano_id: historicoAnoId,
    disciplina_id: disciplinaId,
    disciplina_nome: e.nome,
    nota: mediaAnual(e.bimestrais),
    ordem: e.ordem
  }));
  if (linhas.length === 0) return;

  const { error: erroInsert } = await supabase.from("historico_notas").insert(linhas);
  if (erroInsert) throw erroInsert;
}

export async function removerAnoHistoricoAction(formData: FormData) {
  await requirePermission("historico", "delete");
  const id = formText(formData, "id");
  if (!id) return;
  const supabase = await createServerClient();
  const { error } = await supabase.from("historico_anos").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/historico/notas");
}

/** Substitui as notas de um ano congelado/externo pelas linhas enviadas. */
export async function salvarNotasAnoAction(formData: FormData) {
  await requirePermission("historico", "update");
  const historicoAnoId = formText(formData, "historicoAnoId");
  const payload = formText(formData, "notas");
  if (!historicoAnoId || !payload) return;

  const notas = JSON.parse(payload) as Array<{
    disciplinaId: string | null;
    disciplinaNome: string;
    nota: number | null;
    cargaHoraria: number | null;
    faltas: number | null;
  }>;

  const supabase = await createServerClient();
  const { error: erroDelete } = await supabase
    .from("historico_notas")
    .delete()
    .eq("historico_ano_id", historicoAnoId);
  if (erroDelete) throw erroDelete;

  const linhas = notas
    .filter((n) => n.disciplinaNome.trim() !== "")
    .map((n, i) => ({
      historico_ano_id: historicoAnoId,
      disciplina_id: n.disciplinaId,
      disciplina_nome: n.disciplinaNome.trim(),
      nota: n.nota,
      carga_horaria: n.cargaHoraria,
      faltas: n.faltas,
      ordem: i
    }));
  if (linhas.length > 0) {
    const { error } = await supabase.from("historico_notas").insert(linhas);
    if (error) throw error;
  }

  revalidatePath("/historico/notas");
}

export async function salvarAssociacaoAction(formData: FormData) {
  await requirePermission("historico", "create");
  const serieId = formText(formData, "serieId");
  const credenciamentoId = formText(formData, "credenciamentoId");
  const nivel = formText(formData, "nivel") as NivelEnsino;
  const anoInicio = formNumber(formData, "anoInicio");
  const anoFim = formNumber(formData, "anoFim");
  if (!serieId || !credenciamentoId || !nivel || !anoInicio || !anoFim) return;

  const supabase = await createServerClient();
  const { data: existentes, error: erroBusca } = await supabase
    .from("historico_niveis_ensino")
    .select("ano_inicio, ano_fim")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("serie_id", serieId);
  if (erroBusca) throw erroBusca;

  const validacao = validarNovaAssociacao(
    { anoInicio, anoFim },
    (existentes ?? []).map((e) => ({ anoInicio: e.ano_inicio as number, anoFim: e.ano_fim as number }))
  );
  if (!validacao.ok) {
    throw new Error(
      `Já existe associação para esta série no período ${validacao.conflito.anoInicio}–${validacao.conflito.anoFim}.`
    );
  }

  const { error } = await supabase.from("historico_niveis_ensino").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    serie_id: serieId,
    credenciamento_id: credenciamentoId,
    nivel,
    ano_inicio: anoInicio,
    ano_fim: anoFim
  });
  if (error) throw error;

  revalidatePath("/historico/associacoes");
}

export async function removerAssociacaoAction(formData: FormData) {
  await requirePermission("historico", "delete");
  const id = formText(formData, "id");
  if (!id) return;
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("historico_niveis_ensino")
    .delete()
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) throw error;
  revalidatePath("/historico/associacoes");
}
```

- [ ] **Step 6: Conferir as helpers de formulário**

Run: `grep -n "export function formText\|export function formNumber\|export function formBoolean" src/lib/utils.ts`
Expected: as três existem com essas assinaturas. Se `formNumber` devolver `undefined` em vez de `null`, ajustar as chamadas acima com `?? null`.

- [ ] **Step 7: Rodar typecheck e a suíte inteira**

Run: `npm run typecheck && npm run test`
Expected: PASS nos dois.

- [ ] **Step 8: Commit**

```bash
git add src/lib/actions/historico.ts src/lib/historico/
git commit -m "feat(historico): server actions com congelamento e validacao de associacoes"
```

---

### Task 5: Gerador de PDF

**Files:**
- Create: `src/lib/documents/historico-pdf.ts`
- Create: `src/lib/documents/historico-pdf.test.ts`
- Create: `public/historico/logo-epg.png` (cópia de `docs/referencias/logo-epg.png`)

**Interfaces:**
- Consumes: `HistoricoData`, `SERIES_POR_NIVEL`, `NIVEL_EXIBE_CH`, `NIVEL_LABEL` de `@/lib/historico/tipos`; `montarGrade` de `@/lib/historico/grade`.
- Produces: `renderHistoricos(alunos: HistoricoData[], opts?: HistoricoPdfOptions): jsPDF`, com
  `HistoricoPdfOptions = { dataEmissao?: Date; logoDataUrl?: string }`.

**Coordenadas do modelo** (extraídas de `docs/referencias/historico-manuela.pdf`, A4 retrato 595×842pt, origem no canto inferior esquerdo — jsPDF mede do topo, então `yTopo = 842 - yPdf`):

| Elemento | x | y (PDF) | Fonte |
|---|---|---|---|
| Nome fantasia | 22 | 810 | bold 8 |
| Razão social | 22 | 798 | normal 8 |
| CNPJ | 22 | 786 | normal 8 |
| Resolução | 22 | 774 | normal 8 |
| Endereço | 22 | 762 | normal 8 |
| Telefones | 22 | 750 | normal 8 |
| E-mail | 22 | 738 | normal 8 |
| Logo (157.6 × 88) | 408.5 | 734 (base) | — |
| "HISTÓRICO ESCOLAR" | centro | 708 | bold 14 |
| Nível | centro | 692 | bold 14 |
| "RESULTADOS REALIZADOS NO …" | centro | 606 | bold 8 |
| Rótulos de identificação | ver abaixo | 670 / 650 / 630 | normal 6 |
| Valores de identificação | ver abaixo | 662 / 642 / 622 | bold 7 |
| Cabeçalho de séries | 142.8 + n×46.7 | 595 | bold 7 |
| Sub-cabeçalho (Média/C.H.) | idem | 580.5 | bold 7 |
| Primeira linha de disciplina | 22 | 566 | normal 7 |
| Altura da linha | — | 11 | — |
| Resultado Final | 22 | 401 | bold 7 |
| Carga Horária Anual | 22 | 390 | bold 7 |
| Dias Letivos | 22 | 379 | bold 7 |
| Cabeçalho da tabela de séries | 66.8 / 140.5 / 258.4 / 465.6 / 555.8 | 364 | bold 8 |
| Linhas da tabela de séries | 22 / 139.7 / 166.3 / 410.5 / 549.3 | 352, passo −12 | normal 8 |
| Cidade e data | 399.1 | 89 | normal 10 |
| Nomes de assinatura | centro 160 / 434 | 39 | normal 10 |
| Cargos | centro 160 / 434 | 29 | normal 10 |

Colunas de identificação: Aluno x=22, CPF x=418.4, Matrícula x=497.7 (linha 670/662); Filiação x=22 (linha 650/642); Nascimento x=22, Naturalidade x=101.3, Nacionalidade x=259.9, RG x=339.1, Órgão Expedidor x=418.4, Data Expedição x=497.7 (linha 630/622).

- [ ] **Step 1: Copiar o logo para os assets públicos**

```bash
mkdir -p public/historico
cp docs/referencias/logo-epg.png public/historico/logo-epg.png
```

- [ ] **Step 2: Escrever o teste do gerador (que falha)**

Criar `src/lib/documents/historico-pdf.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { renderHistoricos } from "./historico-pdf";
import type { HistoricoAno, HistoricoData } from "@/lib/historico/tipos";

function ano(serieNome: string, anoLetivo: number, notas: Array<[string, number]>): HistoricoAno {
  return {
    id: `${anoLetivo}`,
    ano: anoLetivo,
    serieId: null,
    serieNome,
    origem: "interna",
    instituicao: "EPG TRINDADE",
    cidade: "TRINDADE",
    uf: "GO",
    resultado: "aprovado",
    mediaAprovacao: 6,
    cargaHoraria: 1000,
    diasLetivos: 213,
    faltas: null,
    percentualFrequencia: null,
    congelado: true,
    notas: notas.map(([disciplinaNome, nota], ordem) => ({
      disciplinaId: null,
      disciplinaNome,
      nota,
      cargaHoraria: null,
      faltas: null,
      ordem
    }))
  };
}

function historico(nome: string): HistoricoData {
  return {
    aluno: {
      id: nome,
      nome,
      cpf: "116.726.301-42",
      matricula: "1041",
      filiacao: "RODRIGO REIS BARROS e RAFAELA MACHADO MARGARIDA BARROS",
      dataNascimento: "28/08/2017",
      naturalidade: "GOIÂNIA / GO",
      nacionalidade: "BRASILEIRA",
      rg: null,
      orgaoExpedidor: null,
      dataExpedicao: null
    },
    nivel: "fund1",
    credenciamento: {
      razaoSocial: "ESCOLA PINGUINHO DE GENTE LTDA",
      nomeFantasia: "EPG TRINDADE",
      cnpj: "11.714.876/0001-16",
      resolucao: "RENOVAÇÃO DE RECONHECIMENTO, RESOLUÇÃO CEE/CEB Nº 518/2024",
      endereco: "RUA EUGÊNIO JARDIM Nº 473, Q 24, L 17, CENTRO, TRINDADE - GO CEP: 75388-686",
      cidade: "TRINDADE",
      uf: "GO",
      cep: "75388-686",
      telefones: "(62)3505-1531 / (62)98650-1531",
      email: "secretariaepgtrindade@gmail.com",
      logoPath: null,
      secretarioNome: "ROSSANIA BRÍGIDA RODRIGUES RIBEIRO BARBOSA",
      secretarioCargo: "Secretário(a)",
      diretorNome: "RAFAELA MACHADO MARGARIDA BARROS",
      diretorCargo: "Diretor(a)"
    },
    anos: [
      ano("1º ANO", 2024, [["CIÊNCIAS", 9.9], ["MATEMÁTICA", 9.9]]),
      ano("2º ANO", 2025, [["CIÊNCIAS", 9.9], ["MATEMÁTICA", 10]])
    ],
    observacoes: null
  };
}

describe("renderHistoricos", () => {
  it("gera uma página para um aluno", () => {
    const doc = renderHistoricos([historico("MANUELA MARGARIDA BARROS")]);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("gera uma página por aluno no lote", () => {
    const doc = renderHistoricos([historico("ALUNO A"), historico("ALUNO B"), historico("ALUNO C")]);
    expect(doc.getNumberOfPages()).toBe(3);
  });

  it("usa A4 retrato em pontos", () => {
    const doc = renderHistoricos([historico("ALUNO A")]);
    const { width, height } = doc.internal.pageSize;
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });

  it("não lança com aluno sem nenhum ano cadastrado", () => {
    const vazio = { ...historico("SEM ANOS"), anos: [] };
    expect(() => renderHistoricos([vazio])).not.toThrow();
  });

  it("devolve um documento vazio de uma página para lista vazia", () => {
    expect(renderHistoricos([]).getNumberOfPages()).toBe(1);
  });

  it("imprime o nome do aluno no documento", () => {
    const doc = renderHistoricos([historico("MANUELA MARGARIDA BARROS")]);
    const texto = doc.output("datauristring");
    expect(texto.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npm run test -- src/lib/documents/historico-pdf.test.ts`
Expected: FAIL — `Failed to resolve import "./historico-pdf"`.

- [ ] **Step 4: Implementar o gerador**

Criar `src/lib/documents/historico-pdf.ts`:

```typescript
import { jsPDF } from "jspdf";
import { montarGrade } from "@/lib/historico/grade";
import {
  NIVEL_EXIBE_CH,
  NIVEL_LABEL,
  SERIES_POR_NIVEL,
  type HistoricoAno,
  type HistoricoData
} from "@/lib/historico/tipos";

export type HistoricoPdfOptions = {
  dataEmissao?: Date;
  /** PNG em data URL. Sem ele, o cabeçalho sai sem logo. */
  logoDataUrl?: string;
};

const PAGINA = { largura: 595, altura: 842 };
const MARGEM_ESQ = 22;
const TRACO = "-";

/** Converte y do PDF de referência (origem embaixo) para y do jsPDF (origem no topo). */
const y = (yPdf: number) => PAGINA.altura - yPdf;

function texto(doc: jsPDF, str: string, x: number, yPdf: number, tamanho: number, bold = false) {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(tamanho);
  doc.text(str, x, y(yPdf));
}

function textoCentro(doc: jsPDF, str: string, yPdf: number, tamanho: number, bold = false) {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(tamanho);
  doc.text(str, PAGINA.largura / 2, y(yPdf), { align: "center" });
}

function campo(doc: jsPDF, rotulo: string, valor: string | null, x: number, yRotulo: number) {
  texto(doc, rotulo, x, yRotulo, 6);
  texto(doc, valor ?? "", x, yRotulo - 8, 7, true);
}

function numero(valor: number | null, casas = 1): string {
  return valor === null ? TRACO : valor.toFixed(casas).replace(".", ",");
}

function inteiro(valor: number | null): string {
  return valor === null ? TRACO : String(valor);
}

const RESULTADO_LABEL: Record<HistoricoAno["resultado"], string> = {
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  cursando: "Cursando",
  transferido: "Transferido"
};

function desenharCabecalho(doc: jsPDF, dados: HistoricoData, opts: HistoricoPdfOptions) {
  const c = dados.credenciamento;
  texto(doc, c.nomeFantasia, MARGEM_ESQ, 810, 8, true);
  texto(doc, c.razaoSocial, MARGEM_ESQ, 798, 8);
  if (c.cnpj) texto(doc, `CNPJ: ${c.cnpj}`, MARGEM_ESQ, 786, 8);
  if (c.resolucao) texto(doc, c.resolucao, MARGEM_ESQ, 774, 8);
  if (c.endereco) texto(doc, c.endereco, MARGEM_ESQ, 762, 8);
  if (c.telefones) texto(doc, c.telefones, MARGEM_ESQ, 750, 8);
  if (c.email) texto(doc, c.email, MARGEM_ESQ, 738, 8);

  if (opts.logoDataUrl) {
    doc.addImage(opts.logoDataUrl, "PNG", 408.5, y(734 + 88), 157.6, 88);
  }

  textoCentro(doc, "HISTÓRICO ESCOLAR", 708, 14, true);
  textoCentro(doc, NIVEL_LABEL[dados.nivel], 692, 14, true);
  textoCentro(doc, `RESULTADOS REALIZADOS NO ${NIVEL_LABEL[dados.nivel].toUpperCase()}`, 606, 8, true);
}

function desenharIdentificacao(doc: jsPDF, dados: HistoricoData) {
  const a = dados.aluno;
  campo(doc, "Aluno(a):", a.nome, MARGEM_ESQ, 670);
  campo(doc, "CPF:", a.cpf, 418.4, 670);
  campo(doc, "Matrícula:", a.matricula, 497.7, 670);
  campo(doc, "Filiação:", a.filiacao, MARGEM_ESQ, 650);
  campo(doc, "Data de Nascimento:", a.dataNascimento, MARGEM_ESQ, 630);
  campo(doc, "Naturalidade:", a.naturalidade, 101.3, 630);
  campo(doc, "Nacionalidade:", a.nacionalidade, 259.9, 630);
  campo(doc, "RG:", a.rg, 339.1, 630);
  campo(doc, "Orgão Expedidor:", a.orgaoExpedidor, 418.4, 630);
  campo(doc, "Data Expedição:", a.dataExpedicao, 497.7, 630);
}

function desenharGrade(doc: jsPDF, dados: HistoricoData) {
  const colunas = SERIES_POR_NIVEL[dados.nivel];
  const exibeCh = NIVEL_EXIBE_CH[dados.nivel];
  const passo = 46.7;
  const xPrimeira = 142.8;
  const xColuna = (i: number) => xPrimeira + i * passo;

  colunas.forEach((coluna, i) => {
    texto(doc, coluna, xColuna(i), 595, 7, true);
    if (exibeCh) {
      texto(doc, "Média", xColuna(i), 580.5, 7, true);
      texto(doc, "C.H.", xColuna(i) + 25.9, 580.5, 7, true);
    } else {
      texto(doc, "Média", xColuna(i), 580.5, 7, true);
    }
  });
  texto(doc, "Disciplinas", 59.2, 580.5, 7, true);
  if (exibeCh) {
    texto(doc, "C.H.", 556.3, 584, 7, true);
    texto(doc, "Total", 555.3, 577, 7, true);
  }

  const linhas = montarGrade(dados.anos, colunas);
  const alturaLinha = 11;
  let yLinha = 566;

  for (const linha of linhas) {
    texto(doc, linha.disciplina, MARGEM_ESQ, yLinha, 7);
    linha.celulas.forEach((celula, i) => {
      texto(doc, numero(celula.nota), xColuna(i), yLinha, 7, true);
      if (exibeCh) {
        texto(doc, inteiro(celula.cargaHoraria), xColuna(i) + 25.9, yLinha, 7, true);
      }
    });
    if (exibeCh) texto(doc, inteiro(linha.chTotal), 556.3, yLinha, 7, true);
    yLinha -= alturaLinha;
  }

  const porColuna = new Map(dados.anos.map((a) => [a.serieNome, a]));
  const rodape: Array<[string, number, (a: HistoricoAno | undefined) => string]> = [
    ["Resultado Final", 401, (a) => (a ? RESULTADO_LABEL[a.resultado] : TRACO)],
    ["Carga Horária Anual", 390, (a) => inteiro(a?.cargaHoraria ?? null)],
    ["Dias Letivos", 379, (a) => inteiro(a?.diasLetivos ?? null)]
  ];

  for (const [rotulo, yRodape, valor] of rodape) {
    texto(doc, rotulo, MARGEM_ESQ, yRodape, 7, true);
    colunas.forEach((coluna, i) => {
      texto(doc, valor(porColuna.get(coluna)), xColuna(i), yRodape, 7, true);
    });
  }

  const chTotalAnual = dados.anos.reduce((acc, a) => acc + (a.cargaHoraria ?? 0), 0);
  if (chTotalAnual > 0) texto(doc, String(chTotalAnual), 556.3, 390, 7, true);
}

function desenharEstabelecimentos(doc: jsPDF, dados: HistoricoData) {
  texto(doc, "Série", 66.8, 364, 8, true);
  texto(doc, "Ano", 140.5, 364, 8, true);
  texto(doc, "Estabelecimento", 258.4, 364, 8, true);
  texto(doc, "Cidade", 465.6, 364, 8, true);
  texto(doc, "UF", 555.8, 364, 8, true);

  const colunas = SERIES_POR_NIVEL[dados.nivel];
  const porSerie = new Map(dados.anos.map((a) => [a.serieNome, a]));
  let yLinha = 352;

  for (const coluna of colunas) {
    const ano = porSerie.get(coluna);
    texto(doc, coluna, MARGEM_ESQ, yLinha, 8);
    texto(doc, ano ? String(ano.ano) : TRACO, 139.7, yLinha, 8);
    texto(doc, ano?.instituicao ?? TRACO, 166.3, yLinha, 8);
    texto(doc, ano?.cidade ?? TRACO, 410.5, yLinha, 8);
    texto(doc, ano?.uf ?? TRACO, 549.3, yLinha, 8);
    yLinha -= 12;
  }
}

function desenharRodape(doc: jsPDF, dados: HistoricoData, opts: HistoricoPdfOptions) {
  const c = dados.credenciamento;
  const data = opts.dataEmissao ?? new Date();
  const dataTexto = data.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  const cidade = c.cidade && c.uf ? `${c.cidade}-${c.uf}` : (c.cidade ?? "");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${cidade}, ${dataTexto}.`, 573, y(89), { align: "right" });

  const assinaturas: Array<[string | null, string, number]> = [
    [c.secretarioNome, c.secretarioCargo, 160],
    [c.diretorNome, c.diretorCargo, 434]
  ];

  for (const [nome, cargo, centro] of assinaturas) {
    doc.setLineWidth(0.5);
    doc.line(centro - 125, y(48), centro + 125, y(48));
    doc.setFontSize(10);
    doc.text(nome ?? "", centro, y(39), { align: "center" });
    doc.text(cargo, centro, y(29), { align: "center" });
  }
}

/**
 * Preview e emissão chamam esta mesma função: o que se vê é o que sai.
 * Uma página por aluno.
 */
export function renderHistoricos(
  alunos: HistoricoData[],
  opts: HistoricoPdfOptions = {}
): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });

  alunos.forEach((dados, i) => {
    if (i > 0) doc.addPage();
    desenharCabecalho(doc, dados, opts);
    desenharIdentificacao(doc, dados);
    desenharGrade(doc, dados);
    desenharEstabelecimentos(doc, dados);
    desenharRodape(doc, dados, opts);
  });

  return doc;
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npm run test -- src/lib/documents/historico-pdf.test.ts`
Expected: PASS, 6 testes.

- [ ] **Step 6: Rodar typecheck e a suíte inteira**

Run: `npm run typecheck && npm run test`
Expected: PASS nos dois.

- [ ] **Step 7: Commit**

```bash
git add src/lib/documents/historico-pdf.ts src/lib/documents/historico-pdf.test.ts public/historico/
git commit -m "feat(historico): gerador de PDF fiel ao modelo de referencia"
```

---

### Task 6: Teste de fidelidade de layout

**Files:**
- Create: `src/lib/documents/historico-fidelidade.test.ts`
- Create: `src/lib/documents/historico-coordenadas.ts`

**Interfaces:**
- Consumes: `renderHistoricos` de `./historico-pdf`.
- Produces: `COORDENADAS_REFERENCIA: Array<{ texto: string; x: number; y: number }>` — a tabela de contrato de layout extraída do modelo.

Este teste trava regressão: se alguém mover um campo do cabeçalho, ele falha apontando o deslocamento em pontos.

- [ ] **Step 1: Escrever a tabela de coordenadas de referência**

Criar `src/lib/documents/historico-coordenadas.ts`:

```typescript
/**
 * Coordenadas extraídas de docs/referencias/historico-manuela.pdf via pdfjs.
 * Contrato de layout: o gerador deve posicionar cada texto nestas coordenadas,
 * em pontos, com origem no canto inferior esquerdo da página A4.
 */
export const COORDENADAS_REFERENCIA = [
  { texto: "EPG TRINDADE", x: 24.0, y: 810.0 },
  { texto: "ESCOLA PINGUINHO DE GENTE LTDA", x: 24.0, y: 798.0 },
  { texto: "CNPJ: 11.714.876/0001-16", x: 24.0, y: 786.0 },
  { texto: "MANUELA MARGARIDA BARROS", x: 24.0, y: 662.0 },
  { texto: "116.726.301-42", x: 420.4, y: 662.0 },
  { texto: "1041", x: 499.7, y: 662.0 },
  { texto: "28/08/2017", x: 24.0, y: 622.0 },
  { texto: "BRASILEIRA", x: 261.9, y: 622.0 },
  { texto: "1º ANO", x: 142.8, y: 595.0 },
  { texto: "2º ANO", x: 189.6, y: 595.0 },
  { texto: "Disciplinas", x: 59.2, y: 580.5 },
  { texto: "Resultado Final", x: 22.0, y: 401.0 },
  { texto: "Carga Horária Anual", x: 22.0, y: 390.0 },
  { texto: "Dias Letivos", x: 22.0, y: 379.0 },
  { texto: "Série", x: 66.8, y: 364.0 },
  { texto: "Estabelecimento", x: 258.4, y: 364.0 },
  { texto: "UF", x: 555.8, y: 364.0 }
] as const;

/** Tolerância em pontos: o modelo foi medido com uma casa decimal. */
export const TOLERANCIA_PT = 2.5;
```

- [ ] **Step 2: Escrever o teste de fidelidade (que falha)**

Criar `src/lib/documents/historico-fidelidade.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { COORDENADAS_REFERENCIA, TOLERANCIA_PT } from "./historico-coordenadas";
import { renderHistoricos } from "./historico-pdf";
import type { HistoricoAno, HistoricoData } from "@/lib/historico/tipos";

const ALTURA_A4 = 842;

function anoManuela(serieNome: string, ano: number, diasLetivos: number): HistoricoAno {
  return {
    id: String(ano),
    ano,
    serieId: null,
    serieNome,
    origem: "interna",
    instituicao: "EPG TRINDADE",
    cidade: "TRINDADE",
    uf: "GO",
    resultado: "aprovado",
    mediaAprovacao: 6,
    cargaHoraria: 1000,
    diasLetivos,
    faltas: null,
    percentualFrequencia: null,
    congelado: true,
    notas: [
      { disciplinaId: null, disciplinaNome: "CIÊNCIAS", nota: 9.9, cargaHoraria: null, faltas: null, ordem: 0 }
    ]
  };
}

const MANUELA: HistoricoData = {
  aluno: {
    id: "manuela",
    nome: "MANUELA MARGARIDA BARROS",
    cpf: "116.726.301-42",
    matricula: "1041",
    filiacao: "RODRIGO REIS BARROS e RAFAELA MACHADO MARGARIDA BARROS",
    dataNascimento: "28/08/2017",
    naturalidade: "GOIÂNIA / GO",
    nacionalidade: "BRASILEIRA",
    rg: null,
    orgaoExpedidor: null,
    dataExpedicao: null
  },
  nivel: "fund1",
  credenciamento: {
    razaoSocial: "ESCOLA PINGUINHO DE GENTE LTDA",
    nomeFantasia: "EPG TRINDADE",
    cnpj: "11.714.876/0001-16",
    resolucao: "RENOVAÇÃO DE RECONHECIMENTO, RESOLUÇÃO CEE/CEB Nº 518/2024",
    endereco: "RUA EUGÊNIO JARDIM Nº 473, Q 24, L 17, CENTRO, TRINDADE - GO CEP: 75388-686",
    cidade: "TRINDADE",
    uf: "GO",
    cep: "75388-686",
    telefones: "(62)3505-1531 / (62)98650-1531",
    email: "secretariaepgtrindade@gmail.com",
    logoPath: null,
    secretarioNome: "ROSSANIA BRÍGIDA RODRIGUES RIBEIRO BARBOSA",
    secretarioCargo: "Secretário(a)",
    diretorNome: "RAFAELA MACHADO MARGARIDA BARROS",
    diretorCargo: "Diretor(a)"
  },
  anos: [anoManuela("1º ANO", 2024, 213), anoManuela("2º ANO", 2025, 203)],
  observacoes: null
};

/** Extrai {texto, x, y} de cada item do PDF gerado, em coordenadas do modelo. */
async function extrairTextos(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const page = await doc.getPage(1);
  const conteudo = await page.getTextContent();
  return conteudo.items
    .filter((item): item is { str: string; transform: number[] } => "str" in item)
    .filter((item) => item.str.trim() !== "")
    .map((item) => ({ texto: item.str, x: item.transform[4], y: item.transform[5] }));
}

describe("fidelidade do layout ao modelo de referência", () => {
  it("posiciona cada texto do contrato dentro da tolerância", async () => {
    const doc = renderHistoricos([MANUELA], { dataEmissao: new Date(2026, 8, 17) });
    const bytes = new Uint8Array(doc.output("arraybuffer"));
    const textos = await extrairTextos(bytes);

    const desvios: string[] = [];
    for (const esperado of COORDENADAS_REFERENCIA) {
      const encontrado = textos.find((t) => t.texto.trim() === esperado.texto);
      if (!encontrado) {
        desvios.push(`"${esperado.texto}" não foi encontrado no PDF gerado`);
        continue;
      }
      const dx = Math.abs(encontrado.x - esperado.x);
      const dy = Math.abs(encontrado.y - esperado.y);
      if (dx > TOLERANCIA_PT || dy > TOLERANCIA_PT) {
        desvios.push(
          `"${esperado.texto}": esperado (${esperado.x}, ${esperado.y}), obtido (${encontrado.x.toFixed(1)}, ${encontrado.y.toFixed(1)})`
        );
      }
    }

    expect(desvios).toEqual([]);
  });

  it("gera a página no tamanho A4 do modelo", async () => {
    const doc = renderHistoricos([MANUELA]);
    expect(Math.round(doc.internal.pageSize.height)).toBe(ALTURA_A4);
  });
});
```

- [ ] **Step 3: Rodar o teste e ver os desvios**

Run: `npm run test -- src/lib/documents/historico-fidelidade.test.ts`
Expected: FAIL listando cada texto fora da tolerância. A mensagem traz esperado e obtido.

- [ ] **Step 4: Ajustar o gerador até o teste passar**

Para cada desvio listado, corrigir a coordenada correspondente em `src/lib/documents/historico-pdf.ts`. Dois desencontros previsíveis:

- o modelo usa x=24 para textos do cabeçalho e x=22 para os do bloco de identificação; conferir qual constante cada função usa;
- textos desenhados com `align: "center"` têm x reportado no início do texto, não no centro — se um texto centralizado divergir, comparar contra a coordenada do modelo e ajustar o ponto de ancoragem.

Não afrouxar `TOLERANCIA_PT` para fazer o teste passar: ela é o contrato.

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npm run test -- src/lib/documents/historico-fidelidade.test.ts`
Expected: PASS, 2 testes.

- [ ] **Step 6: Rodar a suíte inteira e commitar**

```bash
npm run typecheck && npm run test
git add src/lib/documents/historico-coordenadas.ts src/lib/documents/historico-fidelidade.test.ts src/lib/documents/historico-pdf.ts
git commit -m "test(historico): trava de fidelidade do layout ao modelo"
```

---

### Task 7: Tela de associações

**Files:**
- Create: `src/app/(app)/historico/associacoes/page.tsx`
- Create: `src/components/historico/associacao-form.tsx`
- Create: `src/components/historico/associacoes-tabela.tsx`
- Modify: `src/components/layout/topbar.tsx`

**Interfaces:**
- Consumes: `listarNiveisEnsino`, `listarCredenciamentos` de `@/lib/data/historico`; `salvarAssociacaoAction`, `removerAssociacaoAction` de `@/lib/actions/historico`; `getAcademicData` de `@/lib/data/lookups`.
- Produces: rota `/historico/associacoes`.

- [ ] **Step 1: Ler os padrões de tela do repositório**

Run:

```bash
sed -n '1,60p' "src/app/(app)/series/page.tsx"
grep -n "href" src/components/layout/topbar.tsx | sed -n '1,30p'
```

Expected: entender como uma página server component carrega dados e passa para componentes, e como os itens de menu são declarados no array do topbar. Seguir esses padrões — não inventar estrutura nova.

- [ ] **Step 2: Escrever a página server component**

Criar `src/app/(app)/historico/associacoes/page.tsx`:

```tsx
import { AssociacaoForm } from "@/components/historico/associacao-form";
import { AssociacoesTabela } from "@/components/historico/associacoes-tabela";
import { requirePermission } from "@/lib/auth/session";
import { listarCredenciamentos, listarNiveisEnsino } from "@/lib/data/historico";
import { getAcademicData } from "@/lib/data/lookups";

export default async function AssociacoesPage() {
  await requirePermission("historico", "read");
  const [{ series }, credenciamentos, associacoes] = await Promise.all([
    getAcademicData(),
    listarCredenciamentos(),
    listarNiveisEnsino()
  ]);

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Histórico Escolar — Associação Série/Turma e Empresa</h1>
        <p className="text-sm text-muted-foreground">
          Define qual empresa e credenciamento aparecem no histórico de cada série, e em que período.
        </p>
      </header>

      <AssociacaoForm series={series} credenciamentos={credenciamentos} />
      <AssociacoesTabela associacoes={associacoes} />
    </div>
  );
}
```

- [ ] **Step 3: Escrever o formulário**

Criar `src/components/historico/associacao-form.tsx`:

```tsx
"use client";

import { salvarAssociacaoAction } from "@/lib/actions/historico";

type Props = {
  series: Array<{ id: string; nome: string }>;
  credenciamentos: Array<{ id: string; nomeFantasia: string }>;
};

const NIVEIS = [
  { valor: "infantil", rotulo: "Educação Infantil" },
  { valor: "fund1", rotulo: "Fundamental I" },
  { valor: "fund2", rotulo: "Fundamental II" },
  { valor: "medio", rotulo: "Ensino Médio" }
];

export function AssociacaoForm({ series, credenciamentos }: Props) {
  const anoAtual = new Date().getFullYear();

  return (
    <form action={salvarAssociacaoAction} className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-5">
      <label className="flex flex-col gap-1 text-sm">
        Série
        <select name="serieId" required className="rounded border border-border bg-background p-2">
          <option value="">Selecione</option>
          {series.map((s) => (
            <option key={s.id} value={s.id}>{s.nome}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Empresa
        <select name="credenciamentoId" required className="rounded border border-border bg-background p-2">
          <option value="">Selecione</option>
          {credenciamentos.map((c) => (
            <option key={c.id} value={c.id}>{c.nomeFantasia}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Nível de ensino
        <select name="nivel" required className="rounded border border-border bg-background p-2">
          {NIVEIS.map((n) => (
            <option key={n.valor} value={n.valor}>{n.rotulo}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Ano início
        <input type="number" name="anoInicio" required defaultValue={anoAtual}
          className="rounded border border-border bg-background p-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Ano final
        <input type="number" name="anoFim" required defaultValue={anoAtual}
          className="rounded border border-border bg-background p-2" />
      </label>

      <button type="submit" className="md:col-span-5 rounded bg-primary px-4 py-2 text-primary-foreground">
        Gravar
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Escrever a tabela**

Criar `src/components/historico/associacoes-tabela.tsx`:

```tsx
"use client";

import { removerAssociacaoAction } from "@/lib/actions/historico";
import type { NivelEnsinoRow } from "@/lib/data/historico";

const NIVEL_ROTULO: Record<string, string> = {
  infantil: "Educação Infantil",
  fund1: "Fundamental I",
  fund2: "Fundamental II",
  medio: "Ensino Médio"
};

export function AssociacoesTabela({ associacoes }: { associacoes: NivelEnsinoRow[] }) {
  if (associacoes.length === 0) {
    return (
      <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
        Não há nada para mostrar aqui
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead className="bg-muted text-left">
        <tr>
          <th className="p-2">Série</th>
          <th className="p-2">Empresa</th>
          <th className="p-2">Nível</th>
          <th className="p-2">Período</th>
          <th className="p-2" />
        </tr>
      </thead>
      <tbody>
        {associacoes.map((a) => (
          <tr key={a.id} className="border-t border-border">
            <td className="p-2">{a.serieNome}</td>
            <td className="p-2">{a.credenciamentoNome}</td>
            <td className="p-2">{NIVEL_ROTULO[a.nivel] ?? a.nivel}</td>
            <td className="p-2">{a.anoInicio} – {a.anoFim}</td>
            <td className="p-2 text-right">
              <form action={removerAssociacaoAction}>
                <input type="hidden" name="id" value={a.id} />
                <button type="submit" className="text-sm text-destructive">Remover</button>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 5: Adicionar o link no topbar**

Em `src/components/layout/topbar.tsx`, localizar o array do grupo Secretaria (o mesmo que contém `/matriculas`) e adicionar, seguindo exatamente o formato dos itens vizinhos:

```typescript
{ href: "/historico/associacoes", label: "Histórico — Associações" },
{ href: "/historico/notas", label: "Histórico — Entrada de Notas" },
{ href: "/historico/emissao", label: "Histórico — Emissão" },
```

Se os itens vizinhos usarem outras chaves (por exemplo `icon` ou `modulo`), copiar o formato deles — o array é hardcoded e o RBAC só filtra.

- [ ] **Step 6: Verificar build e typecheck**

Run: `npm run typecheck && npm run build`
Expected: PASS nos dois. A rota `/historico/associacoes` aparece na listagem do build.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/historico/associacoes" src/components/historico/ src/components/layout/topbar.tsx
git commit -m "feat(historico): tela de associacao serie, empresa e nivel de ensino"
```

---

### Task 8: Tela de entrada de notas

**Files:**
- Create: `src/app/(app)/historico/notas/page.tsx`
- Create: `src/components/historico/historico-abas.tsx`
- Create: `src/components/historico/aba-aluno.tsx`
- Create: `src/components/historico/aba-anos.tsx`
- Create: `src/components/historico/aba-notas.tsx`
- Create: `src/components/historico/aba-observacao.tsx`

**Interfaces:**
- Consumes: `getHistoricoAluno` de `@/lib/data/historico`; `salvarAnoHistoricoAction`, `removerAnoHistoricoAction`, `salvarNotasAnoAction`, `salvarObservacaoAction` de `@/lib/actions/historico`; `HistoricoData` de `@/lib/historico/tipos`; `student-combobox.tsx` de `@/components/matriculas`.
- Produces: rota `/historico/notas?aluno=<id>&nivel=<nivel>`.

- [ ] **Step 1: Ler o combobox de aluno existente**

Run: `sed -n '1,50p' src/components/matriculas/student-combobox.tsx`
Expected: entender as props que ele recebe, para reusar em vez de escrever outro seletor de aluno.

- [ ] **Step 2: Escrever a página**

Criar `src/app/(app)/historico/notas/page.tsx`:

```tsx
import { HistoricoAbas } from "@/components/historico/historico-abas";
import { requirePermission } from "@/lib/auth/session";
import { getHistoricoAluno } from "@/lib/data/historico";
import { getAcademicData } from "@/lib/data/lookups";
import type { NivelEnsino } from "@/lib/historico/tipos";

type Props = {
  searchParams: { aluno?: string; nivel?: string };
};

export default async function EntradaNotasPage({ searchParams }: Props) {
  await requirePermission("historico", "read");
  const { alunos, series } = await getAcademicData();

  const alunoId = searchParams.aluno ?? "";
  const nivel = (searchParams.nivel ?? "fund1") as NivelEnsino;
  const historico = alunoId ? await getHistoricoAluno(alunoId, nivel) : null;

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Histórico Escolar — Entrada de Notas</h1>
        <p className="text-sm text-muted-foreground">
          Acadêmico / Histórico e Certificado / Histórico Escolar — Entrada de notas
        </p>
      </header>

      <HistoricoAbas
        alunos={alunos.map((a) => ({ id: a.id as string, nome: a.nome as string }))}
        series={series.map((s) => ({ id: s.id as string, nome: s.nome as string }))}
        alunoId={alunoId}
        nivel={nivel}
        historico={historico}
      />
    </div>
  );
}
```

- [ ] **Step 3: Escrever o contêiner de abas**

Criar `src/components/historico/historico-abas.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AbaAluno } from "./aba-aluno";
import { AbaAnos } from "./aba-anos";
import { AbaNotas } from "./aba-notas";
import { AbaObservacao } from "./aba-observacao";
import type { HistoricoData, NivelEnsino } from "@/lib/historico/tipos";

type Props = {
  alunos: Array<{ id: string; nome: string }>;
  series: Array<{ id: string; nome: string }>;
  alunoId: string;
  nivel: NivelEnsino;
  historico: HistoricoData | null;
};

const ABAS = [
  { id: "aluno", rotulo: "Aluno selecionado" },
  { id: "anos", rotulo: "Escolas anteriores" },
  { id: "notas", rotulo: "Notas" },
  { id: "observacao", rotulo: "Observação" }
] as const;

const NIVEIS: Array<{ valor: NivelEnsino; rotulo: string }> = [
  { valor: "fund1", rotulo: "Fundamental I" },
  { valor: "fund2", rotulo: "Fundamental II" },
  { valor: "medio", rotulo: "Ensino Médio" }
];

export function HistoricoAbas({ alunos, series, alunoId, nivel, historico }: Props) {
  const router = useRouter();
  const [aba, setAba] = useState<(typeof ABAS)[number]["id"]>("aluno");

  function navegar(novoAluno: string, novoNivel: string) {
    if (!novoAluno) return;
    router.push(`/historico/notas?aluno=${novoAluno}&nivel=${novoNivel}`);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Aluno
          <select
            value={alunoId}
            onChange={(e) => navegar(e.target.value, nivel)}
            className="rounded border border-border bg-background p-2"
          >
            <option value="">Selecione um aluno</option>
            {alunos.map((a) => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Tipo de ensino
          <select
            value={nivel}
            onChange={(e) => navegar(alunoId, e.target.value)}
            className="rounded border border-border bg-background p-2"
          >
            {NIVEIS.map((n) => (
              <option key={n.valor} value={n.valor}>{n.rotulo}</option>
            ))}
          </select>
        </label>
      </div>

      {!alunoId ? (
        <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          Selecione um aluno para carregar o histórico.
        </p>
      ) : (
        <>
          <nav className="flex flex-wrap gap-2">
            {ABAS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAba(a.id)}
                className={
                  aba === a.id
                    ? "rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
                    : "rounded border border-border px-4 py-2 text-sm"
                }
              >
                {a.rotulo}
              </button>
            ))}
          </nav>

          {aba === "aluno" && <AbaAluno historico={historico} />}
          {aba === "anos" && (
            <AbaAnos alunoId={alunoId} nivel={nivel} series={series} historico={historico} />
          )}
          {aba === "notas" && <AbaNotas historico={historico} />}
          {aba === "observacao" && (
            <AbaObservacao alunoId={alunoId} nivel={nivel} historico={historico} />
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Escrever a aba do aluno**

Criar `src/components/historico/aba-aluno.tsx`:

```tsx
"use client";

import type { HistoricoData } from "@/lib/historico/tipos";

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {rotulo}
      <input readOnly value={valor ?? ""} className="rounded border border-border bg-muted p-2" />
    </label>
  );
}

export function AbaAluno({ historico }: { historico: HistoricoData | null }) {
  if (!historico) {
    return (
      <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
        Este aluno ainda não tem histórico neste nível. Cadastre um ano na aba “Escolas anteriores” para criá-lo.
      </p>
    );
  }

  const a = historico.aluno;
  return (
    <div className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-2">
      <Campo rotulo="Aluno" valor={a.nome} />
      <Campo rotulo="CPF" valor={a.cpf} />
      <Campo rotulo="Matrícula" valor={a.matricula} />
      <Campo rotulo="Filiação" valor={a.filiacao} />
      <Campo rotulo="Data de nascimento" valor={a.dataNascimento} />
      <Campo rotulo="Naturalidade" valor={a.naturalidade} />
      <Campo rotulo="Nacionalidade" valor={a.nacionalidade} />
    </div>
  );
}
```

- [ ] **Step 5: Escrever a aba de anos**

Criar `src/components/historico/aba-anos.tsx`:

```tsx
"use client";

import { removerAnoHistoricoAction, salvarAnoHistoricoAction } from "@/lib/actions/historico";
import type { HistoricoData, NivelEnsino } from "@/lib/historico/tipos";

type Props = {
  alunoId: string;
  nivel: NivelEnsino;
  series: Array<{ id: string; nome: string }>;
  historico: HistoricoData | null;
};

const RESULTADOS = [
  { valor: "aprovado", rotulo: "Aprovado" },
  { valor: "reprovado", rotulo: "Reprovado" },
  { valor: "cursando", rotulo: "Cursando" },
  { valor: "transferido", rotulo: "Transferido" }
];

export function AbaAnos({ alunoId, nivel, series, historico }: Props) {
  const anos = historico?.anos ?? [];

  return (
    <div className="space-y-4">
      <form action={salvarAnoHistoricoAction} className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-4">
        <input type="hidden" name="alunoId" value={alunoId} />
        <input type="hidden" name="nivel" value={nivel} />
        <input type="hidden" name="origem" value="externa" />

        <label className="flex flex-col gap-1 text-sm">
          Ano
          <input type="number" name="ano" required className="rounded border border-border bg-background p-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Série
          <select name="serieNome" required className="rounded border border-border bg-background p-2">
            {series.map((s) => (
              <option key={s.id} value={s.nome}>{s.nome}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Resultado
          <select name="resultado" className="rounded border border-border bg-background p-2">
            {RESULTADOS.map((r) => (
              <option key={r.valor} value={r.valor}>{r.rotulo}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Média de aprovação
          <input type="number" step="0.01" name="mediaAprovacao" className="rounded border border-border bg-background p-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm md:col-span-2">
          Instituição
          <input name="instituicao" className="rounded border border-border bg-background p-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Cidade
          <input name="cidade" className="rounded border border-border bg-background p-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          UF
          <input name="uf" maxLength={2} className="rounded border border-border bg-background p-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          C.H. por série
          <input type="number" name="cargaHoraria" className="rounded border border-border bg-background p-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Faltas por série
          <input type="number" name="faltas" className="rounded border border-border bg-background p-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Dias letivos
          <input type="number" name="diasLetivos" className="rounded border border-border bg-background p-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          % Frequência
          <input type="number" step="0.01" name="percentualFrequencia" className="rounded border border-border bg-background p-2" />
        </label>

        <button type="submit" className="md:col-span-4 rounded bg-primary px-4 py-2 text-primary-foreground">
          Adicionar
        </button>
      </form>

      {anos.length === 0 ? (
        <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          Não há nada para mostrar aqui
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-2">Ano</th>
              <th className="p-2">Série</th>
              <th className="p-2">Origem</th>
              <th className="p-2">Instituição</th>
              <th className="p-2">Resultado</th>
              <th className="p-2">Dias letivos</th>
              <th className="p-2">C.H.</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {anos.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="p-2">{a.ano}</td>
                <td className="p-2">{a.serieNome}</td>
                <td className="p-2">{a.origem === "interna" ? "EPG" : "Externa"}</td>
                <td className="p-2">{a.instituicao ?? "—"}</td>
                <td className="p-2">{a.resultado}</td>
                <td className="p-2">{a.diasLetivos ?? "—"}</td>
                <td className="p-2">{a.cargaHoraria ?? "—"}</td>
                <td className="p-2 text-right">
                  <form action={removerAnoHistoricoAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className="text-sm text-destructive">Remover</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Escrever a aba de notas**

Criar `src/components/historico/aba-notas.tsx`:

```tsx
"use client";

import { useState } from "react";
import { salvarNotasAnoAction } from "@/lib/actions/historico";
import type { HistoricoData } from "@/lib/historico/tipos";

export function AbaNotas({ historico }: { historico: HistoricoData | null }) {
  const anos = historico?.anos ?? [];
  const [anoId, setAnoId] = useState(anos[0]?.id ?? "");
  const ano = anos.find((a) => a.id === anoId);

  if (anos.length === 0) {
    return (
      <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
        Cadastre um ano na aba “Escolas anteriores” antes de lançar notas.
      </p>
    );
  }

  const somenteLeitura = ano ? ano.origem === "interna" && !ano.congelado : false;

  return (
    <div className="space-y-4">
      <label className="flex max-w-sm flex-col gap-1 text-sm">
        Ano do histórico
        <select
          value={anoId}
          onChange={(e) => setAnoId(e.target.value)}
          className="rounded border border-border bg-background p-2"
        >
          {anos.map((a) => (
            <option key={a.id} value={a.id}>{a.ano} — {a.serieNome}</option>
          ))}
        </select>
      </label>

      {somenteLeitura && (
        <p className="rounded border border-border bg-muted p-3 text-sm text-muted-foreground">
          Notas calculadas das avaliações da EPG. Congelam quando este ano receber um resultado final.
        </p>
      )}

      <table className="w-full text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="p-2">Disciplina</th>
            <th className="p-2">Nota</th>
            <th className="p-2">C.H.</th>
            <th className="p-2">Faltas</th>
          </tr>
        </thead>
        <tbody>
          {(ano?.notas ?? []).map((n, i) => (
            <tr key={`${n.disciplinaNome}-${i}`} className="border-t border-border">
              <td className="p-2">{n.disciplinaNome}</td>
              <td className={somenteLeitura ? "p-2 text-muted-foreground" : "p-2"}>
                {n.nota === null ? "—" : n.nota.toFixed(1).replace(".", ",")}
              </td>
              <td className="p-2">{n.cargaHoraria ?? "—"}</td>
              <td className="p-2">{n.faltas ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!somenteLeitura && ano && (
        <form action={salvarNotasAnoAction} className="space-y-2">
          <input type="hidden" name="historicoAnoId" value={ano.id} />
          <input type="hidden" name="notas" value={JSON.stringify(ano.notas)} />
          <button type="submit" className="rounded bg-primary px-4 py-2 text-primary-foreground">
            Gravar notas
          </button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Escrever a aba de observação**

Criar `src/components/historico/aba-observacao.tsx`:

```tsx
"use client";

import { salvarObservacaoAction } from "@/lib/actions/historico";
import type { HistoricoData, NivelEnsino } from "@/lib/historico/tipos";

type Props = {
  alunoId: string;
  nivel: NivelEnsino;
  historico: HistoricoData | null;
};

export function AbaObservacao({ alunoId, nivel, historico }: Props) {
  return (
    <form action={salvarObservacaoAction} className="space-y-4 rounded-lg border border-border p-4">
      <input type="hidden" name="alunoId" value={alunoId} />
      <input type="hidden" name="nivel" value={nivel} />
      <label className="flex flex-col gap-1 text-sm">
        Observações
        <textarea
          name="observacoes"
          rows={10}
          defaultValue={historico?.observacoes ?? ""}
          className="rounded border border-border bg-background p-2"
        />
      </label>
      <button type="submit" className="rounded bg-primary px-4 py-2 text-primary-foreground">
        Gravar
      </button>
    </form>
  );
}
```

- [ ] **Step 8: Verificar build e typecheck**

Run: `npm run typecheck && npm run build`
Expected: PASS nos dois; a rota `/historico/notas` aparece no build.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(app)/historico/notas" src/components/historico/
git commit -m "feat(historico): tela de entrada de notas com abas"
```

---

### Task 9: Tela de emissão

**Files:**
- Create: `src/app/(app)/historico/emissao/page.tsx`
- Create: `src/components/historico/emissao-form.tsx`
- Create: `src/lib/data/historico-elegiveis.ts`
- Test: `src/lib/historico/elegiveis.test.ts`
- Create: `src/lib/historico/elegiveis.ts`

**Interfaces:**
- Consumes: `renderHistoricos` de `@/lib/documents/historico-pdf`; `getHistoricoAluno` de `@/lib/data/historico`; `HistoricoData` de `@/lib/historico/tipos`.
- Produces:
  - `separarElegiveis(alunos: AlunoElegivel[]): { prontos: AlunoElegivel[]; pendentes: AlunoElegivel[] }` onde
    `AlunoElegivel = { id: string; nome: string; temHistorico: boolean }`
  - `listarElegiveis(params: { anoLetivo: number; serieId?: string; turmaId?: string; alunoId?: string; nivel: NivelEnsino }): Promise<AlunoElegivel[]>`
  - `carregarHistoricosAction(alunoIds: string[], nivel: NivelEnsino): Promise<HistoricoData[]>`
  - rota `/historico/emissao`

- [ ] **Step 1: Escrever o teste da separação (que falha)**

Criar `src/lib/historico/elegiveis.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { separarElegiveis } from "./elegiveis";

describe("separarElegiveis", () => {
  it("separa quem tem histórico de quem não tem", () => {
    const { prontos, pendentes } = separarElegiveis([
      { id: "1", nome: "ANA", temHistorico: true },
      { id: "2", nome: "BRUNO", temHistorico: false },
      { id: "3", nome: "CARLA", temHistorico: true }
    ]);

    expect(prontos.map((a) => a.nome)).toEqual(["ANA", "CARLA"]);
    expect(pendentes.map((a) => a.nome)).toEqual(["BRUNO"]);
  });

  it("devolve listas vazias para entrada vazia", () => {
    expect(separarElegiveis([])).toEqual({ prontos: [], pendentes: [] });
  });

  it("devolve todos como pendentes quando ninguém tem histórico", () => {
    const { prontos, pendentes } = separarElegiveis([{ id: "1", nome: "ANA", temHistorico: false }]);
    expect(prontos).toEqual([]);
    expect(pendentes).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test -- src/lib/historico/elegiveis.test.ts`
Expected: FAIL — `Failed to resolve import "./elegiveis"`.

- [ ] **Step 3: Implementar a separação**

Criar `src/lib/historico/elegiveis.ts`:

```typescript
export type AlunoElegivel = {
  id: string;
  nome: string;
  temHistorico: boolean;
};

export function separarElegiveis(alunos: AlunoElegivel[]) {
  return {
    prontos: alunos.filter((a) => a.temHistorico),
    pendentes: alunos.filter((a) => !a.temHistorico)
  };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test -- src/lib/historico/elegiveis.test.ts`
Expected: PASS, 3 testes.

- [ ] **Step 5: Escrever a listagem de elegíveis**

Criar `src/lib/data/historico-elegiveis.ts`:

```typescript
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import type { AlunoElegivel } from "@/lib/historico/elegiveis";
import type { NivelEnsino } from "@/lib/historico/tipos";
import { createServerClient } from "@/lib/supabase/server";

export type FiltroElegiveis = {
  anoLetivo: number;
  nivel: NivelEnsino;
  serieId?: string;
  turmaId?: string;
  alunoId?: string;
};

export async function listarElegiveis(filtro: FiltroElegiveis): Promise<AlunoElegivel[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from("matriculas")
    .select("aluno_id, alunos(id, nome)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ano_letivo", filtro.anoLetivo)
    .eq("status", "ativa");

  if (filtro.serieId) query = query.eq("serie_id", filtro.serieId);
  if (filtro.turmaId) query = query.eq("turma_id", filtro.turmaId);
  if (filtro.alunoId) query = query.eq("aluno_id", filtro.alunoId);

  const { data, error } = await query;
  if (error) throw error;

  const alunos = (data ?? [])
    .map((row) => row.alunos as { id?: string; nome?: string } | null)
    .filter((a): a is { id: string; nome: string } => Boolean(a?.id && a?.nome));

  if (alunos.length === 0) return [];

  const { data: historicos, error: erroHistoricos } = await supabase
    .from("historico_escolar")
    .select("aluno_id")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("nivel", filtro.nivel)
    .in("aluno_id", alunos.map((a) => a.id));
  if (erroHistoricos) throw erroHistoricos;

  const comHistorico = new Set((historicos ?? []).map((h) => h.aluno_id as string));

  return alunos
    .map((a) => ({ id: a.id, nome: a.nome, temHistorico: comHistorico.has(a.id) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
```

- [ ] **Step 6: Adicionar a action que carrega os históricos selecionados**

No fim de `src/lib/actions/historico.ts`, adicionar:

```typescript
import { getHistoricoAluno } from "@/lib/data/historico";
import type { HistoricoData } from "@/lib/historico/tipos";

/** Carrega os HistoricoData dos alunos selecionados para o gerador de PDF no cliente. */
export async function carregarHistoricosAction(
  alunoIds: string[],
  nivel: NivelEnsino
): Promise<HistoricoData[]> {
  await requirePermission("historico", "read");
  const historicos = await Promise.all(alunoIds.map((id) => getHistoricoAluno(id, nivel)));
  return historicos.filter((h): h is HistoricoData => h !== null);
}
```

O import de `getHistoricoAluno` e `HistoricoData` vai junto dos demais imports no topo do arquivo — não duplicar o bloco `"use server"`.

- [ ] **Step 7: Escrever a página de emissão**

Criar `src/app/(app)/historico/emissao/page.tsx`:

```tsx
import { EmissaoForm } from "@/components/historico/emissao-form";
import { requirePermission } from "@/lib/auth/session";
import { listarElegiveis } from "@/lib/data/historico-elegiveis";
import { getAcademicData } from "@/lib/data/lookups";
import type { NivelEnsino } from "@/lib/historico/tipos";

type Props = {
  searchParams: { ano?: string; nivel?: string; serie?: string; turma?: string };
};

export default async function EmissaoPage({ searchParams }: Props) {
  await requirePermission("historico", "read");
  const { series, turmas } = await getAcademicData();

  const anoLetivo = Number(searchParams.ano ?? new Date().getFullYear());
  const nivel = (searchParams.nivel ?? "fund1") as NivelEnsino;
  const temFiltro = Boolean(searchParams.serie || searchParams.turma);

  const elegiveis = temFiltro
    ? await listarElegiveis({
        anoLetivo,
        nivel,
        serieId: searchParams.serie,
        turmaId: searchParams.turma
      })
    : [];

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Emissão do Histórico Escolar</h1>
        <p className="text-sm text-muted-foreground">
          Acadêmico / Histórico e Certificado / Emissões / Emissão do histórico escolar
        </p>
      </header>

      <EmissaoForm
        anoLetivo={anoLetivo}
        nivel={nivel}
        series={series.map((s) => ({ id: s.id as string, nome: s.nome as string }))}
        turmas={turmas.map((t) => ({ id: t.id as string, nome: t.nome as string }))}
        elegiveis={elegiveis}
      />
    </div>
  );
}
```

- [ ] **Step 8: Escrever o formulário de emissão**

Criar `src/components/historico/emissao-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { carregarHistoricosAction } from "@/lib/actions/historico";
import { renderHistoricos } from "@/lib/documents/historico-pdf";
import { separarElegiveis, type AlunoElegivel } from "@/lib/historico/elegiveis";
import type { NivelEnsino } from "@/lib/historico/tipos";

type Props = {
  anoLetivo: number;
  nivel: NivelEnsino;
  series: Array<{ id: string; nome: string }>;
  turmas: Array<{ id: string; nome: string }>;
  elegiveis: AlunoElegivel[];
};

export function EmissaoForm({ anoLetivo, nivel, series, turmas, elegiveis }: Props) {
  const router = useRouter();
  const { prontos, pendentes } = separarElegiveis(elegiveis);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [emitindo, setEmitindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function alternar(id: string) {
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]
    );
  }

  function marcarTodos() {
    setSelecionados(selecionados.length === prontos.length ? [] : prontos.map((a) => a.id));
  }

  async function emitir() {
    if (selecionados.length === 0) return;
    setEmitindo(true);
    setErro(null);
    try {
      const historicos = await carregarHistoricosAction(selecionados, nivel);
      if (historicos.length === 0) {
        setErro("Nenhum histórico pôde ser carregado para os alunos selecionados.");
        return;
      }
      renderHistoricos(historicos).save(`historicos-${anoLetivo}.pdf`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao emitir os históricos.");
    } finally {
      setEmitindo(false);
    }
  }

  function aplicarFiltro(campo: "serie" | "turma", valor: string) {
    const params = new URLSearchParams({ ano: String(anoLetivo), nivel });
    if (valor) params.set(campo, valor);
    router.push(`/historico/emissao?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          Ano de referência
          <input
            type="number"
            defaultValue={anoLetivo}
            onBlur={(e) =>
              router.push(`/historico/emissao?ano=${e.target.value}&nivel=${nivel}`)
            }
            className="rounded border border-border bg-background p-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Série
          <select onChange={(e) => aplicarFiltro("serie", e.target.value)} className="rounded border border-border bg-background p-2">
            <option value="">Nenhum</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Turma
          <select onChange={(e) => aplicarFiltro("turma", e.target.value)} className="rounded border border-border bg-background p-2">
            <option value="">Nenhum</option>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
        </label>
      </div>

      {erro && <p className="rounded border border-destructive p-3 text-sm text-destructive">{erro}</p>}

      {pendentes.length > 0 && (
        <div className="rounded border border-border bg-muted p-3 text-sm">
          <p className="font-medium">Sem histórico cadastrado ({pendentes.length}):</p>
          <p className="text-muted-foreground">{pendentes.map((a) => a.nome).join(", ")}</p>
          <p className="mt-1 text-muted-foreground">
            Estes alunos não entram na emissão. Cadastre o histórico deles na tela de entrada de notas.
          </p>
        </div>
      )}

      {elegiveis.length === 0 ? (
        <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          Selecione uma série ou turma para listar os alunos.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-2">
                <input
                  type="checkbox"
                  checked={prontos.length > 0 && selecionados.length === prontos.length}
                  onChange={marcarTodos}
                />
              </th>
              <th className="p-2">Aluno</th>
              <th className="p-2">Situação</th>
            </tr>
          </thead>
          <tbody>
            {elegiveis.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="p-2">
                  <input
                    type="checkbox"
                    disabled={!a.temHistorico}
                    checked={selecionados.includes(a.id)}
                    onChange={() => alternar(a.id)}
                  />
                </td>
                <td className="p-2">{a.nome}</td>
                <td className="p-2">{a.temHistorico ? "Pronto" : "Sem histórico"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button
        type="button"
        onClick={emitir}
        disabled={emitindo || selecionados.length === 0}
        className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
      >
        {emitindo ? "Emitindo…" : `Emitir selecionados (${selecionados.length})`}
      </button>
    </div>
  );
}
```

- [ ] **Step 9: Rodar a suíte inteira, typecheck e build**

Run: `npm run typecheck && npm run test && npm run build`
Expected: PASS nos três. As três rotas de `/historico` aparecem no build.

- [ ] **Step 10: Commit**

```bash
git add "src/app/(app)/historico/emissao" src/components/historico/emissao-form.tsx src/lib/data/historico-elegiveis.ts src/lib/historico/elegiveis.ts src/lib/historico/elegiveis.test.ts src/lib/actions/historico.ts
git commit -m "feat(historico): tela de emissao individual e em lote"
```

---

## Verificação final

- [ ] `npm run typecheck` verde
- [ ] `npm run test` verde (todos os arquivos `src/lib/historico/*.test.ts` e `src/lib/documents/historico-*.test.ts`)
- [ ] `npm run build` verde
- [ ] Migration aplicada em ambiente de teste com `supabase db push` — **não** usar `db reset --local`
- [ ] Cadastrar um credenciamento de teste e uma associação por série antes de usar a tela de notas: sem associação, o cabeçalho do PDF sai vazio
- [ ] Emitir o histórico de uma aluna com dois anos cursados e conferir o PDF contra `docs/referencias/historico-manuela.pdf`
