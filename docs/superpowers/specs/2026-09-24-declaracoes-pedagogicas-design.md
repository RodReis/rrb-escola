# Emissão de Declarações Pedagógicas

## Contexto

O sistema já tem um motor de documentos baseado em .docx + docxtemplater
(`templates_documentos`, categoria `declaracao`), usado por
`QuickDocumentActions` na ficha do aluno. Esse motor exige matrícula ativa,
gera um aluno por vez, e o PDF sai via mammoth → HTML → print, com visual
diferente do histórico/certificado.

O pedido é outro: um cadastro de modelo em **texto editado na tela** (Título +
Corpo + Fecho, com parâmetros `[PARAMETRO]`), emissão em lote por
série/turma, e PDF **no mesmo padrão visual do histórico e certificado**
(jsPDF, cabeçalho com logo/dados da empresa, rodapé com assinaturas).

Depende da frente **Cadastro de Empresa** (logo, dados da empresa, assinaturas
de Secretário/Diretor).

Este é um motor novo, paralelo ao de .docx (que continua existindo para
contratos/termos — categoria fora de escopo aqui).

## Decisões

- Motor novo (não reaproveita `templates_documentos`/docxtemplater).
- Assinam a declaração: **Secretário e Diretor** (mesmos dados usados pelo
  histórico, vindos de `companies`).
- Emissão aceita: um aluno específico, ou a turma inteira (1 PDF, uma página
  por aluno).
- Entram na emissão em lote matrículas **ativas, canceladas e transferidas**
  do ano — necessário para emitir "Transferência" de quem já saiu.
- Fora de escopo: Etapa/bimestre, notas parciais, "aplicar somente para
  resultado final", negrito no editor, aba de leiaute customizado.

## Modelo de dados

```sql
create table declaracao_modelos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  codigo serial,
  nome text not null,
  titulo text not null,
  texto text not null,
  fecho text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- RLS por escola_id, seguindo o padrão já usado nas demais tabelas multi-tenant.
```

Seed inicial (mesma migration), 4 modelos com os textos-base das telas de
referência:
- Declaração de Frequência
- Declaração de Matrícula
- Declaração de Transferência — Concluído
- Declaração de Transferência — Não Concluído

## Parâmetros suportados

| Parâmetro | Origem |
|---|---|
| `[NOME_ALUNO]` | `alunos.nome` |
| `[MATRICULA]` | `matriculas.codigo` |
| `[DATA_NASCIMENTO]` | `alunos.data_nascimento` |
| `[CIDADE]` / `[UF]` | `alunos.naturalidade` (parse já usado no histórico) |
| `[FILIACAO]` | helper `@/lib/historico/filiacao` (mesmo do histórico/certificado) |
| `[ANO_LETIVO]` | `matriculas.ano_letivo` |
| `[SERIE_CORRENTE]` | `series.nome` da matrícula |
| `[TURMA]` | `turmas.nome` |
| `[TURNO]` | `turmas.turno` |
| `[PROXIMA_SERIE]` | próxima série na ordem sequencial de `series` |
| `[EMPRESA]` | `companies.nome_fantasia` (fallback `name`) |
| `[DATA_POR_EXTENSO_COM_CIDADE]` | data de emissão + cidade da empresa |
| `[DATA_POR_EXTENSO_SEM_CIDADE]` | data de emissão, sem cidade |

- Parâmetro fora dessa lista é **bloqueado ao salvar o modelo** (validação
  antes de persistir `texto`/`titulo`/`fecho`), com mensagem indicando qual
  token é inválido.
- Resolução isolada em função pura testável:
  `resolverDeclaracao(modelo: DeclaracaoModelo, dados: DadosAluno): DeclaracaoResolvida`.

## Telas

### Acadêmico › Declarações › Modelos (CRUD)
- Lista: Código, Nome, ativo/inativo, busca por nome.
- Form: Nome, Título, Texto (textarea), Fecho (textarea), botão "Adicionar
  parâmetro" (dropdown que insere o token na posição do cursor).
- Excluir usa `useConfirm` (nunca `confirm()` nativo — regra do projeto).

### Acadêmico › Declarações › Emitir
- Filtros: Ano Letivo, Série/Turma, Aluno (opcional), Modelo de Declaração.
- Ao escolher o modelo, pré-visualização mostra Título/Texto/Fecho já
  resolvidos para o primeiro aluno do filtro (ou o único, se um aluno
  específico foi escolhido).
- A pré-visualização é editável; edições valem só para essa emissão (não
  gravam no modelo) — mesmo comportamento do sistema de referência.
- Botão **Emitir PDF**: sem aluno selecionado, gera 1 PDF com uma página por
  aluno da série/turma (incluindo cancelados/transferidos do ano); com aluno
  selecionado, gera 1 PDF de uma página.

Menu: entradas adicionadas manualmente no array do `topbar.tsx` (o menu é
hardcoded no projeto), com permissão RBAC nova (ex.: `academico.declaracoes`).

## Geração do PDF

Reaproveita os utilitários de `src/lib/documents/pdf-utils.ts` e o padrão de
`certificado-pdf.ts`/`historico-pdf.ts`:

- **Cabeçalho:** logo da empresa (`companies.logo_path`, fallback padrão),
  razão social/nome fantasia, CNPJ, endereço, resolução — via
  `getCredenciamentoVigente` pela série do aluno (mesma função já usada por
  histórico/certificado).
- **Corpo:** título centralizado (negrito), texto do corpo justificado.
- **Rodapé:** fecho + duas assinaturas (Secretário, Diretor), mesmo layout de
  assinatura usado no histórico.

## Testes

- `resolverDeclaracao`: todos os parâmetros presentes; parâmetro desconhecido
  rejeitado ao salvar; `FILIACAO`/`CIDADE`/`UF` ausentes não quebram (mesmo
  padrão de `certificado-pdf.test.ts` "não quebra sem RG/filiação/naturalidade").
- Teste de layout do PDF (estrutura de página, posição de cabeçalho/rodapé),
  no padrão dos testes existentes de `certificado-pdf.test.ts`.
- Emissão em lote gera N páginas para N alunos da turma.
- `npm run typecheck && npm run build` verdes.

## Critério de aceite

- CRUD de modelos funcional com validação de parâmetros.
- Emissão por aluno único e por turma inteira, incluindo cancelados/
  transferidos do ano.
- PDF visualmente consistente com histórico/certificado (mesmo cabeçalho e
  bloco de assinatura).
