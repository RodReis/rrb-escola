# Quick Document Actions na Ficha do Aluno

**Data:** 2026-05-18
**Branch:** feature-mvp2
**Status:** Design aprovado, aguardando implementação

## Problema

A geração de documentos hoje vive em `app/(app)/matriculas/[id]?tab=documentos` através do componente `DocumentGenerator`. Para a secretária — que opera o sistema diariamente — esse fluxo é caro:

1. Localizar aluno na lista de matrículas.
2. Abrir matrícula.
3. Mudar para tab "Documentos".
4. Escolher template, clicar gerar.

Dos seis templates disponíveis, apenas dois (contratos) são realmente usados em fluxo de matrícula (final/início de ano letivo, em lote). Os outros quatro (declarações de frequência e transferência, termos de responsabilidade) são solicitados o ano inteiro, com base no aluno e não na matrícula. O ponto de entrada natural da secretária para essas tarefas é a ficha do aluno, não a matrícula.

## Objetivo

Reduzir a geração dos documentos diários a **um clique** a partir da ficha do aluno. Manter o fluxo atual em `/matriculas/[id]?tab=documentos` como redundância intencional para o caso de uso em lote.

Para alunos recém-cadastrados (sem matrícula ativa), substituir os botões de documento por uma chamada para criar matrícula, já que esse é o próximo passo lógico no fluxo.

## Decisões de produto

| # | Pergunta | Decisão |
|---|----------|---------|
| 1 | Qual matrícula usar para gerar o doc? | Primeira matrícula com `status = "ativa"`. Se nenhuma, oculta a geração. |
| 2 | Pós-geração | Auto-download do `.docx` + toast de sucesso. |
| 3 | Tab "Documentos" em `/matriculas/[id]` | Mantida intacta (redundância). |
| 4 | Painel "Documentos anexados" | Gerados e enviados juntos, distinguidos por badge ("Gerado" verde / "Enviado" neutro) baseado em `tipo_documento`. |
| 5 | Sem matrícula ativa | CTA "➕ Matricular aluno" no lugar do bloco de doc gen. Linka para `/matriculas?aluno_id={id}`. |
| 6 | Sistema de toast | `sonner` (lib leve, ~3kb). Wrapper customizado para tema. |

## Layout (header da ficha)

```
[Voltar] [Boletim] [Editar]
+--------------------------------------------------+
| GERAR: [Decl. Frequência] [Decl. Transferência]  |
|        [Termo Resp.] [Mais ▾]                    |
+--------------------------------------------------+
```

**Botões rápidos (1 clique):**
- `declaracao_frequencia`
- `declaracao_transferencia`
- `termo_responsabilidade`

**Dropdown "Mais ▾":**
- `termo_responsabilidade_integrado`
- `contrato_pinguinho`
- `contrato_colegio`
- Separador
- Exportar ficha (PDF) — chama `ExportStudentButton` atual

**Sem matrícula ativa:**
```
[Voltar] [Boletim] [Editar]
+--------------------------------+
| [➕ Matricular aluno]          |
+--------------------------------+
```

## Arquitetura

### Componentes novos

**`src/components/students/quick-document-actions.tsx`** (client component)
- Props: `{ alunoId: string, matriculaAtiva: { id: string, codigo: string | null } | null }`
- Estado local: `loadingTipo: TipoTemplate | null`, `dropdownOpen: boolean`
- Se `matriculaAtiva == null`: renderiza só o link `/matriculas?aluno_id={alunoId}` como botão primário
- Se `matriculaAtiva != null`: renderiza bloco de 3 botões + dropdown
- Click handler:
  1. `setLoading(tipo)`
  2. `const res = await generateDocxAction(matriculaAtiva.id, tipo)`
  3. Sucesso: `downloadBase64Docx(res.base64, res.nomeArquivo)` + `toast.success(...)`
  4. Erro: `toast.error(res.error)`
  5. `setLoading(null)`

**`src/lib/documents/download-client.ts`** (util)
```ts
export function downloadBase64Docx(base64: string, nomeArquivo: string): void {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}
```

**`src/components/ui/toaster.tsx`**
- Re-export `<Toaster />` do sonner com cores do design (ink/moss/clay) via `theme` prop e `toastOptions`.

### Arquivos modificados

**`src/app/layout.tsx`**
- Adicionar `<Toaster />` global (logo antes de `</body>`).

