# Relatórios/Etiquetas Dinâmicos — Aluno, Funcionário, Professor

**Data:** 2026-09-25
**Status:** aprovado (brainstorming)
**Referência funcional:** tela "Emissão de Etiquetas/Relatórios Dinâmicos - Aluno" do Escolar Manager (prints e PDFs de exemplo anexados na conversa de origem).

## 1. Objetivo

Três relatórios **separados** (Aluno, Funcionário, Professor) onde o usuário filtra registros, escolhe colunas de um catálogo com nomes normalizados, ordena colunas e registros, define formato de emissão e quantidade de cópias, e salva essa configuração como template reutilizável.

Formatos: **Etiquetas**, **Relatório em grade PDF**, **Relatório tabular PDF**, **Arquivo CSV**.

### Critérios de sucesso
- Secretaria gera etiqueta Carta 6180 de alunos de uma série com colunas escolhidas, 2 cópias por aluno, equivalente ao PDF de exemplo.
- Grade PDF e Tabular PDF com cabeçalho institucional (logo, nome, resolução, data/hora), título/subtítulo, "Quantidade: N" no fim.
- CSV abre corretamente no Excel PT-BR (acentos, `;`).
- Template salvo reaparece para todos os usuários da escola naquele relatório.
- Relatório de Professor filtra por turma/disciplina.

### Fora de escopo
- Filtros salvos no template (template guarda só leiaute).
- Geração server-side de PDF.
- Relatórios de outras entidades (responsáveis, turmas etc.).
- Favoritos ("Remover dos favoritos" do print) — já existe `perfis.quick_links`, não faz parte deste trabalho.

## 2. Decisões

| Tema | Decisão |
|---|---|
| Relatórios | 3 páginas separadas, 3 módulos RBAC, templates por entidade; motor e componentes compartilhados |
| Fonte do Professor | `employees` (RH), filtrado; turmas/disciplinas via novo vínculo `employees.perfil_id → perfis` |
| Templates | Por escola, compartilhados; `criado_por` registrado; CRUD conforme permissão do módulo |
| Catálogo de colunas | Curado em código TS (label PT-BR, grupo, resolver). Sem introspecção do banco |
| Arquitetura | Catálogo TS + server action resolve dados → linhas planas → renderização no cliente (jsPDF/autoTable, CSV) |
| Etiquetas | Carta 6180 (3×10), Carta 6181 (2×10), A4 Pimaco A4256/6280 (3×11), A4 A4362 (2×8) |

## 3. Rotas, menu e RBAC

Rotas:
- `/relatorios/dinamico/alunos`
- `/relatorios/dinamico/funcionarios`
- `/relatorios/dinamico/professores`

Menu: três itens adicionados a `RELATORIOS_ITEMS` em `src/components/layout/topbar.tsx` (menus são hardcoded; RBAC só filtra).

RBAC — módulos novos: `relatorio_din_aluno`, `relatorio_din_funcionario`, `relatorio_din_professor`. Seguir receita de `supabase/migrations/202606140010_rbac_relatorios_comercial.sql`:
1. Migration: `insert into modulos ... on conflict do nothing` + `role_permissoes` (admin: tudo em todos; secretaria: aluno e professor com todas as ações; financeiro: funcionário e professor com todas as ações; professor: nenhum). Ajustável depois em `/configuracoes/perfis`.
2. `MODULOS` e `ROTA_PARA_MODULO` em `src/lib/auth/permissions.ts`.
3. Páginas: `await requirePermission("<modulo>", "read")`.
4. Server actions: checagem equivalente (`read` para emitir; `create`/`edit`/`delete` para templates).

## 4. Banco de dados

### 4.1 `relatorio_templates`
```sql
create table public.relatorio_templates (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  entidade text not null check (entidade in ('aluno','funcionario','professor')),
  nome text not null check (length(trim(nome)) between 1 and 120),
  config jsonb not null,
  criado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escola_id, entidade, nome)
);
```
RLS: select/insert/update/delete restritos à escola do usuário e a `has_permission('relatorio_din_<entidade>', <ação>)`.

