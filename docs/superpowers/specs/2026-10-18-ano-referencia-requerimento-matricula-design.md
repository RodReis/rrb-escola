# Ano de Referência + Requerimento de Matrícula — design

Data: 2026-10-18. Telas de referência fornecidas pelo usuário (sistema legado).
PDF de referência com texto/layout final: `C:\Users\rodri\OneDrive\Desktop\Projetos\Docs\Escola\Requerimento de Matricula.pdf`.

> **Status: entregue e em produção (2026-10-18).** PR #48 + ajustes direto no `main`
> (`3bf7520a`, `ba091b5c`, `722e0249`). Migrations `202610180001`/`202610180002` aplicadas
> em prod com `supabase db push --linked`. As seções abaixo já refletem a versão final;
> decisões revistas depois da primeira entrega estão marcadas com **(revisto)**.

Duas features relacionadas: a primeira introduz um "ano letivo ativo" global que a segunda
(e o restante do sistema) passa a usar como padrão.

## Objetivo

**1. Mudança do Ano de Referência** — tela de configuração que define qual é o "ano letivo
atual" do sistema. Hoje isso não existe: cada tela usa `new Date().getFullYear()` de forma
independente. Passa a existir uma config por escola, e as telas que hoje usam esse fallback
passam a ler essa config em vez do ano do relógio.

**2. Emissão de Requerimento de Matrícula** — novo documento emitido em PDF (ficha de dados
do aluno + pai + mãe + matrícula + responsável financeiro + assinaturas), coletivo ou
individual, seguindo o layout do PDF de referência.

## Fora de escopo

- Modelar "Irmãos na Escola" e "Novo Endereço" no schema: não há relação estruturada
  aluno↔irmão nem flag de mudança de endereço, e isso continua sem modelagem.
  **(revisto)** No PDF os dois campos voltaram como linhas **em branco, para preenchimento à
  mão** — o usuário pediu o layout idêntico ao formulário impresso da escola.
- Assinatura como imagem escaneada: fora de escopo. Segue o padrão já usado em
  `certificado-pdf.ts`/`declaracao-pdf.ts` — nome em caixa alta + cargo, linha acima, sem
  upload de imagem.
- Edição do texto/layout do requerimento pelo usuário (não é um "template" editável via
  `templates_documentos`/mammoth; é um layout fixo em jsPDF, igual certidão/declaração).
- Migração de **todos** os pontos que hoje usam `getFullYear()` como fallback de UI (ex.
  parâmetro de query string vazio em tela nova) — só os pontos listados em "Consumidores do
  ano de referência" abaixo. Qualquer outro uso de `getFullYear()` não ligado a "qual é o ano
  letivo corrente" (ex. calcular idade) fica como está.
- Histórico de mudanças de ano de referência (quem mudou, quando): grava só o valor atual.

## Decisões

- **Ano de referência é por escola** (`escolas.ano_referencia_atual`), não global nem por
  usuário — mesmo padrão de single-tenant-na-prática do resto do projeto
  (`DEFAULT_SCHOOL_ID`).
- A tela de troca segue o padrão already-visto: client toggle Sim/Não, mas o "Sim" só existe
  para abrir a confirmação — sem o toggle em Sim não há o que confirmar. Mantém o texto
  explicativo (por quê / quando / o que acontece) como conteúdo estático, adaptado deste
  sistema.
- Trocar o ano de referência é mudança simples de 1 inteiro (sem dados a migrar), mas é
  irreversível na prática (vira o padrão de toda tela nova que o usuário abrir depois) — por
  isso o toggle Sim/Não + Confirmar, igual ao legado, em vez de salvar direto.
