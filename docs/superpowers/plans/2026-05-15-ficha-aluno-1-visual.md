# Ficha do Aluno — Sub-spec 1: Visual HTML — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refazer `<StudentSheetView>` para aderir ao modelo PDF original, adicionar campo `disciplina_eletiva` ao schema, atualizar forms e tipo `StudentSheet`.

**Architecture:** Migration adiciona coluna nullable `disciplina_eletiva`. Componente `StudentSheetView` reescrito com layout tabular fiel ao modelo, cabeçalho RRB próprio, checkboxes visuais via lucide, blocos reorganizados (sem histórico duplicado, sem atributos adicionais). Forms ganham campo. Server actions estendem insert/update.

**Tech Stack:** Next.js 14.2.35, Supabase, TypeScript, Tailwind, lucide-react (já no projeto).

**Spec:** `docs/superpowers/specs/2026-05-15-ficha-aluno-1-visual-design.md`

---

## File Structure

### Novos arquivos

- `supabase/migrations/202605190001_disciplina_eletiva.sql` — coluna nullable.

### Arquivos modificados

- `src/lib/types.ts` — adiciona `disciplina_eletiva` em `StudentSheet`.
- `src/lib/data/students.ts` — `getStudentSheet` retorna `disciplina_eletiva` (via `*` provavelmente já cobre, validar).
- `src/lib/actions/students.ts` — `createStudentAction` + `updateStudentAction` populam `disciplina_eletiva`.
- `src/components/students/student-form.tsx` — campo novo.
- `src/components/students/student-edit-form.tsx` — campo novo.
- `src/components/students/student-sheet.tsx` — reescrita completa.
- `src/app/globals.css` — atualiza `.sheet-table` e `.sheet-label`.
- `src/app/(app)/alunos/[id]/page.tsx` — passa `geradoEm` prop.

---

## Fase 1 — Schema + tipo

### Task 1: Migration disciplina_eletiva

**Files:**
- Create: `supabase/migrations/202605190001_disciplina_eletiva.sql`

- [ ] **Step 1: Criar arquivo**

```sql
-- Ficha aluno sub-spec 1: adiciona campo disciplina_eletiva (presente no PDF modelo).
alter table alunos
  add column if not exists disciplina_eletiva text;
```

- [ ] **Step 2: Aplicar**

Run: `npx supabase db reset`
Expected: clean. Re-aplicar `npm run seed:auth`.

- [ ] **Step 3: Verificar coluna**

