# Módulo de Templates de Documentos

**Data:** 2026-05-18
**Branch:** feature-mvp2
**Status:** Design aprovado, aguardando implementação
**Depende de:** `2026-05-18-quick-document-actions-design.md` (já implementado)

## Problema

Hoje os 6 templates de documentos (`contrato_colegio`, `contrato_pinguinho`, `declaracao_frequencia`, `declaracao_transferencia`, `termo_responsabilidade`, `termo_responsabilidade_integrado`) são estáticos:

- Arquivos `.docx` vivem em `public/templates/` no repo.
- O enum `TIPO_TEMPLATE` em `src/lib/documents/templates.ts` é a "lista" de templates disponíveis.
- O mapeamento de placeholders → dados está hardcoded em `src/lib/documents/variables.ts` (`buildVariables(matriculaId)`).

Para adicionar um novo template a secretária depende de desenvolvedor: editar templates.ts, adicionar variáveis ao `buildVariables`, fazer deploy. Inviável a longo prazo.

## Objetivo

Permitir que a secretária faça upload de um template `.docx`, mapeie os placeholders dele a campos do banco através de uma UI no módulo RH, e o template apareça automaticamente disponível para download na ficha do aluno — sem deploy.

Os 6 templates atuais migram para o novo sistema via seed; ficam indistinguíveis dos novos.

## Decisões de produto

| # | Pergunta | Decisão |
|---|----------|---------|
| 1 | Como descobrir placeholders do template? | Parse automático no upload via docxtemplater. |
| 2 | Catálogo de campos para mapear | Schema dinâmico (não catálogo fixo). |
| 3 | Escopo do schema | Allowlist de tabelas relacionadas ao aluno + funções computadas. |
| 4 | Relacionamentos com múltiplas linhas (pai/mãe/financeiro, endereço principal, matrícula ativa) | Mapping flexível: secretária escolhe tabela + coluna + critério de linha. |
| 5 | Posição na UI do aluno (quick vs dropdown) | Top 3 mais gerados (all-time, por escola) viram quick automaticamente. |
| 6 | Storage dos templates | Supabase Storage bucket privado + tabela `templates_documentos`. |
| 7 | Janela do ranking quick | All-time, escopo por `escola_id`. |
| 8 | Localização no menu | RH → "Documentos". |

## Schema dinâmico

### Allowlist de tabelas

`src/lib/documents/schema-catalog.ts`:

```ts
export const ALLOWED_TABLES = {
  alunos:               { columns: ["nome", "cpf", "rg", "data_nascimento", "sexo", "naturalidade", "email", "celular", "etnia", "codigo_inep", "informacoes_adicionais", "matricula_codigo"], filters: [] },
  responsaveis_aluno:   { columns: ["nome", "cpf", "rg", "celular", "telefone", "email", "parentesco", "profissao", "endereco_trabalho"], filters: ["pai", "mae", "financeiro", "first"] },
  enderecos_aluno:      { columns: ["logradouro", "numero", "complemento", "bairro", "cidade", "uf", "cep"], filters: ["principal", "first"] },
  contatos_aluno:       { columns: ["nome", "telefone", "email", "parentesco"], filters: ["first"] },
  informacoes_medicas:  { columns: ["alergia", "necessidade_especial", "medico", "telefone_medico", "plano_saude", "telefone_plano", "observacoes"], filters: [] },
  matriculas:           { columns: ["codigo", "ano_letivo", "data_matricula", "idade_na_matricula", "observacoes", "status"], filters: ["ativa", "ultima"] },
  series:               { columns: ["nome"], filters: [] },          // via matricula.serie_id
  turmas:               { columns: ["nome", "turno"], filters: [] }, // via matricula.turma_id
  planos:               { columns: ["nome", "valor"], filters: [] }, // via matricula.plano_id
  escolas:              { columns: ["nome"], filters: [] },          // via session.escola_id
};

export const COMPUTED_FNS = [
  "data_hoje_extenso",
  "cidade_data_extenso",
  "idade_atual",
  "ano_letivo_atual",
  "endereco_principal_formatado",         // join logradouro/numero/bairro/cidade/uf/cep
  "tipo_ensino_via_series_segmentos",     // series.segmentos.nome
];
```

### Tabela do banco