- **Consumidores migrados** (passam a usar `getAnoReferenciaAtual()` no lugar de
  `new Date().getFullYear()` como valor inicial/placeholder de filtro): todas as páginas que
  hoje fazem esse fallback para popular filtro de Ano — `alunos`, `avaliacoes/*`,
  `declaracoes/emitir`, `historico/*`, `matriculas/saidas`, `turmas`, e o novo
  `matriculas/requerimento`. Ação do usuário de trocar o Ano no filtro de uma tela aberta
  continua valendo normalmente (a config só define o valor inicial/padrão, não trava a
  tela).
  - `anoLetivoDaData(data: Date)` hoje é função pura, sem `escolaId`, chamada tanto em
    Server Component quanto em componente client (`nova-matricula-fields.tsx`). Muda de
    assinatura para `anoLetivoDaData(data: Date, anoReferencia: number)` — todo chamador
    passa a buscar o ano de referência antes (trivial no server; no client, recebido via
    prop vinda do Server Component pai, que já tem esse valor). Sem mudar sync/async.
  - O computed `ano_letivo_atual` do `schema-catalog.ts`/`resolver.ts` **só troca a fonte**
    (de `String(now.getFullYear())` para `String(anoReferencia)`) — **não** passa a aplicar
    a regra de corte de setembro. Hoje esse token já não tem corte; manter assim evita que
    documentos emitidos entre set-dez mudem de comportamento sem necessidade (mesma classe
    de risco do incidente já registrado em `project_ano_letivo_correcao`).
- **Requerimento de matrícula é layout fixo em jsPDF**, novo arquivo
  `src/lib/documents/requerimento-matricula-pdf.ts`, seguindo a mesma estrutura de
  `certificado-pdf.ts`/`declaracao-pdf.ts`. `renderAssinaturas` não é exportada em nenhum dos
  dois módulos existentes (cada um tem a sua, com formato de assinatura diferente); o
  requerimento tem o próprio par de assinaturas (secretário + responsável financeiro, não
  aluno nem diretor fixo), então ganha sua própria função privada `renderAssinaturas`, mesmo
  padrão visual (linha + nome caixa alta + cargo), sem importar de outro arquivo.
- **(revisto) Tela segue o padrão de `historico/emissao` e `historico/certificado`**, não
  mais o de `declaracoes/emitir` — o usuário pediu consistência com as telas irmãs do menu
  Histórico Escolar. Filtros via querystring em chips (Ano letivo, Série/Turma | Aluno,
  Série, Turma), tabela de alunos com checkbox e "Emitir selecionados (n)". A preview
  individual e o "Tipo de emissão Coletivo/Individual" saíram: selecionar 1 ou N linhas na
  tabela cobre os dois casos. Continua a emissão em lote tolerante a falha por aluno
  (`falhas[]`) e sem overrides por aluno (não vazar dado de um aluno pros demais).
  "Observações" é o único campo livre, igual para todas as páginas do lote, impresso como
  última linha da tabela do PDF.
- **Secretário(a)**: lido de `companies.secretario_nome` / `companies.secretario_cargo`
  (já existe, usado por `certificado_config`). Resolve a `company` pela escola, mesmo
  caminho que o histórico escolar já usa.
- **Responsável que assina**: o responsável financeiro (`responsaveis_aluno` com
  `responsavel_financeiro = true`), mesmo filtro `"financeiro"` já suportado pelo
  `schema-catalog.ts`. **(revisto)** A listagem já traz `temResponsavelFinanceiro`: aluno sem
  responsável financeiro aparece na tabela como "Sem responsável financeiro", com checkbox
  bloqueado e aviso de pendência (mesmo papel do "Sem histórico" da emissão do histórico).
  A action continua mandando esse caso para `falhas[]` como segunda barreira.
- **Campos novos no schema**, pois o PDF de referência os usa e hoje não existem:
  - `alunos.religiao` (text, nullable).
  - `responsaveis_aluno.data_nascimento` (date, nullable), `estado_civil` (text, nullable),
    `escolaridade` (text, nullable), `profissao` (text, nullable),
    `endereco_trabalho` (text, nullable), `telefone_trabalho` (text, nullable),
    `cnpj` (text, nullable — campo dedicado, separado de `cpf`; o responsável usa um ou
    outro, nunca os dois).
  - Esses campos ficam cadastráveis na ficha do aluno/responsável (formulário de
    matrícula/edição de aluno existente) — não só no banco sem UI.
  - `schema-catalog.ts` hoje já lista `profissao`/`endereco_trabalho` como colunas
    permitidas de `responsaveis_aluno` mesmo elas não existindo no schema atual (catálogo
    desalinhado) — essas migrations alinham o schema ao catálogo em vez de o catálogo ter
    sido escrito errado.
- Campo vazio no banco (ex. responsável sem profissão cadastrada) imprime em branco no PDF,
  igual ao padrão de outros documentos — não bloqueia emissão, exceto responsável financeiro
  ausente (acima).

## Modelo de dados

Duas migrations novas.

**Migration A — ano de referência:**