### 4.2 Vínculo funcionário ↔ usuário professor
```sql
alter table public.employees
  add column perfil_id uuid unique references public.perfis(id) on delete set null;
```
Backfill: `update employees e set perfil_id = p.id from perfis p where p.perfil = 'professor' and lower(p.email) = lower(e.email) and e.perfil_id is null` — apenas matches únicos (e-mail com mais de um match é ignorado e reportado no output da migration via `raise notice`).

UI: no cadastro/edição de funcionário (`/rh/funcionarios`), campo "Usuário do sistema (professor)" — select de `perfis` com `perfil='professor'` da escola, ainda não vinculados.

Lembrete de deploy: Vercel não aplica migrations — rodar `supabase db push --linked` após merge.

## 5. Modelo de template (`config jsonb`)

Validado por zod no client e no server.

```ts
type Formato = "etiqueta" | "grade" | "tabular" | "csv";
type ModeloEtiqueta = "6180" | "6181" | "A4256" | "A4362";

interface TemplateConfig {
  formato: Formato;
  colunas: string[];                               // keys do catálogo, na ordem de saída (≥ 1)
  ordenacao: { key: string; dir: "asc" | "desc" }[]; // ordenação dos registros
  copias: number;                                  // inteiro 1–10
  descricaoImpressao?: string;                     // PDFs
  modeloEtiqueta?: ModeloEtiqueta;                 // etiqueta
  fonte?: number;                                  // etiqueta: 6–12, passo 0,5 (default 7,5)
  rotulos?: boolean;                               // etiqueta: "Label: valor" vs "valor" (default true)
  titulo?: string;                                 // grade/tabular (obrigatório nesses formatos)
  subtitulo?: string;                              // grade/tabular
}
```
Keys de coluna desconhecidas (ex.: coluna removida do catálogo) são descartadas ao carregar o template, com aviso em toast.

## 6. Catálogo de colunas

```ts
interface ColunaDef<Ctx> {
  key: string;          // estável, ex. "aluno.nome", "pai.celular"
  label: string;        // PT-BR normalizado, ex. "Nome do Pai"
  grupo: string;        // ex. "Dados pessoais", "Pai", "Endereço"
  relacoes: Rel[];      // relações que a coluna exige (server busca só o necessário)
  resolve: (ctx: Ctx) => string; // sempre string formatada ("" quando vazio)
  permissao?: { modulo: string; acao: "read" }; // coluna só aparece se o usuário tiver
}
```

### 6.1 Aluno (`catalogo/aluno.ts`, ~60 colunas)
- **Dados pessoais:** nome, sexo, data de nascimento, idade, CPF, RG, órgão expedidor, data de expedição, naturalidade, nacionalidade, etnia, código INEP, e-mail, celular, matrícula (código).
- **Certidão:** livro, folha, número, cartório.
- **Matrícula (ano de referência):** código, ano letivo, série, turma, turno, segmento, status, data da matrícula, nº de chamada (posição alfabética por `nome_normalizado` na turma).
- **Endereço principal** (`enderecos_aluno.principal`): logradouro, número, complemento, bairro, cidade, UF, "Cidade Endereço" (`CIDADE - UF`), CEP, endereço completo.
- **Pai / Mãe** (`responsaveis_aluno` por `parentesco`): nome, CPF, celular, telefone, e-mail.
- **Responsável financeiro / pedagógico** (flags em `responsaveis_aluno`): nome, CPF, celular, e-mail.
- **Contatos:** "Celulares" = todos os celulares de responsáveis + contatos, formato `(62)98481-8104 - NOME - (parentesco)` separados por ` / `.
- **Médico** (`informacoes_medicas`): campos existentes relevantes (alergias, medicamentos, observações).

### 6.2 Funcionário (`catalogo/funcionario.ts`)
nome, CPF, data de nascimento, idade, e-mail, telefone, cargo, categoria (`school_category` com label), status do contrato, ativo, data de admissão, empresa (nome fantasia), CNPJ da empresa, e do contrato ativo (`folha_contratos`): salário base, valor hora-aula, aulas semanais, data de desligamento. Colunas salariais com `permissao: { modulo: "rh", acao: "read" }`.

### 6.3 Professor (`catalogo/professor.ts`)
Todas as colunas de Funcionário + via `perfil_id`: e-mail de usuário, disciplinas, turmas, séries (concatenadas com ` / `, ordenadas).

