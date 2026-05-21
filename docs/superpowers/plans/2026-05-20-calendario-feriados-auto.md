# Auto-importar Feriados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ao criar um calendário letivo, inserir automaticamente os feriados (nacionais + estaduais + municipais) como exceções, derivados do ano e da UF/cidade da escola.

**Architecture:** Funções puras calculam feriados de um ano (algoritmo de Gauss para Páscoa → feriados móveis; tabelas estáticas para fixos/estaduais/municipais). `salvarCalendarioAction` chama essas funções na criação do calendário e insere as exceções em lote.

**Tech Stack:** TypeScript, Vitest, Supabase, Next.js Server Actions.

**Extensão de:** `feature/calendario-letivo` (mesma branch).

---

## File Structure

**Criar:**
- `src/lib/calendario/feriados.ts` — funções puras: `calcularPascoa`, `feriadosNacionais`, `feriadosEstaduais`, `feriadosMunicipais`, `todosFeriados`
- `src/lib/calendario/feriados.test.ts` — testes unitários

**Modificar:**
- `src/lib/actions/calendario.ts` — `salvarCalendarioAction` insere feriados na criação

---

## Task 1: Função `calcularPascoa` (algoritmo de Gauss)

A Páscoa é a base dos feriados móveis. Algoritmo de Gauss (Anonymous Gregorian algorithm) calcula a Páscoa de qualquer ano.

**Files:**
- Create: `src/lib/calendario/feriados.ts`
- Create: `src/lib/calendario/feriados.test.ts`

- [ ] **Step 1: Escrever o teste**

`src/lib/calendario/feriados.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { calcularPascoa } from "./feriados";

describe("calcularPascoa", () => {
  it("Páscoa 2024 = 31 de março", () => {
    expect(calcularPascoa(2024)).toBe("2024-03-31");
  });
  it("Páscoa 2025 = 20 de abril", () => {
    expect(calcularPascoa(2025)).toBe("2025-04-20");
  });
  it("Páscoa 2026 = 5 de abril", () => {
    expect(calcularPascoa(2026)).toBe("2026-04-05");
  });
  it("Páscoa 2027 = 28 de março", () => {
    expect(calcularPascoa(2027)).toBe("2027-03-28");
  });
});
```

- [ ] **Step 2: Rodar — deve FALHAR**

Run: `npx vitest run src/lib/calendario/feriados.test.ts`
Expected: FAIL — `calcularPascoa` não existe.

- [ ] **Step 3: Implementar**

`src/lib/calendario/feriados.ts`:

```typescript
// Algoritmo de Gauss (Anonymous Gregorian) — calcula a Páscoa de qualquer ano.
export function calcularPascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3=março, 4=abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Rodar — deve PASSAR**

Run: `npx vitest run src/lib/calendario/feriados.test.ts`
Expected: PASS — 4 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendario/feriados.ts src/lib/calendario/feriados.test.ts
git commit -m "feat(calendario): add calcularPascoa (Gauss algorithm)"
```

---

## Task 2: `feriadosNacionais` — fixos + móveis

8 feriados fixos + 3 móveis derivados da Páscoa: Carnaval (terça, Páscoa−47d), Sexta-feira Santa (Páscoa−2d), Corpus Christi (Páscoa+60d).

**Files:**
- Modify: `src/lib/calendario/feriados.ts`
- Modify: `src/lib/calendario/feriados.test.ts`

- [ ] **Step 1: Adicionar teste**

Acrescentar ao final de `src/lib/calendario/feriados.test.ts`:

```typescript
import { feriadosNacionais } from "./feriados";

describe("feriadosNacionais", () => {
  it("retorna 11 feriados (8 fixos + 3 móveis)", () => {
    expect(feriadosNacionais(2026)).toHaveLength(11);
  });

  it("inclui os feriados fixos com data correta", () => {
    const fer = feriadosNacionais(2026);
    const datas = Object.fromEntries(fer.map((f) => [f.descricao, f.data]));
    expect(datas["Confraternização Universal"]).toBe("2026-01-01");
    expect(datas["Tiradentes"]).toBe("2026-04-21");
    expect(datas["Dia do Trabalho"]).toBe("2026-05-01");
    expect(datas["Independência do Brasil"]).toBe("2026-09-07");
    expect(datas["Nossa Senhora Aparecida"]).toBe("2026-10-12");
    expect(datas["Finados"]).toBe("2026-11-02");
    expect(datas["Proclamação da República"]).toBe("2026-11-15");
    expect(datas["Natal"]).toBe("2026-12-25");
  });

  it("calcula feriados móveis a partir da Páscoa 2026 (05/04)", () => {
    const fer = feriadosNacionais(2026);
    const datas = Object.fromEntries(fer.map((f) => [f.descricao, f.data]));
    // Páscoa 2026 = 2026-04-05
    expect(datas["Sexta-feira Santa"]).toBe("2026-04-03");      // Páscoa - 2
    expect(datas["Carnaval"]).toBe("2026-02-17");               // Páscoa - 47
    expect(datas["Corpus Christi"]).toBe("2026-06-04");         // Páscoa + 60
  });
});
```

- [ ] **Step 2: Rodar — deve FALHAR**

Run: `npx vitest run src/lib/calendario/feriados.test.ts`
Expected: FAIL — `feriadosNacionais` não existe.

- [ ] **Step 3: Implementar**

Acrescentar ao `src/lib/calendario/feriados.ts`:

```typescript
export type Feriado = {
  data: string;       // YYYY-MM-DD
  descricao: string;
};

function addDias(isoDate: string, dias: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function feriadosNacionais(ano: number): Feriado[] {
  const pascoa = calcularPascoa(ano);
  return [
    { data: `${ano}-01-01`, descricao: "Confraternização Universal" },
    { data: addDias(pascoa, -47), descricao: "Carnaval" },
    { data: addDias(pascoa, -2), descricao: "Sexta-feira Santa" },
    { data: `${ano}-04-21`, descricao: "Tiradentes" },
    { data: `${ano}-05-01`, descricao: "Dia do Trabalho" },
    { data: addDias(pascoa, 60), descricao: "Corpus Christi" },
    { data: `${ano}-09-07`, descricao: "Independência do Brasil" },
    { data: `${ano}-10-12`, descricao: "Nossa Senhora Aparecida" },
    { data: `${ano}-11-02`, descricao: "Finados" },
    { data: `${ano}-11-15`, descricao: "Proclamação da República" },
    { data: `${ano}-12-25`, descricao: "Natal" },
  ];
}
```

- [ ] **Step 4: Rodar — deve PASSAR**