```sql
create table templates_documentos (
  id            uuid primary key default gen_random_uuid(),
  escola_id     uuid not null references escolas(id),
  nome          text not null,
  categoria     text not null check (categoria in ('declaracao','termo','contrato','outro')),
  storage_path  text not null,
  ativo         boolean not null default true,
  gerado_count  integer not null default 0,
  mappings      jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on templates_documentos (escola_id, ativo);
create index on templates_documentos (escola_id, gerado_count desc);

alter table templates_documentos enable row level security;

create policy "templates_select_own_escola" on templates_documentos
  for select using (escola_id = (select escola_id from profiles where id = auth.uid()));
create policy "templates_modify_own_escola" on templates_documentos
  for all using (escola_id = (select escola_id from profiles where id = auth.uid()));
```

### Formato `mappings` (jsonb)

Array de objetos. Cada objeto descreve como resolver UM placeholder do template:

```jsonc
[
  // valor vindo de uma tabela
  {
    "placeholder": "NOME_ALUNO",
    "type": "tabela",
    "table": "alunos",
    "column": "nome",
    "filter": null
  },
  // valor vindo de tabela com múltiplas linhas, com filtro
  {
    "placeholder": "CPF_RESP",
    "type": "tabela",
    "table": "responsaveis_aluno",
    "column": "cpf",
    "filter": "financeiro"
  },
  // valor computado
  {
    "placeholder": "DATA_HOJE_EXTENSO",
    "type": "computed",
    "fn": "data_hoje_extenso"
  }
]
```

Validação no servidor antes de salvar:
- `table` deve estar em `ALLOWED_TABLES`.
- `column` deve estar em `ALLOWED_TABLES[table].columns`.
- `filter` (se presente) deve estar em `ALLOWED_TABLES[table].filters`.
- `fn` deve estar em `COMPUTED_FNS`.

Mapping inválido cai com erro de validação no save action.

### Storage

Bucket privado `templates-documentos`. Path: `<escola_id>/templates/<template_id>.docx`. Bucket separado de `documentos-alunos` (templates não são documentos finais).

## UI

### Menu RH

`src/components/layout/rh-dropdown.tsx` ganha mais um item:

```ts
{ href: "/rh/documentos", label: "Documentos", icon: FileText }
```

Posicionado entre "Brackets" e o fim do menu.

### Lista de templates — `/rh/documentos`

```
Documentos                                                [+ Novo template]

Filtros: [Categoria ▾]  [Status ▾]

Nome                          Categoria    Gerados   Status    Ações
─────────────────────────────────────────────────────────────────────────
Declaração de Frequência      declaração   1.247     Ativo     [Editar][Desativar]
Termo de Responsabilidade     termo        823       Ativo     [Editar][Desativar]
Contrato Pinguinho            contrato     156       Ativo     [Editar][Desativar]
Declaração de Matrícula 2027  declaração   0         Rascunho  [Editar][Excluir]
```

- Sort default: `gerado_count desc`.
- Linha "Rascunho" = template criado mas mappings vazios (ainda não terminou de configurar).
- "Excluir" só habilitado se `gerado_count = 0`. Senão só "Desativar".

### Wizard upload — `/rh/documentos/novo`

**Step 1: metadata + arquivo**

```
Novo template

[Arquivo .docx]    [escolher arquivo]   contrato-uniforme.docx
[Nome]             Contrato de Uniforme
[Categoria]        ▾ declaracao | termo | contrato | outro

                                                [Cancelar] [Próximo]
```

Validação no submit:
- Extensão `.docx`
- MIME `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Tamanho ≤ 5 MB
- Nome ≥ 3 chars

Submit → `uploadTemplateAction`:
1. Valida.
2. Upload `.docx` pro Storage em `<escola_id>/templates/<new_uuid>.docx`.
3. Parse placeholders via docxtemplater.
4. Insere row em `templates_documentos` com `mappings = []`, retorna `templateId`.
5. Redirect pra `/rh/documentos/<templateId>/mapeamento`.

**Step 2: mapeamento — `/rh/documentos/[id]/mapeamento`**

```
Mapeamento — Contrato de Uniforme

5 placeholders detectados no template.

Placeholder            Tipo        Origem
──────────────────────────────────────────────────────────────────
NOME_ALUNO             [tabela ▾]  Tabela [alunos ▾] Coluna [nome ▾]
CPF_RESP               [tabela ▾]  Tabela [responsaveis_aluno ▾] Coluna [cpf ▾] Filtro [financeiro ▾]
ENDERECO_RESP          [tabela ▾]  Tabela [enderecos_aluno ▾] Coluna [logradouro ▾] Filtro [principal ▾]
ANO_LETIVO             [tabela ▾]  Tabela [matriculas ▾] Coluna [ano_letivo ▾] Filtro [ativa ▾]
DATA_HOJE_EXTENSO      [computado ▾] Função [data_hoje_extenso ▾]

                                          [Cancelar] [Salvar e ativar]