```sql
alter table public.escolas
  add column if not exists ano_referencia_atual int not null
    default extract(year from now())::int;
```

**Migration B — campos do requerimento:**

```sql
alter table public.alunos
  add column if not exists religiao text;

alter table public.responsaveis_aluno
  add column if not exists data_nascimento date,
  add column if not exists estado_civil text,
  add column if not exists escolaridade text,
  add column if not exists profissao text,
  add column if not exists endereco_trabalho text,
  add column if not exists telefone_trabalho text,
  add column if not exists cnpj text;
```

Sem RLS nova (colunas em tabelas já cobertas por policy existente).

RBAC (decisão do builder, sem impacto em dado): **duas ações, dois módulos já existentes,
nenhum módulo novo.**

- Emissão do requerimento reaproveita `requirePermission("historico", "read")` — mesmo
  módulo que `declaracoes/emitir` já usa (não existe módulo `"declaracoes"`; o código trata
  documento pedagógico de aluno como categoria `historico`).
- Troca do ano de referência reaproveita `requirePermission("configuracoes.escola", "update")`
  — mesmo módulo de `configuracoes/escola` (admin/secretaria apenas), não o módulo de
  matrícula. É uma config global e irreversível na prática, cabe junto das outras
  configurações administrativas, não junto de ações operacionais do dia a dia de matrícula.

## Telas

**`/configuracoes/ano-referencia`** (ou rota equivalente dentro de `configuracoes/`, seguindo
o padrão de `configuracoes/escola/page.tsx`):

- Campo "Ano de referência atual" — readonly, mostra `escolas.ano_referencia_atual`.
- Toggle "Mudar de ano de referência" — Sim/Não.
- Texto explicativo estático (por quê / quando / o que acontece).
- Botão "Confirmar" — só habilitado/com efeito quando o toggle está em "Sim"; grava
  `ano_referencia_atual = ano_referencia_atual + 1`. Sem campo de escolha de ano e sem tela
  de desfazer — fiel ao legado. Correção de um avanço indevido é ação administrativa pontual
  via SQL direto, fora da UI (mesma lógica de não ter histórico/auditoria, já definida como
  fora de escopo).

**`matriculas/requerimento`** **(revisto — padrão `historico/emissao`)**:

- `PageHeader`: Acadêmico / Histórico Escolar / Requerimento — "Requerimento de Matrícula".
- Card de filtros: Ano letivo (padrão = ano de referência), chips Série/Turma | Aluno; no modo
  Série/Turma, Série e Turma — a Turma só habilita depois da Série e lista o **turno em
  maiúsculas** (MATUTINO / VESPERTINO), não `turmas.nome` (que tem valores soltos como
  "A"/"MAT"). No modo Aluno, busca por `StudentCombobox`. Observações (textarea) no mesmo card.
- Só lista alunos depois de um filtro (igual ao histórico), evitando PDF da escola inteira.
- Tabela: checkbox, Aluno, Situação ("Pronto" / "Sem responsável financeiro"), "Marcar todos"
  marca só os prontos. Botão "Emitir selecionados (n)" → gera e baixa o PDF client-side
  (`renderRequerimentos(...).save(...)`); 1 aluno = `NOME-requerimento-{ano}.pdf`.

## Layout do PDF

**(revisto)** Formulário em tabela com bordas, idêntico ao impresso da escola, **sempre uma
página A4 por aluno**. Helvetica, rótulo 6.5pt negrito no topo da célula e valor logo abaixo;
bandas cinza centralizadas para os títulos de seção.

- Cabeçalho: logo à esquerda; à direita, alinhados à direita, razão social e nome fantasia
  (negrito; o fantasia só aparece se diferente da razão social), CNPJ, endereço + cidade/UF +
  CEP, e-mail, telefones — do credenciamento vigente da série (`getCredenciamentoVigente`).
- Título "Requerimento de Matrícula - {ano}".
- "Dados do Aluno": **foto** (`alunos.foto_url`, URL assinada do bucket `alunos-fotos`)
  num quadro à esquerda ocupando 6 linhas; sem foto, ou se a imagem não baixar, o quadro sai
  com "Foto" em branco. Ao lado: matrícula, nome, sexo, dt. nascimento, naturalidade,
  telefones, endereço, Cidade e CEP (em branco — o endereço já vem montado com eles), CPF,
  RG. Depois Etnia e Religião em linha cheia.
