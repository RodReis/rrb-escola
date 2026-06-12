# Ficha do Aluno — Sub-spec 1: Visual HTML

**Data:** 2026-05-15
**Status:** Aprovado (aguardando revisão final)
**Escopo:** Primeiro dos 3 sub-projetos de "Ficha do Aluno" (item 2 do roadmap). Refaz `<StudentSheetView>` para aderir ao modelo PDF original da escola, adiciona campo `disciplina_eletiva`, ajusta forms.

## Decomposição

| Sub-spec | Conteúdo |
|----------|----------|
| **1. Visual HTML (este)** | Ficha em tela fiel ao modelo, schema `disciplina_eletiva`, forms |
| 2. PDF export | `exportStudentButton` reescrito espelhando o HTML, com foto |
| 3. Import massa PDF | Parser do PDF grande (~362 alunos), persistência da foto recortada |

## Contexto

Modelo PDF original (`docs/pdfs/Resultado.pdf`, ~362 fichas) tem layout tabular tipo formulário:

```
RENOVAÇÃO DE RECONHECIMENTO, RESOLUÇÃO CEE/CEB Nº 518/2024
DD/MM/YYYY HH:MM
Ficha do Aluno
─────────────────────────────────────────
Dados do Aluno
[foto] Matrícula | Nome
       Sexo | Dt. Nasc. | Celular
       Naturalidade
       Endereço (linha inteira)
       Cidade | CEP
       CPF | RG
       Certidão | Disciplina Eletiva | Cód. INEP
       E-Mail | Etnia
       Informações Adicionais
─────────────────────────────────────────
Telefones de Contato
Nome | Telefone | Parentesco
─────────────────────────────────────────
Responsáveis do Aluno
Nome | CPF | Telefone | Celular | Parentesco | Email
─────────────────────────────────────────
Relação de Matrículas
Série | Turma | Data Matrícula | Idade na Matrícula
─────────────────────────────────────────
Atributos Adicionais (vazio no PDF)
─────────────────────────────────────────
Pessoas Autorizadas a Buscar o Aluno
Nome | Telefone | Obs
─────────────────────────────────────────
Informações Médicas
( ) Alergia ( ) Nec. Especiais ( ) Apoio ( ) Doença Grave ( ) Remédio
Tipo Sanguíneo: __
Médico | Telefone | Plano | Telefone Plano
─────────────────────────────────────────
Autorizações do Aluno
( ) Boletim — canhoto
( ) Comunicados aos pais
( ) Prova substitutiva
─────────────────────────────────────────
Escolar Manager Softwares (rodapé)
```

Estado atual (`<StudentSheetView>`):

- Tem maioria das seções.
- Tem bloco "Histórico Completo de Matrículas" duplicado (não consta no modelo).
- Não tem cabeçalho institucional.
- Não tem campo "Disciplina Eletiva" (schema também não tem).
- Checkboxes médicas/autorizações em ASCII `( X )` / `(  )`.

## Decisões

| # | Tema | Decisão |
|---|------|---------|
| 0 | Decomposição | 3 sub-specs sequenciais. Este = sub-spec 1. |
| 1 | Foto | Persistência da foto fica para sub-spec 3 (extração do PDF). Sub-spec 1 só renderiza foto existente. |
| 2 | Cabeçalho/Disciplina Eletiva/histórico | Cabeçalho RRB próprio (não Escolar Manager). Disciplina Eletiva adicionada ao schema. Histórico duplicado removido. |
| 3 | Atributos Adicionais | Seção omitida (sempre vazia no modelo). |
| 4 | Relação de Matrículas | 6 colunas: Ano / Série / Turma / Data Matrícula / Idade na Matrícula / Status. |
| 5 | Tipografia | Híbrido: layout tabular fiel ao modelo, fontes do design system Lectiva. |
| 6 | Form | Campo `disciplina_eletiva` em `<StudentForm>` e `<StudentEditForm>`. |
| 7 | Checkboxes | Visuais via lucide (`CheckSquare` / `Square`). |

