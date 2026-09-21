# Spec — Módulo Comercial (Produtos, Estoque e Receitas) + Livro-Razão Financeiro Unificado

> Documento de especificação para implementação via Claude Code.
> Projeto: `rrb-escola` — Next.js 14 (App Router) + Supabase (Postgres) + TypeScript + Zod + Tailwind + Recharts.
> Autor da decisão de produto: Rodrigo Reis. Status: a implementar.

---

## 1. Contexto e problema

A escola hoje tem **dois silos financeiros que não conversam**:

- `financeiro` (`financeiro_v2`): cobranças e pagamentos de **mensalidade/matrícula**.
- `despesas` (`categorias_despesa`, `despesas`): saídas operacionais (folha, INSS, FGTS, contas).

Surgiu uma terceira necessidade: a escola **vende produtos e capta receitas** — apostilas, uniformes, terceirização da lanchonete, eventos e feiras. O módulo `despesas` é simples demais e cobre só um lado (saída).

**Erro a evitar:** criar "venda de uniforme" como um terceiro silo, ou empurrar tudo para uma tabela genérica de movimento. Venda de produto carrega um negócio (produto, variação, estoque, comprador) que não cabe numa linha de despesa.

## 2. Decisão arquitetural central (LER PRIMEIRO)

Separar em **duas camadas independentes que se conectam por referência de origem**:

1. **Camada Financeira (livro-razão):** toda movimentação de dinheiro é um `lancamento_financeiro` (`tipo = RECEITA | DESPESA`). Generaliza o atual `despesas` sem destruí-lo.
2. **Camada Comercial (operações de negócio):** `venda` + `venda_item`, com `produto` e `produto_variacao` (SKU), e `movimento_estoque`. É o que gera os lançamentos.

O elo: `lancamento_financeiro.origem_tipo` + `origem_id` apontam para a operação que originou o dinheiro (`venda`, `despesa`, futuramente `cobranca`).

> **DECIDIDO:** o `despesas` atual **migra** para `lancamento_financeiro`, e `categorias_despesa` evolui para `categorias_financeiras` (com `tipo`). A migração de mensalidades (`financeiro_v2`) fica **fora de escopo** nesta entrega — apenas deixamos `origem_tipo='cobranca'` reservado para consolidação futura.

## 3. Escopo

### Dentro
- Cadastro de **produtos** com flag `controla_estoque` por produto.
- **Variações/SKU** (uniforme: peça × tamanho × gênero). Estoque e `estoque_minimo` vivem na variação.
- **Movimento de estoque** como fonte de verdade (saldo = soma de movimentos; nunca editar quantidade direto).
- **Vendas** com itens, parcelas e comprador (aluno opcional / nome livre).
- **Livro-razão financeiro** unificado (`lancamento_financeiro`), receita e despesa.
- **Categorias financeiras** hierárquicas com `tipo` (receita/despesa) — base de DRE.
- **Receita recorrente** (contrato da lanchonete) gerando lançamentos.
- **Evento/feira como centro de custo**: agrupa receitas e despesas para ver rentabilidade.
- **Relatórios** (ver seção 7).

### Fora (não-objetivos)
- Reescrever `financeiro_v2` (mensalidades). Só reservar gancho de consolidação.
- NF-e / emissão fiscal.
- Estoque para apostila (apostila = `controla_estoque = false`; é sob demanda).
- Multi-moeda, multi-armazém.

## 4. Convenções do projeto (seguir à risca)

- **Migrations:** `supabase/migrations/AAAAMMDDNNNN_nome.sql`. Próximo bloco sugerido: `202606140001_*` em diante.
- **Enums:** `do $$ begin create type X as enum (...); exception when duplicate_object then null; end $$;`
- **Scoping multi-tenant:** toda tabela tem `escola_id uuid not null references escolas(id) on delete cascade`.
- **RLS (DECIDIDO):** habilitar em toda tabela; política `for all` usando `current_perfil()`. Dois níveis de acesso:
  - **Tabelas comerciais** (`produto`, `produto_variacao`, `movimento_estoque`, `venda`, `venda_item`): `'admin'`, `'financeiro'`, **`'secretaria'`**.
  - **Livro-razão** (`lancamento_financeiro`, `categorias_financeiras`, `contrato_receita`, `contas_financeiras`): apenas `'admin'`, `'financeiro'`. **Secretaria não acessa o razão.**
  - A secretaria gera receita **somente** via RPC `confirmar_venda` (declarada `security definer`), que escreve no razão por cima do RLS. Nenhum `insert` direto de secretaria em `lancamento_financeiro`.

