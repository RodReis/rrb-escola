# Cadastro de Bolsista — tipo_vaga no Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar campos `tipo_vaga` e `percentual_bolsa` no formulário de matrícula. Quando bolsa integral/permuta/gratuita, não gerar cobranças. Quando bolsa parcial, gerar com desconto %.

**Architecture:** Form ganha 2 campos na section "Relação de Matrículas". Server action lê e persiste em `matriculas`. `generateChargesForEnrollment` recebe `tipoVaga` + `percentualBolsa`, decide se gera (paga/parcial) ou skipa (integral/permuta/gratuita), e aplica desconto na parcial.

**Tech Stack:** Next.js 14 App Router (Server Action), TypeScript, Supabase, Tailwind.

**Validation:** sem testes automáticos. Cada task termina `npm run typecheck && npm run lint`. Erro pré-existente `student-edit-tabs` OK.

**Scope:** apenas CREATE (cadastro novo). Edição de matrícula existente fica pra fase 2 (UI dedicada).

**Pré-requisitos confirmados:**
- Schema: `matriculas.tipo_vaga` (enum) e `matriculas.percentual_bolsa` (numeric) já existem.
- Constraint: `bolsa_parcial` requer 0 < percentual < 100; outros tipos requerem percentual=0.

---

## File Structure

**Modificar:**
- `src/components/students/student-form.tsx` — adicionar 2 campos na section de matrícula
- `src/lib/actions/students.ts` — `createStudentAction`: ler tipo_vaga/percentual, persistir, passar pra generator
- `src/lib/server/generate-charges.ts` — receber tipoVaga/percentualBolsa, decidir skip/desconto

---

## Task 1: Adicionar campos no `student-form.tsx`

**File:** `src/components/students/student-form.tsx`

- [ ] **Step 1: Modificar section "Relacao de Matriculas"**

Localize a section atual:

```tsx
<Section title="Relacao de Matriculas">
  <div className="grid gap-4 md:grid-cols-5">
    <label>Serie<select name="serie_id">...</select></label>
    <label>Turma<select name="turma_id">...</select></label>
    <label>Plano<select name="plano_id">...</select></label>
    <label>Data Matricula<input name="data_matricula" type="date" /></label>
    <label>Idade<input name="idade_na_matricula" type="number" /></label>
    <label>Ano letivo<input name="ano_letivo" type="number" defaultValue={new Date().getFullYear()} /></label>
  </div>
</Section>
```

Substitua por (grid passa de 5 para 6 colunas, adiciona 2 campos):

```tsx
<Section title="Relacao de Matriculas">
  <div className="grid gap-4 md:grid-cols-6">
    <label>Serie<select name="serie_id"><option value="">Selecione</option>{options.series.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
    <label>Turma<select name="turma_id"><option value="">Selecione</option>{options.turmas.map((item) => <option key={item.id} value={item.id}>{item.nome} - {item.ano_letivo}</option>)}</select></label>
    <label>Plano<select name="plano_id"><option value="">Selecione</option>{options.planos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
    <label>Data Matricula<input name="data_matricula" type="date" /></label>
    <label>Idade<input name="idade_na_matricula" type="number" /></label>
    <label>Ano letivo<input name="ano_letivo" type="number" defaultValue={new Date().getFullYear()} /></label>
    <label>Tipo de vaga
      <select name="tipo_vaga" defaultValue="paga">
        <option value="paga">Paga</option>
        <option value="bolsa_integral">Bolsa integral</option>
        <option value="bolsa_parcial">Bolsa parcial</option>
        <option value="permuta">Permuta</option>
        <option value="gratuita">Gratuidade</option>
      </select>
    </label>
    <label>% Bolsa parcial
      <input
        name="percentual_bolsa"
        type="number"
        min={0}
        max={100}
        step={1}
        defaultValue={0}
        placeholder="0-100"
      />
    </label>
  </div>
  <p className="text-xs text-ink/55">
    % Bolsa parcial só é considerado quando o tipo é &quot;Bolsa parcial&quot;. Para outros tipos, deixe em 0.
  </p>
</Section>
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Expected: só erro pré-existente.

- [ ] **Step 3: Commit**

```bash
git add src/components/students/student-form.tsx
git commit -m "feat(matriculas): campos tipo_vaga e percentual_bolsa no form"
```

---

## Task 2: Atualizar `createStudentAction` — ler/validar/persistir

**File:** `src/lib/actions/students.ts`

- [ ] **Step 1: Adicionar helper de leitura+validação no topo do arquivo (após imports)**

Logo antes da função `createStudentAction`, adicionar:

```typescript
type TipoVagaInput = "paga" | "bolsa_integral" | "bolsa_parcial" | "permuta" | "gratuita";