## Schema

Migration: `supabase/migrations/202605190001_disciplina_eletiva.sql`.

```sql
alter table alunos
  add column if not exists disciplina_eletiva text;
```

Coluna nullable. Sem impacto em fichas existentes.

## Componente `<StudentSheetView>` — refactor

`src/components/students/student-sheet.tsx` reescrito.

### Props

```ts
type Props = {
  student: StudentSheet;
  fotoSrc?: string | null;
  geradoEm?: Date;
};
```

### Header

```tsx
<header className="mb-3 border-b border-ink/30 pb-2 text-center">
  <p className="text-xs font-bold uppercase tracking-wide">CRM Escola</p>
  <p className="text-[0.65rem] text-muted">
    Goiânia / GO · Gerado em {format(geradoEm ?? new Date(), "dd/MM/yyyy HH:mm", { timeZone: "America/Sao_Paulo" })}
  </p>
  <h1 className="mt-2 text-lg font-black">Ficha do Aluno</h1>
</header>
```

### Bloco "Dados do Aluno"

Tabela 6 colunas (foto ocupa rowSpan=7 na primeira coluna):

| Linha | Conteúdo |
|-------|----------|
| 1 | [foto rowSpan] · Matrícula · Nome (colSpan=4) |
| 2 | Sexo · Dt. Nascimento · Celular (colSpan=3) |
| 3 | Naturalidade · (4 cols vazios) |
| 4 | Endereço (colSpan=5) |
| 5 | Cidade · CEP · (3 cols vazios) |
| 6 | CPF · RG · (3 cols vazios) |
| 7 | Certidão Nasc. (colSpan=2) · **Disciplina Eletiva** (colSpan=2) · Cód. INEP |
| 8 | E-Mail (colSpan=3) · Etnia (colSpan=3) |
| 9 | Informações Adicionais (colSpan=6) |

### Bloco "Telefones de Contato"

Tabela 3 colunas: Nome / Telefone / Parentesco. Renderiza `student.contatos_aluno`.

### Bloco "Responsáveis do Aluno"

Tabela 6 colunas: Nome / CPF / Telefone / Celular / Parentesco / E-Mail. Renderiza `student.responsaveis_aluno`.

### Bloco "Relação de Matrículas"

Tabela 6 colunas: Ano Letivo / Série / Turma / Data Matrícula / Idade na Matrícula / Status. Renderiza `student.matriculas` ordenado por `data_matricula desc`.

### Bloco "Pessoas Autorizadas a Buscar o Aluno"

Tabela 3 colunas: Nome / Telefone / Obs. Renderiza `student.pessoas_autorizadas`.

### Bloco "Informações Médicas"

```tsx
<section>
  <h2>Informações Médicas</h2>
  <div className="grid grid-cols-4 gap-2">
    <CheckBoxItem label="Alergia" checked={medica?.alergia ?? false} />
    <CheckBoxItem label="Portador Nec. Especiais" checked={medica?.necessidade_especial ?? false} />
    <CheckBoxItem label="Nec. Apoio/Recurso" checked={medica?.necessita_apoio ?? false} />
    <CheckBoxItem label="Possui Doença Grave" checked={medica?.doenca_grave ?? false} />
  </div>
  <div className="grid grid-cols-2 gap-2 mt-1">
    <CheckBoxItem label="Algum Remédio Especial" checked={medica?.remedio_especial ?? false} />
    <span>Tipo Sanguíneo: {medica?.tipo_sanguineo ?? ""}</span>
  </div>
  <table className="sheet-table mt-2">
    <tr><td>Médico: ...</td><td>Telefone: ...</td><td>Plano de Saúde: ...</td><td>Telefone Plano: ...</td></tr>
  </table>
</section>
```

### Bloco "Autorizações do Aluno"

3 itens com checkbox visual:

- Na entrega do boletim, a assinar o canhoto (`autorizacoes?.nao_entregar_boletim`)
- Assinar todos os comunicados enviados aos pais (`autorizacoes?.assinar_comunicados`)
- Quando necessário, requerer prova substitutiva na secretaria (`autorizacoes?.requerer_prova_substitutiva`)

### Componente `<CheckBoxItem>`

```tsx
import { CheckSquare, Square } from "lucide-react";

function CheckBoxItem({ label, checked }: { label: string; checked: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      {checked ? <CheckSquare size={14} /> : <Square size={14} />}
      <span>{label}</span>
    </span>
  );
}
```

### CSS `.sheet-table`

Atualizar em `src/app/globals.css`:

```css
.sheet-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
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
```

## Forms

### `src/components/students/student-form.tsx`

Adicionar campo próximo a `informacoes_adicionais`:

```tsx
<label className="md:col-span-2">
  Disciplina eletiva
  <input name="disciplina_eletiva" />
</label>
```

### `src/components/students/student-edit-form.tsx`

Idem, com `defaultValue={student.disciplina_eletiva ?? ""}`.

### Server actions

`src/lib/actions/students.ts`:

- `createStudentAction`: incluir `disciplina_eletiva: formText(formData, "disciplina_eletiva")` no insert.
- `updateStudentAction`: incluir no update.

## Tipos

`src/lib/types.ts` — adicionar à interface `StudentSheet`:

```ts
disciplina_eletiva: string | null;
```

Verificar se existe interface `Student` separada — adicionar lá também se sim.

## Data fetcher

`src/lib/data/students.ts` — `getStudentSheet`:

- Adicionar `disciplina_eletiva` ao select (ou usar `*` que já cobre).
- Garantir matrículas ordenadas: `matriculas(...)` com `order: { column: "data_matricula", ascending: false }`. Se o Supabase select aninhado não suportar order embedded, ordenar em runtime no componente.

## Integração `/alunos/[id]/page.tsx`

Já usa `<StudentSheetView>`. Trocar para:

```tsx
<StudentSheetView student={student} fotoSrc={fotoSrc} geradoEm={new Date()} />
```

## Tratamento de erros

- Migration idempotente.
- `disciplina_eletiva` nullable — fichas existentes não quebram.
- Foto ausente: placeholder "Foto" (já existe).
- Matrícula sem série/turma: célula vazia.

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| CSS `.sheet-table` afeta outras tabelas | Classe usada só em StudentSheetView; grep confirma. |
| Re-render mostra timestamp diferente cada request | Esperado (timestamp de geração). |
| Foto signed URL expira | Helper `getSignedFotoUrl` TTL 1h. Placeholder fallback. |
| Matrículas em ordem aleatória | `order data_matricula desc` no fetcher. |
| Form não envia campo | `formText` retorna null → coluna aceita null. |

## Checklist de verificação manual

- [ ] `npm run typecheck` + `npm run build` + `npm run lint` passam
- [ ] Migration aplica clean
- [ ] Coluna `disciplina_eletiva` existe
- [ ] Form de criar aluno tem campo e salva
- [ ] Form de editar aluno tem campo e salva
- [ ] `/alunos/[id]` mostra cabeçalho RRB com data/hora geração
- [ ] Bloco "Dados do Aluno" tem todos campos do modelo (incluindo Disciplina Eletiva)
- [ ] Foto renderiza (signed URL) com placeholder fallback
- [ ] "Relação de Matrículas" mostra 6 colunas, ordenado data desc
- [ ] "Histórico Completo de Matrículas" não aparece mais
- [ ] "Atributos Adicionais" não aparece
- [ ] Checkboxes médicas/autorizações são ícones (não ASCII)
- [ ] Tipografia design system + layout fiel ao modelo
- [ ] Bordas tabela em cinza médio, header cinza claro

## Fora de escopo

Próximos sub-specs:

- **Sub-spec 2:** PDF export refeito (espelha HTML, inclui foto, cabeçalho RRB).
- **Sub-spec 3:** Import massa do PDF grande (parser + persistência da foto).