- **RBAC / menu / route gating (OBRIGATÓRIO — a spec antes omitia a mecânica real):** RLS no banco **não** é suficiente. O projeto usa um segundo sistema, keyed pela mesma string de perfil, que controla o menu e o gating de rota. **Toda tela nova exige atualizar TRÊS lugares** (ver comentário em `src/lib/auth/permissions.ts`, linhas ~64-66):
  1. **`MODULOS`** (objeto TS em `permissions.ts`) — adicionar os códigos de módulo.
  2. **Seed no banco** — `insert` em `modulos` **e** `role_permissoes` (migration). Colunas reais: `modulos(codigo, grupo, nome, ordem)`; `role_permissoes(role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)`. Sempre `on conflict ... do nothing` (idempotente). Espelhar `supabase/migrations/202606120007_eventos_rbac_garantia.sql`.
  3. **`ROTA_PARA_MODULO`** (em `permissions.ts`) — mapear cada rota nova ao seu código de módulo (longest-prefix match).
  - **Grupo "Comercial" (DECIDIDO):** adicionar `'comercial'` ao array `GRUPOS` e a `GRUPO_LABEL` em `permissions.ts` (= a aba "Comercial" do dashboard). `grupo` organiza/rotula os módulos; quem concede acesso é `role_permissoes`. Os módulos comerciais ficam em `grupo='comercial'` e recebem permissão para `admin`/`financeiro`/`secretaria`.
  - Códigos de módulo a criar: `comercial.produtos`, `comercial.estoque`, `comercial.vendas` (grupo `comercial`); `financeiro.lancamentos` (grupo `financeiro`, sucessor de `despesas`). Conceder `financeiro.lancamentos` só a `admin`/`financeiro`.
  - Seed de exemplo (ajustar `ordem`):
    ```sql
    insert into modulos (codigo, grupo, nome, ordem) values
      ('comercial.produtos', 'comercial', 'Produtos', 60),
      ('comercial.estoque',  'comercial', 'Estoque', 61),
      ('comercial.vendas',   'comercial', 'Vendas', 62),
      ('financeiro.lancamentos', 'financeiro', 'Livro-Razão', 35)
    on conflict (codigo) do nothing;

    insert into role_permissoes
      (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar) values
      ('admin','comercial.produtos', true,true,true,true),
      ('financeiro','comercial.produtos', true,true,true,true),
      ('secretaria','comercial.produtos', true,true,true,false),
      ('admin','comercial.estoque', true,true,true,true),
      ('financeiro','comercial.estoque', true,true,true,true),
      ('secretaria','comercial.estoque', true,true,true,false),
      ('admin','comercial.vendas', true,true,true,true),
      ('financeiro','comercial.vendas', true,true,true,true),
      ('secretaria','comercial.vendas', true,true,true,false),
      ('admin','financeiro.lancamentos', true,true,true,true),
      ('financeiro','financeiro.lancamentos', true,true,true,true)
    on conflict (role_codigo, modulo_codigo) do nothing;
    ```
  - **Ordem de execução importa:** o seed depende de `modulos`/`role_permissoes`/`roles` já existirem (criados em `202605300001_rbac_permissoes.sql`). Como as migrations novas são posteriores, está seguro.
- **Timestamps:** `criado_em timestamptz not null default now()`, `atualizado_em` com trigger `set_*_atualizado_em()` (copiar padrão de `202605270001_despesas.sql`).
- **Autoria:** `criado_por uuid references perfis(id) on delete set null`.
- **Camadas de código:**
  - SQL: `supabase/migrations/`
  - Validação Zod: `src/lib/validation/<modulo>.ts`
  - Acesso a dados (server, read): `src/lib/data/<modulo>.ts`
  - Server actions (mutations): `src/lib/actions/<modulo>.ts`
  - Lógica pura/cálculo: `src/lib/<modulo>/*.ts` (testável com Vitest)
  - UI: `src/components/<modulo>/*` e páginas em `src/app/(app)/<modulo>/`
- **Exports:** reusar `exceljs` (xlsx) e `jspdf`/`jspdf-autotable` (pdf) já presentes.
- **Gráficos:** `recharts`.
- **Testes:** Vitest (`npm run test`), seguindo `vitest.config.ts`. Lógica de saldo de estoque e de parcelas DEVE ter teste unitário.

## 5. Modelo de dados

### 5.1 Categorias financeiras (evolui de `categorias_despesa`)

```sql
create type tipo_lancamento as enum ('receita','despesa');

create table categorias_financeiras (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  nome text not null,
  tipo tipo_lancamento not null,
  parent_id uuid references categorias_financeiras(id) on delete restrict, -- hierarquia p/ DRE
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (escola_id, nome, tipo)
);
```
> Migração: copiar dados de `categorias_despesa` para cá com `tipo='despesa'`; manter `categoria_id` antigo mapeado.