### 6.4 Regras gerais
- Datas `dd/MM/yyyy`; moeda `R$ 1.234,56`; CPF/CNPJ/CEP/telefone formatados.
- Multivalorados concatenados com ` / `.
- Quando ausente: string vazia (rótulo continua impresso, como no exemplo).

## 7. Filtros (aba "Filtros")

Todos os relatórios: lista de registros resultantes com checkbox, busca, marcar/desmarcar todos, rodapé "N itens selecionados". Por padrão, todos marcados ao mudar filtro.

- **Aluno:** Ano de referência (obrigatório; RPC `anos_letivos_matriculas`); "Filtrar por" Série | Turma | Segmento + seleção múltipla do valor; status da matrícula (default: ativa).
- **Funcionário:** Empresa (CNPJ); Situação (ativo/inativo/todos, default ativo); Categoria; Cargo.
- **Professor:** filtros de Funcionário + Turma e Disciplina (via `perfil_id` → `professor_disciplina_turma`). Base: funcionários com `perfil_id` preenchido **ou** `school_category in ('fund1','fund2','medio')`. Com filtro de turma/disciplina ativo, funcionários sem vínculo ficam fora.

## 8. Leiaute (aba "Leiaute")

- **Template:** select + botões Salvar (upsert; sem template selecionado → pede nome em dialog), Novo (limpa formulário para defaults), Excluir (via `useConfirm`, nunca `confirm()` nativo).
- **Formato de emissão** e campos condicionais:

| Formato | Campos visíveis |
|---|---|
| Etiqueta | Formato da etiqueta, Fonte (stepper), Rótulos dos campos (Sim/Não), Descrição para impressão, Qtd de cópias, Descrição do modelo (somente leitura) |
| Grade PDF | Título, Subtítulo, Descrição para impressão, Qtd de cópias |
| Tabular PDF | Título, Subtítulo, Descrição para impressão, Qtd de cópias |
| CSV | Qtd de cópias |

- **Colunas** (acordeão): lista dupla "Dados Disponíveis" ⇄ "Dados Selecionados", cada lado com busca, checkbox por item, marcar todos, contador; botões mover →/←; duplo clique move; lado selecionado reordenável por arrastar (@dnd-kit/sortable, com suporte a teclado).
- **Ordenação** (acordeão): lista de chaves de ordenação escolhidas entre as colunas selecionadas, cada uma com asc/desc, reordenável. Sem ordenação: ordem por nome.

## 9. Emissão

1. Validação bloqueia "Emitir" quando: nenhum registro selecionado, nenhuma coluna selecionada, título vazio em Grade/Tabular.
2. Server action `gerarDadosRelatorio({ entidade, ids, colunas, ordenacao, anoReferencia? })`:
   - valida entrada (zod; keys contra o catálogo; ids ≤ 2000);
   - checa permissão do módulo;
   - busca base + só as relações exigidas pelas colunas (sem N+1: uma query por relação com `in (ids)`);
   - resolve colunas, ordena (`localeCompare('pt-BR', { sensitivity: 'base' })`, multi-chave);
   - retorna `{ cabecalho: string[], linhas: string[][] }`.
3. Cliente repete cada linha `copias` vezes em sequência, renderiza no formato e dispara download (`<nome-template-ou-entidade>-<yyyyMMdd-HHmm>.<pdf|csv>`).
4. Erros: toast com mensagem legível; log do detalhe no server. "Cancelar" volta aos defaults do template carregado.