Run: `npx vitest run src/lib/calendario/feriados.test.ts`
Expected: PASS — 7 testes (4 + 3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendario/feriados.ts src/lib/calendario/feriados.test.ts
git commit -m "feat(calendario): add feriadosNacionais with fixed and movable holidays"
```

---

## Task 3: `feriadosEstaduais` e `feriadosMunicipais`

Tabelas estáticas por UF e por cidade. Goiás não tem feriado estadual civil exclusivo — entra com array vazio. Trindade-GO tem o aniversário em 31/08. Outras UFs/cidades comuns entram para extensibilidade futura.

**Files:**
- Modify: `src/lib/calendario/feriados.ts`
- Modify: `src/lib/calendario/feriados.test.ts`

- [ ] **Step 1: Adicionar teste**

Acrescentar ao final de `src/lib/calendario/feriados.test.ts`:

```typescript
import { feriadosEstaduais, feriadosMunicipais, todosFeriados } from "./feriados";

describe("feriadosEstaduais", () => {
  it("Goiás não tem feriado estadual civil exclusivo", () => {
    expect(feriadosEstaduais("GO", 2026)).toHaveLength(0);
  });

  it("São Paulo tem Revolução Constitucionalista em 09/07", () => {
    const fer = feriadosEstaduais("SP", 2026);
    expect(fer.some((f) => f.data === "2026-07-09")).toBe(true);
  });

  it("UF desconhecida retorna vazio", () => {
    expect(feriadosEstaduais("XX", 2026)).toHaveLength(0);
  });
});

describe("feriadosMunicipais", () => {
  it("Trindade-GO tem aniversário em 31/08", () => {
    const fer = feriadosMunicipais("GO", "Trindade", 2026);
    const datas = fer.map((f) => f.data);
    expect(datas).toContain("2026-08-31");
  });

  it("cidade desconhecida retorna vazio", () => {
    expect(feriadosMunicipais("GO", "Cidade Inexistente", 2026)).toHaveLength(0);
  });

  it("matching de cidade é case e acento insensitive", () => {
    expect(feriadosMunicipais("GO", "TRINDADE", 2026).length).toBeGreaterThan(0);
    expect(feriadosMunicipais("GO", "trindade", 2026).length).toBeGreaterThan(0);
  });
});

describe("todosFeriados", () => {
  it("junta nacionais + estaduais + municipais sem duplicar data", () => {
    const fer = todosFeriados(2026, "GO", "Trindade");
    // 11 nacionais + 0 estaduais GO + 1 municipal Trindade = 12
    expect(fer).toHaveLength(12);
    // nenhuma data repetida
    const datas = fer.map((f) => f.data);
    expect(new Set(datas).size).toBe(datas.length);
  });
});
```

- [ ] **Step 2: Rodar — deve FALHAR**

Run: `npx vitest run src/lib/calendario/feriados.test.ts`
Expected: FAIL — funções não existem.

- [ ] **Step 3: Implementar**

Acrescentar ao `src/lib/calendario/feriados.ts`:

```typescript
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Feriados estaduais civis por UF. Apenas datas fixas.
// UFs sem feriado estadual civil exclusivo são omitidas (retornam []).
const ESTADUAIS: Record<string, Array<{ mesDia: string; descricao: string }>> = {
  SP: [{ mesDia: "07-09", descricao: "Revolução Constitucionalista" }],
  RJ: [{ mesDia: "04-23", descricao: "Dia de São Jorge" }],
  BA: [{ mesDia: "07-02", descricao: "Independência da Bahia" }],
  // GO: sem feriado estadual civil exclusivo
};

// Feriados municipais por UF + cidade (cidade normalizada: minúscula, sem acento).
const MUNICIPAIS: Record<string, Record<string, Array<{ mesDia: string; descricao: string }>>> = {
  GO: {
    trindade: [{ mesDia: "08-31", descricao: "Aniversário de Trindade" }],
  },
};

export function feriadosEstaduais(uf: string, ano: number): Feriado[] {
  const lista = ESTADUAIS[uf.toUpperCase()] ?? [];
  return lista.map((f) => ({
    data: `${ano}-${f.mesDia}`,
    descricao: f.descricao,
  }));
}

export function feriadosMunicipais(uf: string, cidade: string, ano: number): Feriado[] {
  const porCidade = MUNICIPAIS[uf.toUpperCase()] ?? {};
  const lista = porCidade[normalizar(cidade)] ?? [];
  return lista.map((f) => ({
    data: `${ano}-${f.mesDia}`,
    descricao: f.descricao,
  }));
}

export function todosFeriados(ano: number, uf: string, cidade: string): Feriado[] {
  const todos = [
    ...feriadosNacionais(ano),
    ...feriadosEstaduais(uf, ano),
    ...feriadosMunicipais(uf, cidade, ano),
  ];
  // Dedup por data — nacional tem precedência (vem primeiro).
  const vistos = new Set<string>();
  const resultado: Feriado[] = [];
  for (const f of todos) {
    if (vistos.has(f.data)) continue;
    vistos.add(f.data);
    resultado.push(f);
  }
  return resultado;
}
```

- [ ] **Step 4: Rodar — deve PASSAR**

Run: `npx vitest run src/lib/calendario/feriados.test.ts`
Expected: PASS — 14 testes (7 + 7).

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendario/feriados.ts src/lib/calendario/feriados.test.ts
git commit -m "feat(calendario): add estadual and municipal holidays by UF/city"
```

---

## Task 4: Auto-inserir feriados ao criar calendário

`salvarCalendarioAction` — na CRIAÇÃO (sem `id`): após inserir o calendário, ler `uf`/`cidade` da escola, gerar feriados do ano, filtrar os que caem dentro do período, e inserir como exceções `tipo: "feriado"`.

**Files:**
- Modify: `src/lib/actions/calendario.ts`

- [ ] **Step 1: Adicionar import**

No topo de `src/lib/actions/calendario.ts`, junto aos imports existentes:

```typescript
import { todosFeriados } from "@/lib/calendario/feriados";
```

- [ ] **Step 2: Modificar o branch de criação em `salvarCalendarioAction`**

O código atual do final de `salvarCalendarioAction` é:

```typescript
  if (id) {
    await supabase.from("calendario_letivo").update(payload).eq("id", id).eq("escola_id", DEFAULT_SCHOOL_ID);
  } else {
    await supabase.from("calendario_letivo").insert(payload);
  }

  revalidatePath("/calendario");
}
```

Substituir o bloco `if/else` inteiro por:

```typescript
  if (id) {
    await supabase.from("calendario_letivo").update(payload).eq("id", id).eq("escola_id", DEFAULT_SCHOOL_ID);
  } else {
    const { data: novoCal } = await supabase
      .from("calendario_letivo")
      .insert(payload)
      .select("id")
      .single();

    if (novoCal) {
      // Auto-importar feriados nacionais/estaduais/municipais do ano.
      const { data: escola } = await supabase
        .from("escolas")
        .select("uf, cidade")
        .eq("id", DEFAULT_SCHOOL_ID)
        .maybeSingle();

      const feriados = todosFeriados(anoLetivo, escola?.uf ?? "", escola?.cidade ?? "")
        .filter((f) => f.data >= dataInicio && f.data <= dataFim);

      if (feriados.length > 0) {
        await supabase.from("calendario_excecoes").insert(
          feriados.map((f) => ({
            calendario_id: novoCal.id,
            escola_id: DEFAULT_SCHOOL_ID,
            data_inicio: f.data,
            data_fim: f.data,
            tipo: "feriado" as const,
            descricao: f.descricao,
          })),
        );
      }
    }
  }

  revalidatePath("/calendario");
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build passa.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/calendario.ts
git commit -m "feat(calendario): auto-import holidays as exceptions on calendar creation"
```

---

## Task 5: Verificação final

- [ ] **Step 1: Rodar todos os testes**

Run: `npm test`
Expected: testes de `feriados.test.ts` (14) + `dias-letivos.test.ts` (10) = 24 passando.

- [ ] **Step 2: Build final**

Run: `npm run build`
Expected: passa.

- [ ] **Step 3: Smoke test manual** (no dev server)

1. `/calendario` → criar um calendário novo para um ano (ex: 2027), período jan-dez.
2. Após salvar, a grade deve mostrar os feriados em vermelho automaticamente.
3. A lista de exceções deve listar ~12 feriados (Confraternização, Carnaval, Sexta-Santa, Tiradentes, Trabalho, Corpus Christi, Independência, N.Sra. Aparecida, Finados, Proclamação, Natal, Aniversário de Trindade).
4. O total de dias letivos deve ter descontado os feriados.
5. Criar calendário com período parcial (ex: fev-jun) → só feriados nesse intervalo entram.
6. Editar um calendário existente → NÃO duplica feriados.

---

## Notas de execução

- **Idempotência:** a importação só roda na criação (sem `id`). Editar não re-importa — evita duplicar. Se o usuário excluir um feriado e quiser de volta, cadastra manual.
- **Feriados fora do período:** filtrados antes do insert — calendário fev-dez não recebe Confraternização (01/01).
- **GO sem estadual:** `feriadosEstaduais("GO", ...)` retorna `[]` por design — Goiás não tem feriado estadual civil exclusivo.
- **Festa do Divino Pai Eterno:** NÃO incluída — não tem data legal fixa anual (varia: última sexta de junho a 1º domingo de julho). Usuário cadastra manual se quiser.