### 5.2 Livro-razão (generaliza `despesas`)

```sql
create type status_lancamento as enum ('aberta','paga','cancelada');
create type forma_pagamento as enum ('pix','dinheiro','cartao','boleto','transferencia');
create type origem_lancamento as enum ('despesa','venda','contrato','evento','cobranca','manual');

create table lancamento_financeiro (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  tipo tipo_lancamento not null,
  competencia text not null check (competencia ~ '^\d{4}-\d{2}$'),
  descricao text not null,
  categoria_id uuid references categorias_financeiras(id) on delete restrict,
  contraparte text,                 -- fornecedor (despesa) ou cliente (receita)
  valor numeric(12,2) not null check (valor > 0),
  data_vencimento date not null,
  data_pagamento date,              -- null = em aberto (regime de caixa)
  forma_pagamento forma_pagamento,
  status status_lancamento not null default 'aberta',
  conta_id uuid references contas_financeiras(id) on delete restrict, -- caixa/banco (opcional fase 1)
  origem_tipo origem_lancamento not null default 'manual',
  origem_id uuid,                   -- aponta p/ venda/contrato/evento/etc
  evento_id uuid references eventos_escola(id) on delete set null,    -- centro de custo
  comprovante_path text,
  criado_por uuid references perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index lancamento_escola_comp_idx on lancamento_financeiro (escola_id, competencia);
create index lancamento_tipo_status_idx on lancamento_financeiro (tipo, status);
create index lancamento_origem_idx on lancamento_financeiro (origem_tipo, origem_id);
```
> **Regime contábil:** os totais (Total / Pago / Em aberto / Vencido) são calculados **por regime de caixa** (`data_pagamento`). Documentar isso na UI. Manter `competencia` para visão de competência nos relatórios.

### 5.3 Produtos e variações (SKU)

```sql
create type tipo_produto as enum ('uniforme','apostila','outro');

create table produto (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  nome text not null,
  tipo tipo_produto not null,
  controla_estoque boolean not null default false, -- uniforme=true, apostila=false
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table produto_variacao (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  produto_id uuid not null references produto(id) on delete cascade,
  sku text,
  atributos jsonb not null default '{}'::jsonb,  -- {"tamanho":"M","genero":"unissex"}
  preco_venda numeric(12,2) not null check (preco_venda >= 0),
  custo numeric(12,2) not null default 0,        -- p/ valorizar estoque parado
  estoque_minimo integer not null default 0,     -- alerta "tamanho acabando" é por variação
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (escola_id, produto_id, sku)
);
create index variacao_produto_idx on produto_variacao (produto_id);
```

### 5.3.1 Variação por tipo de produto (detalhe do uniforme)

**Princípio:** `atributos jsonb` continua sendo o **armazenamento** (não criar colunas `tamanho`/`genero`/`peca`). O que muda por tipo é como o formulário e a validação tratam esse jsonb.

**Estrutura (em código) — quais dimensões cada tipo tem.** Arquivo `src/lib/comercial/atributos.ts`:

```ts
export type Dimensao = { chave: string; rotulo: string; obrigatorio: boolean };

export const DIMENSOES_POR_TIPO: Record<TipoProduto, Dimensao[]> = {
  uniforme: [
    { chave: "peca",    rotulo: "Peça",    obrigatorio: true },
    { chave: "tamanho", rotulo: "Tamanho", obrigatorio: true },
    { chave: "genero",  rotulo: "Gênero",  obrigatorio: true },
  ],
  apostila: [], // sem dimensões → variação única
  outro:    [], // padrão: variação única (ou 1 dimensão livre, se quiser)
};
```

- `tipo='uniforme'` → o formulário de variação renderiza 3 selects (peça, tamanho, gênero), preenchidos da tabela `atributo_opcao` (abaixo).
- `tipo` sem dimensões → o produto tem **uma única `produto_variacao` default** (`atributos = '{}'`), criada automaticamente ao salvar o produto. `venda_item` sempre aponta para uma variação — invariante uniforme para todos os tipos, sem `if` no fluxo de venda.

**Valores (em dados) — quais opções e em que ordem.** Tabela única e enxuta, por escola (resolve ordenação e padronização):

```sql
create table atributo_opcao (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  tipo_produto tipo_produto not null,
  dimensao text not null,            -- 'peca' | 'tamanho' | 'genero'
  valor text not null,               -- 'M', 'camiseta', 'feminino'
  rotulo text not null,              -- 'M', 'Camiseta', 'Feminino'
  ordem smallint not null default 0, -- ORDEM CORRETA (PP<P<M<G<GG...) e ordenação do relatório
  ativo boolean not null default true,
  unique (escola_id, tipo_produto, dimensao, valor)
);
create index atributo_opcao_lookup_idx
  on atributo_opcao (escola_id, tipo_produto, dimensao, ordem);
```