Run: `npx supabase db query "select column_name from information_schema.columns where table_name = 'alunos' and column_name = 'disciplina_eletiva';"`
Expected: 1 linha.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202605190001_disciplina_eletiva.sql
git commit -m "feat(db): add disciplina_eletiva column on alunos"
```

---

### Task 2: Tipo StudentSheet

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Adicionar campo**

Localizar linha 20 (`foto_url: string | null;`). Após essa linha, adicionar:

```ts
  disciplina_eletiva: string | null;
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa (sem consumers que quebrem).

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add disciplina_eletiva to StudentSheet"
```

---

## Fase 2 — Server actions + forms

### Task 3: createStudentAction popula disciplina_eletiva

**Files:**
- Modify: `src/lib/actions/students.ts`

- [ ] **Step 1: Adicionar campo no insert**

Localizar bloco `.insert({ ... })` em `createStudentAction`. Após linha `informacoes_adicionais: formText(formData, "informacoes_adicionais"),`, adicionar:

```ts
      disciplina_eletiva: formText(formData, "disciplina_eletiva"),
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/students.ts
git commit -m "feat(actions): include disciplina_eletiva on create student"
```

---

### Task 4: updateStudentAction popula disciplina_eletiva

**Files:**
- Modify: `src/lib/actions/students.ts`

- [ ] **Step 1: Adicionar campo no update**

Localizar bloco `.update({ ... })` em `updateStudentAction`. Após linha `informacoes_adicionais: formText(formData, "informacoes_adicionais"),`, adicionar:

```ts
      disciplina_eletiva: formText(formData, "disciplina_eletiva"),
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/students.ts
git commit -m "feat(actions): include disciplina_eletiva on update student"
```

---

### Task 5: StudentForm campo novo

**Files:**
- Modify: `src/components/students/student-form.tsx`

- [ ] **Step 1: Adicionar campo**

Localizar `<label className="md:col-span-2">Informacoes adicionais...`. Antes dessa linha, adicionar:

```tsx
          <label className="md:col-span-2">Disciplina eletiva<input name="disciplina_eletiva" /></label>
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/components/students/student-form.tsx
git commit -m "feat(students): add disciplina eletiva input to create form"
```

---

### Task 6: StudentEditForm campo novo

**Files:**
- Modify: `src/components/students/student-edit-form.tsx`

- [ ] **Step 1: Adicionar campo**

Localizar `<label className="md:col-span-2">Informacoes adicionais<input name="informacoes_adicionais" defaultValue={student.informacoes_adicionais ?? ""} /></label>`. Antes dessa linha, adicionar:

```tsx
          <label className="md:col-span-2">Disciplina eletiva<input name="disciplina_eletiva" defaultValue={student.disciplina_eletiva ?? ""} /></label>
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/components/students/student-edit-form.tsx
git commit -m "feat(students): add disciplina eletiva input to edit form"
```

---

## Fase 3 — Visual da ficha

### Task 7: CSS .sheet-table refinado

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Atualizar estilos no fim do arquivo**

Substituir o bloco existente:

```css
.sheet-table {
  width: 100%;
  border-collapse: collapse;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10px;
  line-height: 1.05;
  color: #000;
}

.sheet-table th,
.sheet-table td {
  border: 1px solid #000;
  padding: 2px 3px;
  vertical-align: top;
}

.sheet-table th {
  background: #e9e9e9;
  text-align: center;
  font-weight: 700;
}

.sheet-label {
  display: block;
  font-size: 8px;
  font-weight: 700;
}
```

Por:

```css
.sheet-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
  line-height: 1.25;
  color: #111;
  background: #fff;
}

.sheet-table th,
.sheet-table td {
  border: 1px solid #9ca3af;
  padding: 4px 6px;
  vertical-align: top;
}

.sheet-table th {
  background: #e5e7eb;
  text-align: center;
  font-weight: 700;
  text-transform: none;
  letter-spacing: 0;
}

.sheet-label {
  display: block;
  font-size: 0.55rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #6b7280;
  font-weight: 700;
  margin-bottom: 1px;
}

.sheet-section-title {
  background: #e5e7eb;
  text-align: center;
  font-weight: 700;
  padding: 4px 6px;
  border: 1px solid #9ca3af;
}
```

- [ ] **Step 2: Build verifica**

Run: `npm run build`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style(sheet): refine sheet-table typography and borders"
```

---

### Task 8: StudentSheetView reescrita

**Files:**
- Modify: `src/components/students/student-sheet.tsx`

- [ ] **Step 1: Substituir arquivo inteiro**