function readTipoVaga(formData: FormData): TipoVagaInput {
  const raw = formText(formData, "tipo_vaga");
  const valid: TipoVagaInput[] = ["paga", "bolsa_integral", "bolsa_parcial", "permuta", "gratuita"];
  if (raw && (valid as string[]).includes(raw)) return raw as TipoVagaInput;
  return "paga";
}

function readPercentualBolsa(formData: FormData, tipo: TipoVagaInput): number {
  if (tipo !== "bolsa_parcial") return 0;
  const raw = formNumber(formData, "percentual_bolsa") ?? 0;
  if (raw <= 0 || raw >= 100) {
    throw new Error("Bolsa parcial exige percentual entre 1 e 99.");
  }
  return raw;
}
```

- [ ] **Step 2: Atualizar bloco de criação de matrícula**

Localize o bloco:

```typescript
const serieId = formText(formData, "serie_id");
const turmaId = formText(formData, "turma_id");
if (serieId && turmaId) {
  const planoId = formText(formData, "plano_id");
  const dataMatricula = formText(formData, "data_matricula") ?? new Date().toISOString().slice(0, 10);
  const anoLetivo = formNumber(formData, "ano_letivo") ?? new Date().getFullYear();
  const { data: enrollment } = await supabase.from("matriculas").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    aluno_id: alunoId,
    serie_id: serieId,
    turma_id: turmaId,
    plano_id: planoId,
    codigo: `${matricula}-${new Date().getFullYear()}`,
    data_matricula: dataMatricula,
    ano_letivo: anoLetivo,
    idade_na_matricula: formNumber(formData, "idade_na_matricula"),
    status: "ativa"
  }).select("id").single();

  if (enrollment) {
    await generateChargesForEnrollment({
      supabase,
      escolaId: DEFAULT_SCHOOL_ID,
      alunoId,
      matriculaId: enrollment.id,
      planoId,
      dataMatricula,
      anoLetivo
    });
  }
}
```

Substitua POR (adiciona tipo_vaga + percentual_bolsa no insert + passa pro generator):

```typescript
const serieId = formText(formData, "serie_id");
const turmaId = formText(formData, "turma_id");
if (serieId && turmaId) {
  const planoId = formText(formData, "plano_id");
  const dataMatricula = formText(formData, "data_matricula") ?? new Date().toISOString().slice(0, 10);
  const anoLetivo = formNumber(formData, "ano_letivo") ?? new Date().getFullYear();
  const tipoVaga = readTipoVaga(formData);
  const percentualBolsa = readPercentualBolsa(formData, tipoVaga);

  const { data: enrollment } = await supabase.from("matriculas").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    aluno_id: alunoId,
    serie_id: serieId,
    turma_id: turmaId,
    plano_id: planoId,
    codigo: `${matricula}-${new Date().getFullYear()}`,
    data_matricula: dataMatricula,
    ano_letivo: anoLetivo,
    idade_na_matricula: formNumber(formData, "idade_na_matricula"),
    status: "ativa",
    tipo_vaga: tipoVaga,
    percentual_bolsa: percentualBolsa
  }).select("id").single();

  if (enrollment) {
    await generateChargesForEnrollment({
      supabase,
      escolaId: DEFAULT_SCHOOL_ID,
      alunoId,
      matriculaId: enrollment.id,
      planoId,
      dataMatricula,
      anoLetivo,
      tipoVaga,
      percentualBolsa
    });
  }
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: erro novo em `generateChargesForEnrollment` por argumentos extras (`tipoVaga`, `percentualBolsa`). Esperado — Task 3 resolve. Outros erros: investigar.

- [ ] **Step 4: NÃO commitar ainda**

Esta task depende de Task 3 pra typecheck limpo. Continuar.

---

## Task 3: Atualizar `generateChargesForEnrollment` — skip ou desconto

**File:** `src/lib/server/generate-charges.ts`

- [ ] **Step 1: Estender input type**

Localize:

```typescript
type GenerateChargesInput = {
  supabase: SupabaseLike;
  escolaId: string;
  alunoId: string;
  matriculaId: string;
  planoId: string | null;
  dataMatricula: string;
  anoLetivo: number;
};
```

Substitua por:

```typescript
export type TipoVagaCobranca = "paga" | "bolsa_integral" | "bolsa_parcial" | "permuta" | "gratuita";

type GenerateChargesInput = {
  supabase: SupabaseLike;
  escolaId: string;
  alunoId: string;
  matriculaId: string;
  planoId: string | null;
  dataMatricula: string;
  anoLetivo: number;
  tipoVaga?: TipoVagaCobranca;
  percentualBolsa?: number;
};
```

(Optional `?` pra manter retrocompatibilidade — defaults aplicam `paga`+`0`.)

- [ ] **Step 2: Adicionar early-return + desconto na geração**

Localize a função `generateChargesForEnrollment`. Logo no início, após o `if (!input.planoId) return;`, adicionar:

```typescript
  const tipoVaga: TipoVagaCobranca = input.tipoVaga ?? "paga";
  const percentualBolsa = Math.max(0, Math.min(100, input.percentualBolsa ?? 0));

  // Bolsa integral / permuta / gratuita: sem cobranças
  if (tipoVaga === "bolsa_integral" || tipoVaga === "permuta" || tipoVaga === "gratuita") {
    return;
  }
```

Resultado parcial da função (após `if (!input.planoId) return;`):

```typescript
  if (!input.planoId) return;

  const tipoVaga: TipoVagaCobranca = input.tipoVaga ?? "paga";
  const percentualBolsa = Math.max(0, Math.min(100, input.percentualBolsa ?? 0));

  if (tipoVaga === "bolsa_integral" || tipoVaga === "permuta" || tipoVaga === "gratuita") {
    return;
  }

  const planQuery = input.supabase.from("planos") as PlanQuery;
  // ... resto inalterado até aqui ...
```

- [ ] **Step 3: Aplicar desconto na geração das mensalidades (bolsa_parcial)**

Localize o loop de geração de mensalidades:

```typescript
for (let index = 0; index < installments; index += 1) {
  const monthIndex = index % 12;
  const year = input.anoLetivo + Math.floor(index / 12);
  rows.push({
    escola_id: input.escolaId,
    aluno_id: input.alunoId,
    matricula_id: input.matriculaId,
    plano_id: input.planoId,
    descricao: `Mensalidade ${String(monthIndex + 1).padStart(2, "0")}/${year} - ${plan.nome}`,
    competencia: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
    numero_parcela: index + 1,
    valor_original: monthlyFee,
    valor_desconto: 0,
    valor_acrescimo: 0,
    data_vencimento: dueDate(year, monthIndex, dueDay),
    status: "aberta"
  });
}
```

Substitua por:

```typescript
const descontoMensal = tipoVaga === "bolsa_parcial"
  ? Math.round(monthlyFee * (percentualBolsa / 100) * 100) / 100
  : 0;

for (let index = 0; index < installments; index += 1) {
  const monthIndex = index % 12;
  const year = input.anoLetivo + Math.floor(index / 12);
  rows.push({
    escola_id: input.escolaId,
    aluno_id: input.alunoId,
    matricula_id: input.matriculaId,
    plano_id: input.planoId,
    descricao: `Mensalidade ${String(monthIndex + 1).padStart(2, "0")}/${year} - ${plan.nome}`,
    competencia: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
    numero_parcela: index + 1,
    valor_original: monthlyFee,
    valor_desconto: descontoMensal,
    valor_acrescimo: 0,
    data_vencimento: dueDate(year, monthIndex, dueDay),
    status: "aberta"
  });
}
```

Nota: `valor_final` na tabela `cobrancas` é generated column (`valor_original - valor_desconto + valor_acrescimo`), portanto o desconto aplica automaticamente. Taxa de matrícula (registrationFee) **continua sem desconto** intencionalmente — bolsa parcial cobre só mensalidade. Se diretor decidir aplicar bolsa na matrícula também, isso vira ajuste futuro.

- [ ] **Step 4: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Expected: limpo (só erro pré-existente).

- [ ] **Step 5: Commit (juntando Tasks 2 + 3)**

```bash
git add src/lib/actions/students.ts src/lib/server/generate-charges.ts
git commit -m "feat(matriculas): persistir tipo_vaga + cobranças condicionais (skip integral/permuta/gratuita; desconto parcial)"
```