Seed inicial de uniforme (ajustar à realidade da escola):

```sql
-- peças
insert into atributo_opcao (escola_id, tipo_produto, dimensao, valor, rotulo, ordem) values
  (:escola, 'uniforme','peca','camiseta','Camiseta',1),
  (:escola, 'uniforme','peca','camisa_polo','Camisa Polo',2),
  (:escola, 'uniforme','peca','calca','Calça',3),
  (:escola, 'uniforme','peca','bermuda','Bermuda',4),
  (:escola, 'uniforme','peca','short_saia','Short-saia',5),
  (:escola, 'uniforme','peca','agasalho','Agasalho / Blusa de frio',6)
on conflict do nothing;
-- tamanhos (ORDEM é o que faz o relatório fazer sentido)
insert into atributo_opcao (escola_id, tipo_produto, dimensao, valor, rotulo, ordem) values
  (:escola,'uniforme','tamanho','2','2 (Infantil)',1),
  (:escola,'uniforme','tamanho','4','4 (Infantil)',2),
  (:escola,'uniforme','tamanho','6','6 (Infantil)',3),
  (:escola,'uniforme','tamanho','8','8 (Infantil)',4),
  (:escola,'uniforme','tamanho','10','10 (Infantil)',5),
  (:escola,'uniforme','tamanho','12','12 (Infantil)',6),
  (:escola,'uniforme','tamanho','14','14 (Infantil)',7),
  (:escola,'uniforme','tamanho','PP','PP',8),
  (:escola,'uniforme','tamanho','P','P',9),
  (:escola,'uniforme','tamanho','M','M',10),
  (:escola,'uniforme','tamanho','G','G',11),
  (:escola,'uniforme','tamanho','GG','GG',12),
  (:escola,'uniforme','tamanho','XGG','XGG',13)
on conflict do nothing;
-- gênero
insert into atributo_opcao (escola_id, tipo_produto, dimensao, valor, rotulo, ordem) values
  (:escola,'uniforme','genero','unissex','Unissex',1),
  (:escola,'uniforme','genero','masculino','Masculino',2),
  (:escola,'uniforme','genero','feminino','Feminino',3)
on conflict do nothing;
```

> RLS de `atributo_opcao`: mesma das tabelas comerciais (`admin`/`financeiro`/`secretaria`).

**Unicidade da variação de uniforme.** Não pode existir duas variações com a mesma combinação peça+tamanho+gênero no mesmo produto. Como mora em jsonb, usar índice de expressão:

```sql
create unique index uniforme_combo_uniq on produto_variacao (
  produto_id,
  (atributos->>'peca'),
  (atributos->>'tamanho'),
  (atributos->>'genero')
) where (atributos ? 'peca');  -- só aplica quando há dimensões (uniforme)
```

**SKU automático (opcional, recomendado).** Para uniforme, gerar `sku` legível a partir das opções, ex.: `UNI-CAMI-M-U` (`peça`-`tamanho`-`inicial do gênero`). Mantém `unique(escola_id, produto_id, sku)` já previsto. Para tipos sem dimensão, `sku` opcional/nulo.

**Validação (Zod, `src/lib/validation/comercial.ts`).**
- `tipo='uniforme'`: exigir `peca`, `tamanho`, `genero`; cada valor precisa existir em `atributo_opcao` (ativo) para aquela escola/dimensão. Rejeitar valor fora do catálogo (impede "M" vs "Médio").
- demais tipos: `atributos` deve ser `{}` (ou ignorado); criar variação única default.
- `estoque_minimo` e `preco_venda` são **por variação** (M e GG têm giro e estoque diferentes).

### 5.4 Movimento de estoque (fonte de verdade)

```sql
create type tipo_movimento_estoque as enum ('entrada','saida','ajuste');

create table movimento_estoque (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  variacao_id uuid not null references produto_variacao(id) on delete restrict,
  tipo tipo_movimento_estoque not null,
  quantidade integer not null check (quantidade > 0), -- sempre positivo
  sentido smallint not null default 1 check (sentido in (-1, 1)), -- ver regra abaixo
  custo_unit numeric(12,2),
  data date not null default current_date,
  origem_tipo origem_lancamento,   -- 'venda' p/ saída automática
  origem_id uuid,
  observacao text,
  criado_por uuid references perfis(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index movimento_variacao_data_idx on movimento_estoque (variacao_id, data);

-- saldo via view (fase 1); materializar só se performance exigir
create view saldo_estoque as
select
  v.id as variacao_id,
  v.escola_id,
  coalesce(sum(m.quantidade * m.sentido), 0) as saldo,
  max(case when m.tipo='saida' then m.data end) as ultima_saida
from produto_variacao v
left join movimento_estoque m on m.variacao_id = v.id
group by v.id, v.escola_id;
```
> **DECIDIDO — ajuste com coluna `sentido` (não dois tipos de movimento).** Razão: mantém um único conceito de "ajuste" e deixa o saldo ser uma soma trivial (`Σ quantidade × sentido`), sem `case` por tipo. Regra de preenchimento de `sentido`:
> - `entrada` → sempre `+1` (validar via check/trigger).
> - `saida` → sempre `-1`.
> - `ajuste` → `+1` (contagem achou a mais) ou `-1` (achou a menos), escolhido pelo operador.
>
> Um trigger `before insert` deve forçar `sentido=+1` para entrada e `sentido=-1` para saída, ignorando o que vier do client (só `ajuste` aceita sentido livre). **Saldo nunca é editado direto; só nasce de movimento.** Cobrir com teste Vitest: entrada, saída, ajuste +, ajuste −, e cancelamento.