```tsx
/* eslint-disable @next/next/no-img-element */
import { CheckSquare, Square } from "lucide-react";
import type { StudentSheet } from "@/lib/types";
import { dateFormat } from "@/lib/constants";

function text(value: unknown) {
  return value ? String(value) : "";
}

function date(value: string | null) {
  return value ? dateFormat.format(new Date(`${value}T00:00:00Z`)) : "";
}

function generatedAt(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function CheckBoxItem({ label, checked }: { label: string; checked: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      {checked ? <CheckSquare size={14} className="text-ink" /> : <Square size={14} className="text-ink/60" />}
      <span>{label}</span>
    </span>
  );
}

export function StudentSheetView({
  student,
  fotoSrc,
  geradoEm
}: {
  student: StudentSheet;
  fotoSrc?: string | null;
  geradoEm?: Date;
}) {
  const endereco = student.enderecos_aluno[0];
  const medica = student.informacoes_medicas;
  const autorizacoes = student.autorizacoes_aluno;
  const matriculasOrdenadas = [...student.matriculas].sort((a, b) => (b.data_matricula ?? "").localeCompare(a.data_matricula ?? ""));

  return (
    <div className="mx-auto max-w-[900px] bg-white p-4 shadow-soft">
      <header className="mb-3 border-b border-ink/30 pb-2 text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-ink">CRM Escola</p>
        <p className="text-[0.65rem] text-muted">Goiânia / GO · Gerado em {generatedAt(geradoEm ?? new Date())}</p>
        <h1 className="mt-2 text-lg font-black text-ink">Ficha do Aluno</h1>
      </header>

      <table className="sheet-table">
        <tbody>
          <tr>
            <th colSpan={6}>Dados do Aluno</th>
          </tr>
          <tr>
            <td rowSpan={7} className="w-[125px] text-center">
              {fotoSrc ? (
                <img src={fotoSrc} alt={student.nome} width={105} height={135} className="mx-auto object-cover" />
              ) : (
                <div className="mx-auto grid h-[135px] w-[105px] place-items-center border border-black bg-gray-100 text-[9px]">Foto</div>
              )}
            </td>
            <td><span className="sheet-label">Matrícula</span>{student.matricula_codigo}</td>
            <td colSpan={4}><span className="sheet-label">Nome</span>{student.nome}</td>
          </tr>
          <tr>
            <td><span className="sheet-label">Sexo</span>{text(student.sexo)}</td>
            <td><span className="sheet-label">Dt. Nascimento</span>{date(student.data_nascimento)}</td>
            <td colSpan={3}><span className="sheet-label">Celular</span>{text(student.celular)}</td>
          </tr>
          <tr>
            <td><span className="sheet-label">Naturalidade</span>{text(student.naturalidade)}</td>
            <td colSpan={4}></td>
          </tr>
          <tr>
            <td colSpan={5}><span className="sheet-label">Endereço</span>{text(endereco?.logradouro)}</td>
          </tr>
          <tr>
            <td><span className="sheet-label">Cidade</span>{text(endereco?.cidade)}{endereco?.uf ? `-${endereco.uf}` : ""}</td>
            <td><span className="sheet-label">CEP</span>{text(endereco?.cep)}</td>
            <td colSpan={3}></td>
          </tr>
          <tr>
            <td><span className="sheet-label">CPF</span>{text(student.cpf)}</td>
            <td><span className="sheet-label">RG</span>{text(student.rg)}</td>
            <td colSpan={3}></td>
          </tr>
          <tr>
            <td colSpan={2}><span className="sheet-label">Certidão Nasc.</span>Livro: {text(student.certidao_livro)} Folha: {text(student.certidao_folha)} Nº: {text(student.certidao_numero)} Cartório: {text(student.certidao_cartorio)}</td>
            <td colSpan={2}><span className="sheet-label">Disciplina Eletiva</span>{text(student.disciplina_eletiva)}</td>
            <td><span className="sheet-label">Cód. INEP</span>{text(student.codigo_inep)}</td>
          </tr>
          <tr>
            <td colSpan={3}><span className="sheet-label">E-Mail</span>{text(student.email)}</td>
            <td colSpan={3}><span className="sheet-label">Etnia</span>{text(student.etnia)}</td>
          </tr>
          <tr>
            <td colSpan={6}><span className="sheet-label">Informações Adicionais</span>{text(student.informacoes_adicionais)}</td>
          </tr>
        </tbody>
      </table>

      <div className="h-3" />

      <table className="sheet-table">
        <tbody>
          <tr><th colSpan={3}>Telefones de Contato</th></tr>
          {student.contatos_aluno.length === 0 ? (
            <tr><td colSpan={3} className="text-muted">—</td></tr>
          ) : student.contatos_aluno.map((item) => (
            <tr key={item.id}>
              <td>{item.nome}</td>
              <td>{text(item.celular || item.telefone)}</td>
              <td>{text(item.parentesco)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="h-3" />

      <table className="sheet-table">
        <thead>
          <tr><th colSpan={6}>Responsáveis do Aluno</th></tr>
          <tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Celular</th><th>Parentesco</th><th>E-Mail</th></tr>
        </thead>
        <tbody>
          {student.responsaveis_aluno.length === 0 ? (
            <tr><td colSpan={6} className="text-muted">—</td></tr>
          ) : student.responsaveis_aluno.map((item) => (
            <tr key={item.id}>
              <td>{item.nome}</td>
              <td>{text(item.cpf)}</td>
              <td>{text(item.telefone)}</td>
              <td>{text(item.celular)}</td>
              <td>{text(item.parentesco)}</td>
              <td>{text(item.email)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="h-3" />

      <table className="sheet-table">
        <thead>
          <tr><th colSpan={6}>Relação de Matrículas</th></tr>
          <tr><th>Ano</th><th>Série</th><th>Turma</th><th>Data Matrícula</th><th>Idade na Matrícula</th><th>Status</th></tr>
        </thead>
        <tbody>
          {matriculasOrdenadas.length === 0 ? (
            <tr><td colSpan={6} className="text-muted">—</td></tr>
          ) : matriculasOrdenadas.map((item) => (
            <tr key={item.id}>
              <td className="text-center">{text(item.ano_letivo)}</td>
              <td>{text(item.series?.nome)}</td>
              <td className="text-center">{text(item.turmas?.nome)}</td>
              <td className="text-center">{date(item.data_matricula)}</td>
              <td className="text-center">{text(item.idade_na_matricula)}</td>
              <td className="text-center">{text(item.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="h-3" />

      <table className="sheet-table">
        <thead>
          <tr><th colSpan={3}>Pessoas Autorizadas a Buscar o Aluno</th></tr>
          <tr><th>Nome</th><th>Telefone</th><th>Obs</th></tr>
        </thead>
        <tbody>
          {student.pessoas_autorizadas.length === 0 ? (
            <tr><td colSpan={3} className="text-muted">—</td></tr>
          ) : student.pessoas_autorizadas.map((item) => (
            <tr key={item.id}>
              <td>{item.nome}</td>
              <td>{text(item.telefone)}</td>
              <td>{text(item.observacao)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="h-3" />

      <table className="sheet-table">
        <tbody>
          <tr><th colSpan={4}>Informações Médicas</th></tr>
          <tr>
            <td colSpan={4}>
              <div className="grid grid-cols-2 gap-1 md:grid-cols-4">
                <CheckBoxItem label="Alergia" checked={medica?.alergia ?? false} />
                <CheckBoxItem label="Portador Nec. Especiais" checked={medica?.necessidade_especial ?? false} />
                <CheckBoxItem label="Nec. Apoio/Recurso" checked={medica?.necessita_apoio ?? false} />
                <CheckBoxItem label="Possui Doença Grave" checked={medica?.doenca_grave ?? false} />
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1">
                <CheckBoxItem label="Algum Remédio Especial" checked={medica?.remedio_especial ?? false} />
                <span>Tipo Sanguíneo: {text(medica?.tipo_sanguineo)}</span>
              </div>
            </td>
          </tr>
          <tr>
            <td><span className="sheet-label">Médico</span>{text(medica?.medico)}</td>
            <td><span className="sheet-label">Telefone</span>{text(medica?.telefone_medico)}</td>
            <td><span className="sheet-label">Plano de Saúde</span>{text(medica?.plano_saude)}</td>
            <td><span className="sheet-label">Telefone Plano</span>{text(medica?.telefone_plano)}</td>
          </tr>
        </tbody>
      </table>

      <div className="h-3" />

      <table className="sheet-table">
        <tbody>
          <tr><th>Autorizações do Aluno</th></tr>
          <tr><td><strong>O aluno está autorizado a:</strong></td></tr>
          <tr><td><CheckBoxItem label="Na entrega do boletim, a assinar o canhoto" checked={autorizacoes?.nao_entregar_boletim ?? false} /></td></tr>
          <tr><td><CheckBoxItem label="Assinar todos os comunicados enviados aos pais" checked={autorizacoes?.assinar_comunicados ?? false} /></td></tr>
          <tr><td><CheckBoxItem label="Quando necessário, requerer prova substitutiva na secretaria" checked={autorizacoes?.requerer_prova_substitutiva ?? false} /></td></tr>
        </tbody>
      </table>
    </div>
  );
}
```