- "Pai" e "Mãe" (via `responsaveis_aluno.parentesco`): nome; RG / CPF-CNPJ / telefones;
  e-mail / dt. nascimento; estado civil / escolaridade / local de trabalho; profissão /
  telefone do trabalho. Sem cadastro, o bloco sai **em branco** (mantém a geometria e pode
  ser completado à caneta).
- Irmãos na Escola e Novo Endereço: linhas em branco para preenchimento à mão.
- "Dados da Matrícula": série, turma/turno (só o turno quando a turma tem o mesmo nome),
  tipo de ensino, data da matrícula.
- "Responsável Financeiro Principal": nome, CPF/CNPJ, parentesco.
- Observações (se preenchidas): última linha da tabela.
- Rodapé logo abaixo da tabela: "{Cidade da escola}, {data por extenso}." à direita e duas
  assinaturas lado a lado — secretário(a) e responsável financeiro (nome em caixa alta +
  cargo).

Garantia de uma página: toda linha tem **altura fixa** (22pt); o valor encolhe a fonte
(8.5 → 6pt), quebra em até 2 linhas e, no extremo, é cortado com "…" — nunca empurra a linha
de baixo. Cabeçalho e nomes de assinatura limitados a 2 linhas. `medirRodapeRequerimento`
expõe onde o rodapé termina e o teste prova que fica dentro da A4 mesmo com dados enormes
(o jsPDF não cria página sozinho, então "1 página" sozinho não provava nada).

## Código

- `src/lib/escola/ano-referencia.ts` — `getAnoReferenciaAtual(escolaId)` (lê
  `escolas.ano_referencia_atual`), usado como valor inicial nos pontos listados em
  "Consumidores migrados".
- `src/lib/actions/ano-referencia.ts` — server action de troca (`requirePermission`,
  incrementa e `revalidatePath` nas rotas afetadas).
- `src/app/(app)/configuracoes/ano-referencia/page.tsx` + componente client do toggle.
- `src/lib/documents/requerimento-matricula-pdf.ts` — renderer jsPDF, com `renderAssinaturas`
  própria (secretário + responsável financeiro), mesmo padrão visual de
  `certificado-pdf.ts`/`declaracao-pdf.ts`.
- `src/lib/data/requerimento-matricula.ts` — `listarAlunosParaRequerimento` (com
  `temResponsavelFinanceiro`) e `buscarDadosRequerimento` (com `aluno.fotoUrl` assinada).
- `src/lib/actions/requerimento-matricula.ts` — `carregarRequerimentosAction` (mesma
  tolerância a falha por aluno de `declaracao-emissao.ts`). **(revisto)**
  `previsualizarRequerimentoAction` foi removida junto com a preview individual.
- `src/app/(app)/matriculas/requerimento/page.tsx` +
  `src/components/matriculas/requerimento-emissao-form.tsx` (mesma estrutura de
  `historico/emissao-form.tsx`: `FilterDropdown`, `FilterChips`, `StudentCombobox`,
  `DataTableShell`, `StatusPill`, `PageNotice`).
- Campos novos de aluno/responsável entram no formulário existente de cadastro/edição de
  aluno (`matricula-full-edit-dialog.tsx` ou equivalente) — confirmar o componente exato ao
  implementar.
- Menu (`topbar.tsx`, array hardcoded, mesmo padrão de sempre): item "Requerimento de
  Matrícula" em **Secretaria › Histórico Escolar**, irmão de Associações / Entrada de Notas /
  Emissão / Certificado (submenu já existente). Item "Mudança do Ano de Referência" em
  **Configurações**.

## Testes e entrega

- Vitest: `getAnoReferenciaAtual` (fallback se config ausente), action de troca, montagem do
  requerimento (dados completos / responsável financeiro ausente → falha), layout do PDF não
  precisa de teste de pixel (mesmo padrão dos outros documentos).
- `npm run typecheck && npm run build` verdes antes de fechar; `npm run test` antes do PR.
- **Deploy exige `supabase db push --linked`** — sem a migration, as telas de requerimento e
  ano de referência quebram em Server Component com erro genérico (já aconteceu no PR #43 do
  Questionário; aplica igual aqui). ✅ Aplicado em prod em 2026-10-18; os ajustes posteriores
  (tela, PDF, foto) não têm migration.