### 5.5 Vendas

```sql
create type status_venda as enum ('rascunho','confirmada','cancelada');

create table venda (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  aluno_id uuid references alunos(id) on delete set null, -- comprador (opcional)
  cliente_nome text,                                      -- fallback se não for aluno
  status status_venda not null default 'rascunho',
  data_venda date not null default current_date,
  desconto numeric(12,2) not null default 0,
  forma_pagamento forma_pagamento,    -- como o produto foi pago (sempre à vista nesta entrega)
  numero_cupom text,                  -- nº do cupom da maquininha (quando cartão)
  evento_id uuid references eventos_escola(id) on delete set null,
  observacao text,
  criado_por uuid references perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
-- Sem parcelamento nesta entrega: venda é sempre à vista.
-- numero_cupom é obrigatório quando forma_pagamento='cartao' (validar no Zod e/ou check).

create table venda_item (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references venda(id) on delete cascade,
  variacao_id uuid not null references produto_variacao(id) on delete restrict,
  quantidade integer not null check (quantidade > 0),
  preco_unit numeric(12,2) not null check (preco_unit >= 0),
  subtotal numeric(12,2) generated always as (quantidade * preco_unit) stored
);
```

### 5.6 Contrato / receita recorrente (lanchonete)

```sql
create type periodicidade as enum ('mensal');

create table contrato_receita (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  descricao text not null,             -- "Terceirização lanchonete"
  contraparte text,
  valor numeric(12,2) not null check (valor > 0),
  periodicidade periodicidade not null default 'mensal',
  dia_vencimento smallint not null check (dia_vencimento between 1 and 28),
  categoria_id uuid references categorias_financeiras(id) on delete restrict,
  ativo boolean not null default true,
  inicio date not null,
  fim date,
  criado_em timestamptz not null default now()
);
```
> Geração dos lançamentos: RPC `gerar_lancamentos_contratos(competencia)` idempotente (não duplica se já gerado para a competência). Pode ser chamada por job (`src/app/api/jobs`) ou botão manual.

## 6. Regras de negócio críticas

1. **Confirmar venda** (`status: rascunho → confirmada`) é uma transação que, atomicamente:
   - valida saldo suficiente para itens cujo produto tem `controla_estoque=true`; **se faltar saldo, falha e não cria nada (venda a descoberto BLOQUEADA, decidido)**;
   - cria um `movimento_estoque` tipo `saida` (`sentido=-1`) por item com `controla_estoque=true`, com `origem_tipo='venda'`, `origem_id=venda.id`;
   - cria **um único** `lancamento_financeiro` de receita (venda à vista) já com `status='paga'`, `data_pagamento = data_venda`, `forma_pagamento` e `competencia` derivada da data, `origem_tipo='venda'`, `origem_id=venda.id`. Valor = `Σ subtotal − desconto`;
   - Implementar como **RPC Postgres** `confirmar_venda(p_venda_id)`, declarada `security definer` (permite à secretaria gerar o lançamento sem ter acesso direto ao razão). Não fazer em múltiplas chamadas do client.
2. **Cancelar venda confirmada:** estorna com movimentos `entrada` (não deleta histórico) e marca lançamentos como `cancelada`.
3. **Saldo de estoque** = `view saldo_estoque`. Nunca coluna mutável.
4. **Sazonalidade no "estoque parado":** não definir parado só por "X dias sem saída" — uniforme escolar tem baixa temporada (meio do ano). Relatório deve comparar com o mesmo período do ano anterior OU permitir o usuário definir janela/excluir baixa temporada. Documentar a escolha.
5. **Competência vs caixa:** somatórios de caixa usam `data_pagamento`; relatório de competência usa `competencia`. Nunca misturar na mesma coluna.

## 6.7 Atualização de estoque na venda — detalhe da RPC `confirmar_venda`

