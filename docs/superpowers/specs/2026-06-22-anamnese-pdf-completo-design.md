# Ficha de Anamnese completa (PDF → formulário + export DOCX)

**Data:** 2026-06-22
**Status:** Aprovado (design), aguardando revisão do spec
**Módulo afetado:** Pipeline / Anamnese · Ficha do aluno

## Problema

A escola usa uma "Ficha de Anamnese" em papel (PDF, 4 páginas, ~60 perguntas) preenchida
durante a entrevista de novos alunos, vinculada ao cadastro de reserva (lead no pipeline).
Hoje o sistema já tem uma anamnese digital **parcial** (~20 campos) no modal do card do
pipeline, mas:

1. cobre só ~1/3 das perguntas do PDF real;
2. não exporta a ficha em DOCX para a coordenadora;
3. depois que o lead vira aluno efetivo, a anamnese só é acessível voltando ao card antigo
   do pipeline (não aparece na ficha do aluno).

## Objetivo

1. Expandir o formulário digital para cobrir **todas** as ~60 perguntas do PDF.
2. Gerar um **DOCX** que reproduz o layout da ficha em papel, com as respostas preenchidas.
3. Exibir a anamnese (read-only + export) também na **ficha do aluno efetivado**.

## O que já existe (não refazer)

| Item | Local |
|---|---|
| Tabela `pipeline_anamnese` (~20 campos + LGPD + status) | `supabase/migrations/202606210005_pipeline_mvp5.sql` |
| Log de acesso `pipeline_acesso_log` + função `pipeline_gravar_acesso_log` | mesma migration |
| Actions get/salvar/status/upload/delete | `src/lib/actions/pipeline-anamnese.ts` |
| Zod `salvarAnamneseSchema`, `STATUS_ANAMNESE`, transições | `src/lib/validation/pipeline.ts` |
| UI no modal do card | `src/components/pipeline/anamnese-section.tsx` |
| Vínculo automático com aluno na promoção (`aluno_id` + espelho em `informacoes_medicas`) | `pipeline_promover_card` (migration MVP5) |
| Engine de DOCX (`docxtemplater` + `pizzip`) | `src/lib/actions/documents-generate-v2.ts` |
| RBAC `pipeline_sensivel` (admin + coordenação; secretaria sem acesso) | migration MVP5 + `src/lib/auth/permissions.ts` |

## Decisões de design (aprovadas)

- **Escopo:** PDF completo (~60 campos).
- **Modelo de dados:** colunas tipadas na tabela (não JSONB) — segue o padrão atual.
- **DOCX:** reproduz o layout do PDF; template **fixo no repo** (não Storage/`templates_documentos`).
- **Onde aparece:** pipeline (editável) **e** ficha do aluno (read-only + export).
- **Múltipla escolha** (atitudes sociais, emocional, sono, distrações): armazenado como
  `text` com valores separados por vírgula. Sem tabelas-filhas (YAGNI).

## Modelo de dados — colunas novas em `pipeline_anamnese`

Todas **nullable**. `boolean` para sim/não; `text` para o resto. Campos já existentes
(`alergias`, `medicamentos_continuos`, `necessidade_especial*`, `acomp_*`,
`observacoes_coordenacao`, etc.) são reusados, não duplicados. Nome/nascimento/responsáveis
vêm de `pipeline_lead` / `pipeline_lead_responsavel`; série/turma de `pipeline_reserva` — não duplicar.

**Identificação / entrevista**
- `como_soube_escola text`
- `turno text` (matutino/vespertino)
- `data_visita date`
- `crianca_compareceu boolean`

**Família**
- `pais_estado_civil text` (casados/separados)
- `crianca_vive_com text`

**Gestação / parto**
- `gestacao text` (completa/pré-matura/pós-matura)
- `saude_mae_gravidez text`
- `parto text` (normal/cesariano/induzido)
- `amamentou text`
- `mamadeira text`

**Estrutura familiar**
- `tem_irmaos boolean`
- `posicao_familiar text` (primogênito/meio/caçula/único)
- `filho_adotivo boolean`
- `ciente_adocao boolean`

**Desenvolvimento** (todas `text`)
- `desenvolvimento_motor`, `atraso_fala`, `troca_fonemas`, `dificuldade_visao_locomocao`,
  `fatos_desenvolvimento`, `controle_esfincter`, `enurese_noturna`, `perturbacoes_sono_dev`,
  `habitos_especiais`, `atende_intervencoes`

**Comportamento / emocional**
- `choro_facil text`, `recusa_auxilio text`, `resistencia_toque text`, `escola_anterior text`,
  `faz_amigos text`, `adapta_meio boolean`, `companheiros_brincadeira text`,
  `distracoes_preferidas text`