**`src/app/(app)/alunos/[id]/page.tsx`**
- Calcular `const matriculaAtiva = student.matriculas.find(m => m.status === "ativa") ?? null;`
- Mapear para `{ id, codigo }` para passar à `QuickDocumentActions`
- Renderizar `<QuickDocumentActions alunoId={student.id} matriculaAtiva={...} />` no header
- Remover `<ExportStudentButton />` da posição atual (lado dos botões Voltar/Boletim/Editar) — passa a viver como último item do dropdown "Mais ▾" do `QuickDocumentActions`, separado dos templates por divisor visual

**`src/app/(app)/matriculas/page.tsx`**
- Aceitar `searchParams.aluno_id`
- Passar como `defaultValue` para `StudentCombobox` no painel "Nova matrícula"
- Adicionar `id="nova-matricula"` no `<Panel>` para servir como âncora de scroll
- Se `aluno_id` presente, fazer scroll automático (script inline ou `<a href="#nova-matricula">` redirecionado)

**`src/components/students/student-documents-panel.tsx`**
- Adicionar badge no card de cada documento:
  - `tipo_documento ∈ {"contrato", "declaracao", "termo"}` → `<Badge tone="green">Gerado</Badge>`
  - Outros (`certidao`, `cpf_rg`, `comprovante_endereco`, `documento_responsavel`, `outro`) → `<Badge tone="gray">Enviado</Badge>`

**`src/components/matriculas/document-generator.tsx`**
- Refatorar para chamar `downloadBase64Docx` em vez da lógica inline (mesma funcionalidade).

**`package.json`**
- `+ "sonner": "^1.7.0"` (ou versão atual estável).

### Inalterados (reuso)

- `src/lib/actions/documents-generate.ts` (`generateDocxAction`)
- `src/lib/documents/variables.ts`
- `src/lib/documents/templates.ts`
- `src/lib/documents/generator.ts`
- Tab "Documentos" em `/matriculas/[id]`

## Fluxo de dados

```
Ficha do aluno (/alunos/[id])
  │
  ├─ Server: getStudentSheet → student.matriculas
  ├─ Computa matriculaAtiva (first com status="ativa")
  │
  └─ <QuickDocumentActions matriculaAtiva={...}>
       │
       └─ click botão "Decl. Frequência"
            │
            ├─ generateDocxAction(matriculaAtiva.id, "declaracao_frequencia")
            │    │
            │    ├─ buildVariables(matriculaId) → DocumentVariables
            │    ├─ generateDocx(tipo, vars) → Buffer
            │    ├─ supabase.storage.upload → storagePath
            │    ├─ supabase.from("documentos_aluno").insert
            │    ├─ revalidatePath
            │    └─ return { success, base64, nomeArquivo }
            │
            ├─ downloadBase64Docx(base64, nomeArquivo)
            └─ toast.success("Documento gerado: ...")
```

## Edge cases

- **Aluno com dados incompletos** (sem responsável, sem endereço): `buildVariables` retorna strings vazias. Doc gera com lacunas. Comportamento atual mantido — sem nova validação.
- **Doc com mesmo nome no Storage**: `storagePath` já usa `Date.now()` como prefixo, evitando colisão.
- **Action falha**: rollback de Storage já implementado em `generateDocxAction`. Toast erro mostra mensagem retornada.
- **Múltiplos cliques rápidos**: botão fica `disabled` durante loading.
- **Múltiplas matrículas ativas**: usa a primeira retornada por `getStudentSheet` (ordem do array). Caso raro; aceitar.
- **`/matriculas?aluno_id=invalido`**: `StudentCombobox` aceita `defaultValue` não-encontrado silenciosamente. Sem 404.
- **Browser sem JS**: bloco não funciona. Aceitar — app inteiro depende de JS.

## Testing

Manual:
- [ ] Aluno com matrícula ativa: gerar cada um dos 6 templates. Cada um deve baixar `.docx` + mostrar toast + aparecer em "Documentos anexados" com badge "Gerado".
- [ ] Aluno sem matrícula: CTA "Matricular aluno" aparece. Clicar leva para `/matriculas?aluno_id=...` com combobox pré-selecionado.
- [ ] Aluno com 2 matrículas ativas: usa primeira (verificar comportamento de ordem).
- [ ] Tab "Documentos" em `/matriculas/[id]` continua funcionando idêntico (todos 6 templates).
- [ ] Painel "Documentos anexados" mostra badges corretos para uploads manuais ("Enviado") e gerados ("Gerado").
- [ ] Erro no servidor (simular): toast de erro aparece, botão volta ao normal.

Não há suíte de testes UI automatizada configurada no projeto.

## Fora de escopo

- Geração em lote de documentos (turma inteira, todas matrículas do ano).
- Templates novos além dos 6 existentes.
- Editor de templates inline.
- Versionamento ou histórico de revisões dos documentos gerados.
- Notificações por email/WhatsApp pós-geração.