Removeu:
- Bloco "Atributos Adicionais".
- Bloco "Historico Completo de Matriculas" duplicado.
- Renderização ASCII de checkboxes.

Adicionou:
- Cabeçalho RRB com timestamp.
- Campo `Disciplina Eletiva` no bloco "Dados do Aluno".
- 6 colunas em "Relação de Matrículas".
- Checkboxes visuais via lucide.
- Ordenação `data_matricula desc` runtime.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/components/students/student-sheet.tsx
git commit -m "feat(students): rewrite StudentSheetView to match original PDF layout"
```

---

### Task 9: page passa geradoEm prop

**Files:**
- Modify: `src/app/(app)/alunos/[id]/page.tsx`

- [ ] **Step 1: Localizar `<StudentSheetView>` e passar prop**

Find:
```tsx
<StudentSheetView student={student} fotoSrc={fotoSrc} />
```

Replace with:
```tsx
<StudentSheetView student={student} fotoSrc={fotoSrc} geradoEm={new Date()} />
```

- [ ] **Step 2: Typecheck + build**

Run: `npm run typecheck`
Run: `npm run build`
Expected: ambos passam.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/alunos/[id]/page.tsx"
git commit -m "feat(students): pass generation timestamp to student sheet"
```

---

## Fase 4 — Verificação