**O problema que dita o desenho: concorrência.** Saldo é uma `view` (soma de movimentos), não uma coluna. Um fluxo ingênuo "lê saldo → confere → insere saída" tem janela de corrida (TOCTOU): duas vendas simultâneas do último item passam as duas e geram saldo negativo. Como não há linha de saldo para travar, é preciso serializar explicitamente por variação.

**Decisão:** tudo numa única RPC transacional, com **advisory lock por variação**. Mantém "saldo = soma de movimentos" como verdade e não introduz coluna mutável.

```sql
create or replace function confirmar_venda(p_venda_id uuid)
returns uuid                       -- retorna id do lançamento gerado
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venda venda;
  v_item record;
  v_saldo int;
  v_total numeric(12,2);
  v_lanc_id uuid;
  v_escola_atual uuid;
begin
  -- guarda de tenant: security definer ignora RLS, então valide a escola do chamador
  select escola_id into v_escola_atual from current_perfil();

  -- trava a venda (evita dupla confirmação concorrente / idempotência)
  select * into v_venda from venda where id = p_venda_id for update;
  if not found then raise exception 'Venda % não encontrada', p_venda_id; end if;
  if v_venda.escola_id <> v_escola_atual then
     raise exception 'Acesso negado: venda de outra escola';
  end if;
  if v_venda.status <> 'rascunho' then
     raise exception 'Venda % não está em rascunho (status=%)', p_venda_id, v_venda.status;
  end if;

  -- itens COM controle de estoque, ORDENADOS por variacao_id (evita deadlock entre 2 vendas)
  for v_item in
     select vi.variacao_id, sum(vi.quantidade) as quantidade, pv.escola_id
     from venda_item vi
     join produto_variacao pv on pv.id = vi.variacao_id
     join produto p on p.id = pv.produto_id
     where vi.venda_id = p_venda_id and p.controla_estoque
     group by vi.variacao_id, pv.escola_id
     order by vi.variacao_id
  loop
     -- serializa concorrência NESTA variação até o commit
     perform pg_advisory_xact_lock(hashtextextended(v_item.variacao_id::text, 0));

     select coalesce(sum(quantidade * sentido), 0) into v_saldo
     from movimento_estoque where variacao_id = v_item.variacao_id;

     if v_saldo < v_item.quantidade then       -- venda a descoberto BLOQUEADA
        raise exception 'Estoque insuficiente (variação %, saldo %, pedido %)',
           v_item.variacao_id, v_saldo, v_item.quantidade;
     end if;

     insert into movimento_estoque
        (escola_id, variacao_id, tipo, quantidade, sentido, data, origem_tipo, origem_id, criado_por)
     values
        (v_item.escola_id, v_item.variacao_id, 'saida', v_item.quantidade, -1,
         v_venda.data_venda, 'venda', p_venda_id, v_venda.criado_por);
  end loop;

  -- total e lançamento de receita à vista (já pago)
  select coalesce(sum(subtotal), 0) - v_venda.desconto into v_total
  from venda_item where venda_id = p_venda_id;
  if v_total <= 0 then raise exception 'Total da venda inválido (%)', v_total; end if;

  insert into lancamento_financeiro
     (escola_id, tipo, competencia, descricao, contraparte, valor,
      data_vencimento, data_pagamento, forma_pagamento, status,
      origem_tipo, origem_id, evento_id, criado_por)
  values
     (v_venda.escola_id, 'receita', to_char(v_venda.data_venda, 'YYYY-MM'),
      'Venda #' || left(p_venda_id::text, 8), coalesce(v_venda.cliente_nome, 'Consumidor'),
      v_total, v_venda.data_venda, v_venda.data_venda, v_venda.forma_pagamento, 'paga',
      'venda', p_venda_id, v_venda.evento_id, v_venda.criado_por)
  returning id into v_lanc_id;

  update venda set status = 'confirmada', atualizado_em = now() where id = p_venda_id;
  return v_lanc_id;
end $$;

revoke all on function confirmar_venda(uuid) from public;
grant execute on function confirmar_venda(uuid) to authenticated;
```

**Por que cada peça importa:**
- **Uma transação só** (a função): ou todas as saídas + o lançamento + a virada de status acontecem, ou nada. Sem estado parcial.
- **`for update` na venda** + check `status='rascunho'`: dá **idempotência** — segunda chamada concorrente espera e depois falha por status, não dá baixa dobrada.
- **`pg_advisory_xact_lock` por variação**: serializa só as vendas que disputam o mesmo SKU; vendas de SKUs diferentes não se bloqueiam. Trava some no commit/rollback.
- **`order by variacao_id`** antes de travar: duas vendas com SKUs em comum travam na mesma ordem → sem deadlock.
- **Guarda de tenant** (`current_perfil()`): obrigatória porque `security definer` ignora RLS. Sem ela, a secretaria poderia confirmar venda de outra escola.
- **Volume**: para a escola, `sum()` sobre o histórico de movimentos é barato. Se algum dia o volume crescer, materialize um cache de saldo (trigger) e troque o advisory lock por `select ... for update` na linha de cache — sem mudar o resto.