```

Cada linha é um sub-form. "Tipo" dropdown: `tabela` ou `computado`. Mudar tipo troca os campos visíveis.

Salvar → `saveTemplateMappingsAction`:
1. Valida mappings (allowlist).
2. Update row `mappings` + `ativo=true`.
3. Redirect pra `/rh/documentos`.

### Edit — `/rh/documentos/[id]`

Mesmo form do mapeamento + cabeçalho com nome/categoria/ativo editáveis + botão Excluir.

## Resolução de mappings (runtime)

`generateFromTemplateAction(matriculaId, templateId)`:

1. Busca `templates_documentos` por id, verifica `escola_id = session.escola_id`.
2. Busca matrícula → `aluno_id`, `serie_id`, `turma_id`, `plano_id`, `escola_id`.
3. **Resolução de mappings**, agrupada por tabela:
   - Para cada tabela presente nos mappings, faz UMA query Supabase com colunas necessárias.
   - Pra `alunos`: `eq id, aluno_id`.
   - Pra `responsaveis_aluno`, `enderecos_aluno`, `contatos_aluno`, `informacoes_medicas`: `eq aluno_id, aluno_id`.
   - Pra `matriculas`: `eq id, matricula_id`.
   - Pra `series`, `turmas`, `planos`: `eq id, matricula.serie_id/turma_id/plano_id`.
   - Pra `escolas`: `eq id, escola_id`.
4. Pra cada mapping, seleciona a linha aplicando o filtro:
   - `pai` → `parentesco IN ('pai','padrasto')` case-insensitive.
   - `mae` → `parentesco IN ('mae','mãe','madrasta')` case-insensitive.
   - `financeiro` → `responsavel_financeiro = true`.
   - `principal` → `principal = true`.
   - `ativa` → `status = 'ativa'`.
   - `ultima` → sort by `created_at desc`, primeira.
   - `first` ou `null` → primeira linha do resultado.
   - Linha não encontrada → valor = `""`.
5. Pra mappings `computed`, chama a função correspondente:
   - `data_hoje_extenso` → `"5 de maio de 2026"` (já existe em `variables.ts`).
   - `cidade_data_extenso` → `"Trindade, 5 de maio de 2026"` (cidade da escola).
   - `idade_atual` → calcula a partir de `aluno.data_nascimento`.
   - `ano_letivo_atual` → `String(new Date().getFullYear())`.
6. Constrói `Record<placeholder, string>` final.
7. Gera `.docx` via docxtemplater (`generateDocx` existente continua igual, recebe variables genéricas).
8. Upload + insert `documentos_aluno` (igual à action atual).
9. `update templates_documentos set gerado_count = gerado_count + 1 where id = templateId`.
10. Retorna `{base64, nomeArquivo}`.

Erros não-fatais (mapping inválido, coluna inexistente) → substitui por `""` e loga.

## Refactor da geração existente

**Server actions:**
- Cria `src/lib/actions/documents-generate-v2.ts` com `generateFromTemplateAction(matriculaId, templateId)`.
- `generateDocxAction(matriculaId, tipoTemplate)` em `documents-generate.ts` é removida após o seed e os call-sites migrarem.

**Componentes:**
- `QuickDocumentActions` (ficha aluno):
  - Antes: `QUICK` e `MORE` arrays hardcoded com tipos do enum.
  - Depois: recebe prop `templates: TemplateRow[]`. Top 3 por `gerado_count` = QUICK; resto = MORE.
  - Chama `generateFromTemplateAction(matriculaId, template.id)` em vez de `generateDocxAction`.
- `src/app/(app)/alunos/[id]/page.tsx`: carrega `getTemplatesAtivos(escolaId)` no server, passa pro `StudentHeaderActions` → `QuickDocumentActions`.
- `StudentHeaderActions`: propaga prop `templates`.
- `DocumentGenerator` (tab matrículas):
  - Antes: dropdown lê de `TEMPLATE_META`.
  - Depois: dropdown lê da mesma fonte (templates ativos), chama nova action.

## Migração

### Bucket Storage

Manual no painel do Supabase (ou via migration): bucket `templates-documentos`, privado.

### Migration SQL

`supabase/migrations/<ts>_templates_documentos.sql`: cria a tabela + indexes + RLS.

### Seed dos 6 templates atuais

`scripts/seed_templates.mjs`:

1. Para cada escola registrada (ou só a default em ambiente dev):
2. Para cada template em `public/templates/*.docx`:
   - Lê o arquivo.
   - Upload pro Storage no path `<escola_id>/templates/<new_uuid>.docx`.
   - Insere row em `templates_documentos`:
     - `nome` = label do `TEMPLATE_META` atual.
     - `categoria` = `tipoDocumento` do `TEMPLATE_META`.
     - `mappings` = jsonb predefinido para esse template (espelhando `buildVariables` atual).
     - `ativo = true`.

Mappings de seed (idênticos pros 6 templates, derivados de `buildVariables`):

```jsonc
[
  { "placeholder": "NOME_ALUNO", "type": "tabela", "table": "alunos", "column": "nome", "filter": null },
  { "placeholder": "SERIE_ALUNO", "type": "tabela", "table": "series", "column": "nome", "filter": null },
  { "placeholder": "TURNO_ALUNO", "type": "tabela", "table": "turmas", "column": "turno", "filter": null },
  { "placeholder": "ANO_LETIVO", "type": "tabela", "table": "matriculas", "column": "ano_letivo", "filter": "ativa" },

  { "placeholder": "NOME_PAI_ALUNO", "type": "tabela", "table": "responsaveis_aluno", "column": "nome", "filter": "pai" },
  { "placeholder": "RG_PAI_ALUNO", "type": "tabela", "table": "responsaveis_aluno", "column": "rg", "filter": "pai" },
  { "placeholder": "CPF_PAI_ALUNO", "type": "tabela", "table": "responsaveis_aluno", "column": "cpf", "filter": "pai" },

  { "placeholder": "NOME_MAE_ALUNO", "type": "tabela", "table": "responsaveis_aluno", "column": "nome", "filter": "mae" },
  { "placeholder": "RG_MAE_ALUNO", "type": "tabela", "table": "responsaveis_aluno", "column": "rg", "filter": "mae" },
  { "placeholder": "CPF_MAE_ALUNO", "type": "tabela", "table": "responsaveis_aluno", "column": "cpf", "filter": "mae" },

  { "placeholder": "NOME_RESP", "type": "tabela", "table": "responsaveis_aluno", "column": "nome", "filter": "financeiro" },
  { "placeholder": "CPF_RESP", "type": "tabela", "table": "responsaveis_aluno", "column": "cpf", "filter": "financeiro" },
  { "placeholder": "RG_RESP", "type": "tabela", "table": "responsaveis_aluno", "column": "rg", "filter": "financeiro" },
  { "placeholder": "EMAIL_RESPONSAVEL", "type": "tabela", "table": "responsaveis_aluno", "column": "email", "filter": "financeiro" },
  { "placeholder": "CELULAR_RESPONSAVEL", "type": "tabela", "table": "responsaveis_aluno", "column": "celular", "filter": "financeiro" },

  { "placeholder": "TIPOENSINO_ALUNO", "type": "computed", "fn": "tipo_ensino_via_series_segmentos" },
  { "placeholder": "ENDERECO_PAI_ALUNO", "type": "computed", "fn": "endereco_principal_formatado" },
  { "placeholder": "ENDERECO_MAE_ALUNO", "type": "computed", "fn": "endereco_principal_formatado" },
  { "placeholder": "ENDERECO_RESP", "type": "computed", "fn": "endereco_principal_formatado" },

  { "placeholder": "RAZAO_SOCIAL_EMPRESA", "type": "tabela", "table": "escolas", "column": "nome", "filter": null },
  { "placeholder": "FANTASIA_EMPRESA", "type": "tabela", "table": "escolas", "column": "nome", "filter": null },

  { "placeholder": "CIDADE_DATA_EXTENSO", "type": "computed", "fn": "cidade_data_extenso" },
  { "placeholder": "DATA_HOJE_EXTENSO", "type": "computed", "fn": "data_hoje_extenso" }
]
```

(Funções computadas `endereco_principal_formatado` e `tipo_ensino_via_series_segmentos` ficam em `schema-catalog.ts`, expostas em `COMPUTED_FNS`.)

### Ordem de deploy

1. Migration + bucket criados.
2. Seed roda (1 vez por ambiente, idempotente).
3. Deploy do código novo (resolver + actions + componentes refatorados).
4. Cleanup commit: deleta `templates.ts` antigo, `variables.ts` antigo, `documents-generate.ts` antigo, `public/templates/*.docx`.

## Arquivos

### Novos

- `supabase/migrations/<ts>_templates_documentos.sql`
- `scripts/seed_templates.mjs`
- `src/lib/documents/schema-catalog.ts`
- `src/lib/documents/resolver.ts`
- `src/lib/data/templates.ts` (`getTemplatesAtivos`, `getTemplate`, `getTemplateById`)
- `src/lib/actions/templates.ts`
- `src/lib/actions/documents-generate-v2.ts`
- `src/app/(app)/rh/documentos/page.tsx`
- `src/app/(app)/rh/documentos/novo/page.tsx`
- `src/app/(app)/rh/documentos/[id]/page.tsx`
- `src/app/(app)/rh/documentos/[id]/mapeamento/page.tsx`
- `src/components/rh/documentos/template-form.tsx`
- `src/components/rh/documentos/mapping-form.tsx`
- `src/components/rh/documentos/templates-table.tsx`

### Modificados

- `src/components/layout/rh-dropdown.tsx` — item "Documentos"
- `src/components/students/quick-document-actions.tsx` — recebe `templates`, calcula quick/more, chama action v2
- `src/components/students/student-header-actions.tsx` — propaga `templates`
- `src/app/(app)/alunos/[id]/page.tsx` — carrega templates
- `src/components/matriculas/document-generator.tsx` — usa templates do banco + action v2

### Deletar (cleanup pós-deploy)

- `src/lib/documents/templates.ts`
- `src/lib/documents/variables.ts`
- `src/lib/actions/documents-generate.ts`
- `public/templates/*.docx`

## Edge cases / segurança

- Upload de `.docx` malformado: docxtemplater throw no parse → action retorna erro, template não persiste, arquivo Storage não enviado (parse antes do upload).
- Upload arquivo não-`.docx`: validação MIME + extensão no server action.
- Tamanho: ≤ 5 MB.
- Placeholder não mapeado: vai pra string vazia na geração; sem erro.
- Mapping referenciando placeholder que não existe mais no template (após re-upload): ignorado silenciosamente.
- Template inativo: não aparece na ficha aluno nem na tab matrículas; só em `/rh/documentos`.
- Delete: soft delete via `ativo=false`. Hard delete só se `gerado_count = 0`.
- Race em `gerado_count`: incrementa via SQL atômico (`set gerado_count = gerado_count + 1`), não read-modify-write.
- Storage path nunca composto com user input.
- RLS força `escola_id = session.escola_id` em SELECT e ALL.
- Allowlist validada server-side em `saveTemplateMappingsAction` E em `generateFromTemplateAction` (defense in depth).
- Categoria fixa enum, sem custom em v1.
- Auditoria de mudanças no template: v1 sem.

## Testing

Sem framework UI. Manual:

- [ ] Upload `.docx` novo com 5 placeholders mistos (tabela + computed). Parse detecta todos.
- [ ] Configurar mapping pra cada placeholder. Salvar com sucesso.
- [ ] Gerar template na ficha de aluno com matrícula ativa. `.docx` baixado tem todos os campos preenchidos.
- [ ] Mapping com filtro `financeiro` resolve responsável correto.
- [ ] Mapping com filtro `principal` resolve endereço principal.
- [ ] Editar template (nome/categoria/desativar) reflete na ficha aluno.
- [ ] Top 3 por `gerado_count` aparece em QUICK; demais em dropdown.
- [ ] Template inativo desaparece da ficha + tab matrículas.
- [ ] Delete hard só funciona se `gerado_count = 0`.
- [ ] Seed dos 6 templates: geração via QuickDocumentActions produz arquivo idêntico ao antes da migração.
- [ ] Tab `/matriculas/[id]?tab=documentos` continua funcionando.
- [ ] RLS: usuário de escola B não vê templates de escola A (testar mudando session na DB).

## Fora de escopo

- Drag-drop pra reordenar quick/more (será automático).
- Categoria custom além das 4 enum.
- Versionamento/histórico de mudanças nos templates.
- Pré-visualização do `.docx` no wizard de mapeamento (futuro).
- Editor de template inline.
- Bulk gen / lote.
- Notificações pós-geração.
- Janela móvel no ranking (all-time só).
- Multi-língua de placeholders.