### Task 10: Verificação automática + checklist manual

- [ ] **Step 1: Build, typecheck, lint**

Run:
```
npm run typecheck
npm run lint
npm run build
```
Expected: clean.

- [ ] **Step 2: Reset DB + seed**

Run: `npx supabase db reset`
Run: `npm run seed:auth`
Expected: clean.

- [ ] **Step 3: Smoke manual**

(Manual — user valida.)

- Logar como admin.
- Abrir `/alunos/[id]/editar`. Ver campo "Disciplina eletiva". Preencher e salvar.
- Abrir `/alunos/[id]`. Ver:
  - [ ] Cabeçalho "CRM Escola" + timestamp.
  - [ ] Bloco "Dados do Aluno" com campo "Disciplina Eletiva" preenchido.
  - [ ] "Relação de Matrículas" com 6 colunas (Ano/Série/Turma/Data/Idade/Status).
  - [ ] Sem "Histórico Completo de Matrículas".
  - [ ] Sem "Atributos Adicionais".
  - [ ] Checkboxes visuais (ícones) em "Informações Médicas" e "Autorizações".
  - [ ] Foto renderiza ou placeholder.
- Abrir `/alunos/novo`. Campo "Disciplina eletiva" presente. Criar aluno com valor preenchido. Confirmar persistência.

- [ ] **Step 4: Commit fechamento**

```bash
git commit --allow-empty -m "chore: ficha aluno sub-spec 1 implementation complete"
```

---

## Fora de escopo

Próximos sub-specs:

- **Sub-spec 2:** PDF export refeito espelhando este HTML (com foto e cabeçalho RRB).
- **Sub-spec 3:** Import massa do PDF grande (parser + persistência da foto).