**Estorno — `cancelar_venda(p_venda_id)`** (mesma blindagem):
- Só cancela venda `confirmada`; valida tenant; `for update` na venda.
- Para cada saída originada (`movimento_estoque where origem_tipo='venda' and origem_id=p_venda_id and tipo='saida'`), cria um movimento **`entrada` (sentido +1)** de igual quantidade (estorno — **não deleta histórico**).
- Marca o `lancamento_financeiro` de origem como `status='cancelada'` (não apaga).
- `update venda set status='cancelada'`.

**Vendas sem controle de estoque** (apostila, `controla_estoque=false`): o laço de estoque simplesmente não as inclui (`where p.controla_estoque`); geram só o lançamento de receita. Mesma RPC, sem ramo especial no client.

## 7. Relatórios (decididos)

Todos com filtro por `escola_id`, período e categoria; export xlsx + pdf; gráfico recharts onde fizer sentido.

1. **Tamanhos acabando / reposição:** variações com `saldo <= estoque_minimo`, só de produtos `controla_estoque=true`. **Desenho da tela:**
   - Agrupar por **produto → peça**; dentro, uma linha por **tamanho**, com gênero como coluna/sub-agrupamento quando o produto tiver variação de gênero.
   - **Ordenar tamanho por `atributo_opcao.ordem`** (join por `tipo_produto='uniforme'`, `dimensao='tamanho'`, `valor = atributos->>'tamanho'`). Nunca ordenar alfabeticamente — sairia G, GG, M, P, PP (errado).
   - Por linha: `saldo` atual, `estoque_minimo`, e um realce visual quando `saldo <= estoque_minimo` (e crítico quando `saldo = 0`).
   - Ação rápida inline: "registrar entrada" abre um `movimento_estoque` tipo `entrada` para aquela variação (sem sair da tela).
   - Acessível à `secretaria` (é operacional). Export xlsx/pdf.
   - Query base (esboço): saldo de `saldo_estoque` ⋈ `produto_variacao` ⋈ `produto` (`controla_estoque`) ⋈ `atributo_opcao` (ordem), filtrando `saldo <= estoque_minimo`, ordenado por produto, peça(ordem), tamanho(ordem).
2. **Estoque parado:** variações sem `saida` na janela configurada, com **ajuste de sazonalidade** (ver regra 6.4). Mostrar dias parado e valor imobilizado (`saldo × custo`).
3. **Valor imobilizado em estoque:** `Σ saldo × custo` por produto/variação. Número que dói e ninguém vê.
4. **Curva ABC:** classifica variações por giro (volume de `saida` no período). Sai do mesmo dado, sem tabela nova.
5. **DRE simplificado / resultado por categoria:** receitas e despesas do livro-razão agrupadas por `categorias_financeiras` (hierárquico), por competência. Inclui resultado **por evento** (centro de custo) — "a feira deu lucro?".

## 8. UI (páginas)

- **Nova aba "Comercial" no dashboard/menu**, agrupando as telas comerciais (visível para `admin`/`financeiro`/`secretaria`):
  - `src/app/(app)/comercial/produtos/` — lista, novo, editar produto + variações.
  - `src/app/(app)/comercial/estoque/` — saldo por variação, registrar entrada/ajuste, alertas de reposição.
  - `src/app/(app)/comercial/vendas/` — lista, nova venda (aluno/variação/qtd, forma de pagamento, nº cupom), confirmar.
- `src/app/(app)/financeiro/lancamentos/` — livro-razão unificado (receita+despesa), sucessor da tela atual de `despesas`. Visível só para `admin`/`financeiro`.
- `src/app/(app)/relatorios/` — adicionar os 5 relatórios da seção 7 (estoque parado/reposição visíveis à secretaria; DRE só financeiro/admin).
- A entrada do menu deve respeitar o perfil: secretaria vê "Comercial", não vê o razão nem folha. Seguir o padrão de gating de menu já usado em `src/components/layout/topbar.tsx` e `src/lib/auth/permissions.ts`.
- Reaproveitar componentes de `src/components/despesas/` como base de estilo das telas financeiras.

## 9. Faseamento (entregar nesta ordem)