### 9.1 Renderizadores
- **Cabeçalho institucional compartilhado** (`cabecalho.ts`): extrair de `renderCabecalho` (`src/lib/documents/declaracao-pdf.ts`) — logo, nome, resolução (de `companies` via credenciamento vigente), data/hora de emissão, título, subtítulo. Declaração passa a usar o helper extraído (sem mudar o resultado visual).
- **Etiqueta:** geometria por modelo (página, margens, tamanho da etiqueta, pitch H/V, colunas×linhas) em tabela de constantes; fonte monoespaçada no tamanho escolhido; uma linha por coluna selecionada; texto cortado (clip) na largura da etiqueta sem quebra; linhas excedentes à altura cortadas; nova página quando cheia; descrição para impressão no rodapé da página, se preenchida.

  | Modelo | Papel | Col×Lin | Etiqueta (mm) |
  |---|---|---|---|
  | 6180 | Carta 215,9×279,4 | 3×10 | 66,7×25,4 |
  | 6181 | Carta 215,9×279,4 | 2×10 | 101,6×25,4 |
  | A4256 / 6280 | A4 210×297 | 3×11 | 63,5×25,4 |
  | A4362 | A4 210×297 | 2×8 | 99,0×33,9 |
  (Margens e pitch conferidos contra folha real na implementação.)

- **Grade PDF:** retrato A4; por registro, tabela autoTable 2 colunas (rótulo em negrito | valor), bloco não se parte entre páginas; espaço entre blocos; rodapé com paginação "n/N" e descrição; "Quantidade: N" ao final.
- **Tabular PDF:** paisagem A4; autoTable com cabeçalho de colunas repetido por página, quebra de linha nas células, largura proporcional; rodapé idem; "Quantidade: N".
- **CSV:** separador `;`, BOM UTF-8, cabeçalho com labels, escape RFC 4180 (`"`, `;`, quebras de linha), `\r\n`.

## 10. Estrutura de código

```
src/lib/relatorio-dinamico/
  tipos.ts                  ColunaDef, TemplateConfig (zod), Formato, Entidade
  catalogo/aluno.ts
  catalogo/funcionario.ts
  catalogo/professor.ts
  catalogo/index.ts         getCatalogo(entidade, perms)
  dados/aluno.ts            busca/resolve server
  dados/funcionario.ts
  dados/professor.ts
  ordenar.ts
  render/cabecalho.ts
  render/etiqueta.ts        + modelos-etiqueta.ts
  render/grade.ts
  render/tabular.ts
  render/csv.ts
src/app/(app)/relatorios/dinamico/
  alunos/page.tsx
  funcionarios/page.tsx
  professores/page.tsx
  actions.ts                gerarDadosRelatorio, listar/salvar/excluirTemplate, listarRegistros
src/components/relatorio-dinamico/
  relatorio-dinamico-page.tsx
  leiaute-form.tsx
  lista-dupla.tsx
  ordenacao.tsx
  filtros-aluno.tsx
  filtros-rh.tsx
  stepper.tsx
  segmentado.tsx
```

## 11. Design system

Seguir `docs/design_system/REGRAS-CLAUDE-CODE.md`: cor só via token, sem serifa, paridade claro/escuro, reuso de `ds-*` e `src/components/ui/*`. Componentes novos (lista dupla, stepper, segmentado Sim/Não, acordeão via `<details>`) nascem tokenizados. Telas sem protótipo → meta de consistência com o DS (sem screenshot-diff).

## 12. Testes (vitest)

- Resolvers do catálogo: pai/mãe por parentesco, responsável financeiro/pedagógico, "Celulares" concatenado, endereço principal, idade, nº de chamada.
- Etiqueta: posição x/y por índice nos 4 modelos, quebra de página, cópias em sequência, clip de texto.
- CSV: escape de `;`, `"`, quebra de linha; BOM; `\r\n`.
- Ordenação multi-chave, acentos pt-BR, asc/desc.
- zod de `TemplateConfig` (formato × campos obrigatórios, limites de cópias/fonte).
- `gerarDadosRelatorio` rejeita entidade/coluna desconhecida e usuário sem permissão; coluna salarial oculta sem permissão RH.
- `npm run typecheck && npm run build` verdes a cada fase; `npm run test` antes do PR.

## 13. Fases

1. **Banco:** `relatorio_templates`, `employees.perfil_id` + backfill, RBAC; campo de vínculo no cadastro de funcionário.
2. **Motor:** tipos, zod, ordenação, renderizadores (etiqueta/grade/tabular/csv), cabeçalho extraído, testes.
3. **Relatório Aluno:** catálogo, dados, filtros, página, templates.
4. **Relatório Funcionário.**
5. **Relatório Professor.**
6. **Menu** (topbar) e verificação final.

Branch dedicada; commit por fase.
