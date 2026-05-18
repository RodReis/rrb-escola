# Módulo de Geração de Documentos (Contratos)

**Data:** 2026-05-18  
**Status:** Aprovado  
**Escopo:** Geração de PDF a partir de templates `.docx` na página de matrícula

---

## Contexto

O projeto tem 5 templates Word em `/public/` usados manualmente pela secretaria. Não há geração automatizada. Este módulo permite gerar PDFs preenchidos com dados do aluno/matrícula diretamente na tela de matrícula, com armazenamento no Supabase Storage.

---

## Decisões

| Questão | Decisão |
|---|---|
| Formato de saída | PDF |
| Acionamento | Manual — botão na página da matrícula |
| Templates iniciais | Todos os 5 existentes |
| Assinatura digital | Não — imprimir e assinar à mão |
| Armazenamento | `documentos_aluno` (tabela existente) |
| Vínculo | `aluno_id` apenas (sem `matricula_id`) |

---

## Arquitetura

### Fluxo de geração

```
Secretaria clica "Gerar"
        ↓
Server Action: generateDocumentoAction(matriculaId, tipoTemplate)
        ↓
Busca dados: aluno + matrícula + série + turma + responsáveis + endereços + escola
        ↓
Lê template .docx de public/templates/
        ↓
docxtemplater substitui {VARIAVEL} → valor real
        ↓
Extrai texto do .docx preenchido
        ↓
jsPDF renderiza PDF
        ↓
Upload → Supabase Storage bucket: documentos-alunos
        ↓
INSERT documentos_aluno (aluno_id, tipo_documento, nome_arquivo, storage_path, mime_type)
        ↓
Retorna URL assinada (30min) → browser abre PDF
```

### Novos arquivos

```
src/lib/documents/
  variables.ts          — mapeamento variável → campo do banco + função buildVariables()
  generator.ts          — docxtemplater + jsPDF, exporta generatePDF(template, vars)
  templates.ts          — enum TipoTemplate + metadados (nome display, arquivo, tipo_documento)

src/lib/actions/
  documents-generate.ts — Server Action: generateDocumentoAction(matriculaId, tipoTemplate)

src/components/matriculas/
  document-generator.tsx — UI: select tipo + botão gerar + lista docs gerados

supabase/migrations/
  YYYYMMDD_add_documento_tipos.sql — ALTER TYPE tipo_documento ADD VALUE
```

### Templates precisam ser convertidos

Os 4 arquivos `.doc` antigos devem ser salvos como `.docx` no Word. Depois os placeholders `NOME_ALUNO` viram `{NOME_ALUNO}` (sintaxe docxtemplater). O `TERMO DE RESPONSABILIDADE.doc` já é `.docx` internamente.

Templates ficam em `public/templates/` (subdir novo, separado dos `.doc` originais).

---

## Variáveis de Template

### Mapeamento completo

| Variável | Fonte |
|---|---|
| `{NOME_ALUNO}` | `alunos.nome` |
| `{SERIE_ALUNO}` | `series.nome` |
| `{TURNO_ALUNO}` | `turmas.turno` (uppercase: MATUTINO etc.) |
| `{TIPOENSINO_ALUNO}` | `series.tipo_ensino` |
| `{RG_PAI_ALUNO}` | `responsaveis_aluno.rg` onde relação = pai/masculino |
| `{CPF_PAI_ALUNO}` | `responsaveis_aluno.cpf` idem |
| `{ENDERECO_PAI_ALUNO}` | endereço do responsável pai |
| `{RG_MAE_ALUNO}` | `responsaveis_aluno.rg` onde relação = mãe/feminino |
| `{CPF_MAE_ALUNO}` | `responsaveis_aluno.cpf` idem |
| `{ENDERECO_MAE_ALUNO}` | endereço do responsável mãe |
| `{ENDERECO_RESP}` | endereço do responsável com `responsavel_financeiro = true` |
| `{RAZAO_SOCIAL_EMPRESA}` | `escolas.razao_social` |
| `{FANTASIA_EMPRESA}` | `escolas.nome_fantasia` |
| `{CIDADE_DATA_EXTENSO}` | gerado: "Trindade, 18 de maio de 2026" |
| `{ANO_LETIVO}` | `matriculas.ano_letivo` |

### Regra para variável não encontrada

Campo vazio no PDF — não bloqueia geração. Secretaria preenche à mão se necessário.

### Templates × variáveis

| Template | Variáveis usadas |
|---|---|
| Contrato Colégio Integrado | todas exceto `CIDADE_DATA_EXTENSO` |
| Contrato Pinguinho de Gente | todas exceto `CIDADE_DATA_EXTENSO` |
| Declaração de Frequência | `NOME_ALUNO`, `SERIE_ALUNO`, `TIPOENSINO_ALUNO`, `CIDADE_DATA_EXTENSO` |
| Declaração de Transferência | estático (sem variáveis — gerar como PDF direto) |
| Termo de Responsabilidade | mapear após conversão para `.docx` |

---

## Banco de Dados

### Migration: novos valores no enum `tipo_documento`

```sql
ALTER TYPE tipo_documento ADD VALUE IF NOT EXISTS 'contrato';
ALTER TYPE tipo_documento ADD VALUE IF NOT EXISTS 'declaracao';
ALTER TYPE tipo_documento ADD VALUE IF NOT EXISTS 'termo';
```

### Sem nova tabela

Usa `documentos_aluno` existente:

```
id, aluno_id, tipo_documento, nome_arquivo, 
storage_path, tamanho_bytes, mime_type, created_at
```

`nome_arquivo` formato: `"Contrato Colégio Integrado - {NOME_ALUNO} - {ANO_LETIVO}.pdf"`

---

## UI

### Localização

Seção nova na página `/matriculas/[id]` — abaixo dos dados da matrícula.

### Layout

```
DOCUMENTOS
─────────────────────────────────────────────
Gerar novo documento:
[ Contrato — Colégio Integrado        ▾ ] [ Gerar PDF ]

Documentos gerados:
📄 Contrato Colégio Integrado - João Silva - 2026.pdf   18/05/2026  [ Baixar ]
📄 Declaração de Frequência - João Silva - 2026.pdf     15/05/2026  [ Baixar ]
```

### Estados do botão

- Default: "Gerar PDF"
- Loading: spinner + "Gerando..." (desabilitado)
- Sucesso: toast "Documento gerado" + lista atualiza
- Erro: toast com mensagem específica

---

## Dependências Novas

```bash
npm install docxtemplater pizzip
```

- `pizzip` — lê `.docx` como ZIP
- `docxtemplater` — substitui variáveis `{VAR}` no XML interno do `.docx`
- `jsPDF` — já instalado, renderiza PDF final

---

## Fora de Escopo (MVP)

- Assinatura digital
- Histórico de versões de contrato
- Vínculo direto `matricula_id` em `documentos_aluno`
- Novos templates além dos 5 existentes
- Editor de templates na interface admin
- Envio por WhatsApp/email

---

## Pré-requisitos Manuais

Antes da implementação, secretaria precisa:

1. Abrir cada `.doc` no Word
2. Salvar como `.docx` em `public/templates/`
3. Substituir `NOME_ALUNO` → `{NOME_ALUNO}` em cada template (buscar/substituir no Word)
4. Repetir para todas as variáveis listadas acima