- **Fase 0 — Migração financeira:** `categorias_financeiras` + `lancamento_financeiro`; migrar dados de `despesas`/`categorias_despesa`; reapontar a UI de despesas para o livro-razão; **seed RBAC de `financeiro.lancamentos`** (módulo + role_permissoes + MODULOS + ROTA_PARA_MODULO). Sem estoque ainda. Entrega valor sozinha (receita+despesa num lugar só).
  - **Cuidado com o enum (`forma_pagamento`):** já existe `forma_pagamento_despesa` (mesmos 5 valores). A spec cria um enum novo `forma_pagamento`. Ao migrar `despesas.forma_pagamento` (tipo antigo) para `lancamento_financeiro.forma_pagamento` (tipo novo), Postgres **não** faz cast implícito entre dois enums distintos — usar cast explícito por texto: `old.forma_pagamento::text::forma_pagamento`. Sem isso a migração quebra. Alternativa: renomear/reusar o enum existente — mas o caminho do cast é mais simples e não mexe em objeto já em uso.
- **Fase 1 — Comercial sem estoque:** `produto`, `produto_variacao`, `atributo_opcao` (+ seed uniforme), `DIMENSOES_POR_TIPO` (TS), `venda`, `venda_item`, RPC `confirmar_venda` gerando receita; índice único de combinação para uniforme; criação automática de variação default para tipos sem dimensão. RBAC de `comercial.produtos`/`comercial.vendas` + grupo `comercial`. Apostila já funciona aqui (`controla_estoque=false`, variação única). Estoque (saldo/movimento) ainda não — vendas de uniforme nesta fase não baixam saldo (ou trava-se a venda de uniforme até a Fase 2; decisão de implementação a registrar).
- **Fase 2 — Estoque:** `movimento_estoque`, `view saldo_estoque`, saída automática na confirmação de venda, telas de entrada/ajuste, alertas de reposição.
- **Fase 3 — Recorrência + relatórios analíticos:** `contrato_receita` + RPC de geração; relatórios 2/3/4/5 com sazonalidade e DRE/centro de custo.

## 10. Critérios de aceite

- [ ] Toda tabela nova tem `escola_id`, RLS habilitada e política via `current_perfil()` restrita a `admin`/`financeiro` (+`comercial` se criado).
- [ ] `confirmar_venda` é atômica (RPC); com estoque insuficiente, falha e não cria lançamento nem movimento.
- [ ] **Concorrência:** duas confirmações simultâneas do último item não geram saldo negativo (uma confirma, a outra falha por estoque insuficiente). Cobrir com teste que dispara as duas RPCs em paralelo.
- [ ] **Dupla confirmação:** confirmar uma venda já `confirmada` falha por status — sem baixa de estoque dobrada.
- [ ] **Tenant:** `confirmar_venda`/`cancelar_venda` rejeitam venda de outra escola (guarda via `current_perfil()`, pois são `security definer`).
- [ ] `cancelar_venda` estorna com movimento `entrada` (não deleta) e marca lançamento `cancelada`.
- [ ] Saldo de estoque jamais é gravado direto; testes Vitest cobrem entrada/saída/ajuste/cancelamento.
- [ ] Cancelar venda estorna estoque (movimento `entrada`) e marca lançamentos `cancelada` — sem deletar histórico.
- [ ] Totais financeiros documentam explicitamente regime de caixa vs competência.
- [ ] Relatório "tamanhos acabando" opera em nível de variação, não de produto.
- [ ] "Estoque parado" não dispara alarme falso na baixa temporada (regra de sazonalidade aplicada).
- [ ] Migrations rodam limpas em base zerada e em base com dados de `despesas` existentes (idempotência).
- [ ] **Cada tela nova aparece no menu e passa no route gating** — ou seja, os 3 pontos de RBAC foram atualizados (MODULOS + seed `modulos`/`role_permissoes` + ROTA_PARA_MODULO). Testar logando como `secretaria` (vê Comercial, não vê razão/folha) e como `financeiro` (vê razão).
- [ ] Migração de `forma_pagamento` usa cast explícito por texto (`::text::forma_pagamento`); migration não quebra por incompatibilidade de enum.
- [ ] `npm run typecheck`, `npm run lint` e `npm run test` passam.

## 11. Decisões — TRAVADAS

1. **Migrar `despesas`** para o livro-razão unificado. ✓
2. **Perfil `'secretaria'`** para o módulo Comercial (sem acesso ao razão); nova aba "Comercial" no dashboard. ✓
3. **Bloquear venda a descoberto** (sem saldo, a confirmação falha). ✓
4. **Ajuste com coluna `sentido`** (+1/−1); entrada/saída têm sentido forçado por trigger. ✓
5. **Sem parcelamento** — venda à vista, lançamento único já `pago`. Registrar `forma_pagamento` e `numero_cupom` (cupom da maquininha; obrigatório quando cartão). ✓