---

## Task 4: Smoke test manual

**Files:** nenhum

- [ ] **Step 1: Verificar Supabase rodando**

```bash
docker ps --filter "name=supabase_db_rrb-escola" --format "{{.Names}}"
```
Expected: container listado.

- [ ] **Step 2: Subir app em dev**

```bash
npm run dev
```

Aguardar `Ready in ...ms`.

- [ ] **Step 3: Cadastrar aluno bolsa integral**

Via navegador em `http://localhost:3000/alunos/novo`:

- Preencher mínimo: Matricula, Nome, Serie, Turma, Plano
- Section Matrículas: **Tipo de vaga = "Bolsa integral"**
- Submit

- [ ] **Step 4: Verificar SQL — matrícula criada sem cobranças**

```bash
docker exec supabase_db_rrb-escola psql -U postgres -d postgres -c "
select a.nome, m.tipo_vaga, m.percentual_bolsa, m.status,
  (select count(*) from cobrancas c where c.matricula_id = m.id) as cobrancas
from matriculas m
join alunos a on a.id = m.aluno_id
where m.escola_id = '00000000-0000-0000-0000-000000000001'
order by m.created_at desc
limit 1;
"
```
Expected: `tipo_vaga = bolsa_integral`, `percentual_bolsa = 0.00`, `cobrancas = 0`.

- [ ] **Step 5: Cadastrar aluno bolsa parcial 50%**

Novo cadastro:
- Tipo de vaga = "Bolsa parcial"
- % Bolsa parcial = 50
- Submit

- [ ] **Step 6: Verificar SQL — cobranças geradas com desconto**

```bash
docker exec supabase_db_rrb-escola psql -U postgres -d postgres -c "
select a.nome, m.tipo_vaga, m.percentual_bolsa,
  c.competencia, c.valor_original, c.valor_desconto, c.valor_final
from matriculas m
join alunos a on a.id = m.aluno_id
join cobrancas c on c.matricula_id = m.id
where m.escola_id = '00000000-0000-0000-0000-000000000001'
  and m.tipo_vaga = 'bolsa_parcial'
order by m.created_at desc, c.competencia
limit 5;
"
```
Expected: `valor_desconto = valor_original * 0.5`, `valor_final = valor_original * 0.5`.

- [ ] **Step 7: Verificar dashboard reflete bolsistas**

Abrir `http://localhost:3000`. Conferir:
- BeneficiosCard: total > 0
- StageTable: coluna Bolsistas mostra valores
- Ocupação: aumentou conforme alunos novos

- [ ] **Step 8: Edge case — bolsa parcial 0%**

Tentar cadastrar aluno com Tipo = "Bolsa parcial" + % = 0. Submit.

Expected: erro "Bolsa parcial exige percentual entre 1 e 99." (vindo de `readPercentualBolsa`). Submit não cria aluno.

- [ ] **Step 9: Sem commit**

Smoke test não altera código. Apenas validação.

---

## Self-Review

**Spec coverage:**
- Form ganha tipo_vaga + percentual_bolsa → Task 1 ✓
- Action persiste em matriculas → Task 2 ✓
- Generator skip integral/permuta/gratuita → Task 3 (early return) ✓
- Generator desconto bolsa_parcial → Task 3 (descontoMensal) ✓
- Validação bolsa parcial 0 < pct < 100 → Task 2 (`readPercentualBolsa`) ✓
- Smoke test → Task 4 ✓

**Type consistency:**
- `TipoVagaInput` (action) e `TipoVagaCobranca` (generator) têm mesmos 5 valores literais ✓
- `tipo_vaga` no insert bate com enum SQL ✓
- `percentual_bolsa` numeric — JS `number` OK ✓

**Riscos:**
- Constraint SQL pode rejeitar combinação `bolsa_parcial + pct=0` ou `paga + pct>0` — validação JS no `readPercentualBolsa` previne; SQL constraint backup.
- Edição de matrícula existente NÃO incluída — `tipo_vaga` só ajustável pelo admin via SQL ou nova UI futura. Aceitável pra fase 1.
- Taxa de matrícula (registrationFee) sempre gerada sem desconto — pode não ser o esperado pra bolsa integral. **Reavaliar se diretor reclamar.** Hoje: bolsa integral skipa TODAS cobranças (incluindo matrícula); bolsa parcial gera matrícula full + mensalidade com desconto. Documentado no código.