- `atitudes_sociais text` (múltipla, CSV)
- `emocional text` (múltipla, CSV)
- `sono text` (múltipla, CSV)

**Saúde (complementa existentes)**
- `problemas_neurologicos text`
- `acompanhamento_medico text`

**Reação / internet / fechamento**
- `reacao_contrariada text`, `intolerancia_frustracao boolean`, `uso_internet text`,
  `orientacao_internet text`, `outras_informacoes text`

Total: ~38 colunas novas.

## Export DOCX

Action dedicada, **fora** do `resolver.ts` genérico (a anamnese tem forma própria, não vale
forçar no allowlist de tabelas de aluno).

`exportarAnamneseDocxAction(ref: { cardId?: string; alunoId?: string })`:
1. Carrega anamnese (por `card_id` no pipeline ou `aluno_id` na ficha) + dados de
   lead/aluno (nome, nascimento, responsáveis, série/turma).
2. Monta `Record<placeholder, string>` direto.
3. Preenche `src/lib/documents/templates/anamnese-fund1.docx` (reproduz layout do PDF,
   placeholders `{campo}`) via `docxtemplater` + `pizzip`.
4. Retorna base64 → cliente baixa `Anamnese-{nome}.docx`.

Helper `formatAnamneseParaDocx()`: converte boolean → `( X ) SIM ( ) NÃO`; CSV múltipla →
marca `( X )` nos itens corretos; nulos → vazio.

**RBAC:** `pipeline_sensivel` (admin + coordenação). Secretaria barrada. Registrar acesso
em `pipeline_acesso_log` (recurso `anamnese`, ação `read`) na exportação.

## Onde aparece

**Pipeline** (`anamnese-section.tsx`):
- Formulário expandido (~60 campos) em blocos colapsáveis.
- Botão "Exportar DOCX" no topo.
- Continua sendo a fonte da verdade (edição só aqui).

**Ficha do aluno** (`/alunos/[id]`):
- Nova seção read-only `<AnamneseAlunoSection alunoId>` abaixo do extrato.
- Busca por `aluno_id` (setado na promoção). Mostra resumo + botão "Exportar DOCX".
- Sem edição (evita divergência com o pipeline).
- Aluno sem anamnese (pré-pipeline): mostra "Nenhuma anamnese registrada", esconde export.
- Trava `pipeline_sensivel`: se sem acesso, a seção não renderiza.

**Componente compartilhado** `anamnese-fields.tsx` com prop `readOnly` — evita duplicar a
estrutura dos blocos entre pipeline (editável) e aluno (read-only).

## Plano de execução (fases — cada uma com `typecheck` + `build` verde)

1. **Migration + validação + tipos** — `202606210006_anamnese_pdf_completo.sql` (alter add
   column × ~38, nullable; herda RLS/grants existentes; **sem** mudar `pipeline_promover_card`).
   Aplicar via `db push` (nunca `db reset --local`). Estender `salvarAnamneseSchema` (campos
   novos `.optional().nullable()`).
2. **Actions** — estender `salvarAnamnese`/`getAnamnese`; nova `getAnamnesePorAluno(alunoId)`.
3. **Componente de campos** — `anamnese-fields.tsx` (blocos colapsáveis, `readOnly`); refatorar
   `anamnese-section.tsx` para usá-lo.
4. **Export DOCX** — template `anamnese-fund1.docx`, `formatAnamneseParaDocx()`,
   `exportarAnamneseDocxAction`, botão no pipeline.
5. **Ficha do aluno** — `anamnese-aluno-section.tsx` (read-only + export), integrar em
   `/alunos/[id]`.
6. **Testes**.

## Testes (Vitest)

- Unit: `formatAnamneseParaDocx` (boolean, múltipla CSV, nulos).
- Unit: zod schema aceita/rejeita os campos novos.
- Integração: `exportarAnamneseDocxAction` gera buffer DOCX válido (descompacta o zip,
  confere placeholders substituídos).
- RBAC: secretaria barrada no export.

## Riscos e questões abertas

- **Template binário `.docx`:** precisa ser um arquivo real. Decidir na implementação: gerar
  programaticamente (lib `docx`) **ou** o usuário cria no Word a partir do PDF. Não bloqueia o design.
- **Fidelidade visual DOCX vs PDF:** Word ≠ PDF; ordem/blocos/conteúdo batem, pixel-perfeito não é meta.
- **Conversão é mais que visual:** este trabalho **altera lógica/dados** (colunas, actions), então
  **não** está sob a trava "somente visual" do design system — é feature de produto.

## Fora de escopo (YAGNI)

- Editar anamnese pela ficha do aluno.
- Template gerenciável por escola no Storage.
- Tabelas-filhas para múltipla escolha.
- Espelhar campos qualitativos novos em `informacoes_medicas`.
