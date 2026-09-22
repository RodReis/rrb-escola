# Financeiro — Repasse isaac real + Multi-CNPJ — Design

**Data:** 2026-09-21
**Status:** em execução — Fase A1 implementada, A2 escrita e pendente de rodar; Fase B aprovada, quebrada em 5 PRs
**Histórico:** aprovado para spec 2026-09-21; Fase B detalhada e aprovada 2026-09-22 (inclui checagem `tipo_vaga` × parcela de mensalidade, pós PR #27); revisado contra o código e o PDF real em 2026-09-22 (parser de resumo validado, restrições de schema levantadas, ordem de PRs definida)
**Frente:** Financeiro — sucede `2026-09-11-sicoob-pix-conciliacao-design.md` (Fases 0–2 daquele spec continuam válidas para Pix de venda/evento/avulso)

## Objetivo

1. Fazer o livro-razão refletir o que o isaac **de fato** repassou (bruto, taxa, ajustes, líquido), por aluno e por CNPJ, em vez de cobranças geradas a partir da planilha de matrículas.
2. Preparar tesouraria e razão para **dois CNPJs**, cada um com a própria conta Sicoob, o próprio app no portal e o próprio certificado A1.

## Decisões tomadas (2026-09-21)

- A mensalidade é cobrada **só pelo isaac** (7,3% de taxa, contrato renovado em 2026; o isaac assume a inadimplência e repassa em duas transferências: dia 05 = 70% e dia 15 = 30%).
- `cobrancas` deixam de ser geradas automaticamente. Ficam para: (a) espelhar as parcelas do isaac, (b) casos avulsos pagos na escola.
- Os dados financeiros gerados para desenvolvimento serão **apagados e recriados** a partir dos analíticos do isaac. **Alunos e matrículas NÃO são tocados.**
- **Congelada:** a frente "receber mensalidade por Pix direto no Sicoob" (conflita com o contrato isaac).
- Cada CNPJ tem certificado e-CNPJ A1 próprio.

## Diagnóstico do estado atual (2026-09-21)

| Achado | Onde | Efeito |
|---|---|---|
| `generateChargesForEnrollment` roda automaticamente ao criar/importar matrícula | `src/lib/actions/students.ts:160`, `src/lib/actions/imports.ts:329`, `src/lib/actions/finance.ts:138` | Toda matrícula nova gera 12 cobranças com o valor do plano |
| Script gera 12 cobranças/aluno a partir de `MATRICULADOS2026.xlsx` | `scripts/gerar_cobrancas_2026.js` | Base de desenvolvimento tratada como real |
| Script marca **todas** as cobranças abertas como pagas no dia 05 com `valor_pago = valor_final` | `scripts/registrar_repasse_isaac.js` | Razão set/2026: R$ 321.432,50 de receita "paga"; inadimplência sempre zero; sem taxa isaac; sem material |
| Trigger espelha todo pagamento como receita "Mensalidades" | `espelhar_pagamento_cobranca_razao()` (`202609110001`) | Material e mensalidade caem na mesma categoria |
| Financeiro sem noção de CNPJ | `contas_bancarias`, `lancamento_financeiro`, `cobrancas` só têm `escola_id` | Impossível ter resultado por CNPJ; `companies` só é usado pelo RH |
| Config Sicoob única | `src/lib/sicoob/config.ts` lê um `SICOOB_CLIENT_ID` e um certificado | Não atende os apps `epg-integrado` e `epg-pinguinho` |
| Cache de token global com chave só por escopo | `src/lib/sicoob/auth.ts` (`tokenCache`) | Com 2 contas, o token de um CNPJ seria usado no outro |
| Fallback de `id_transacao` = `data-descricao-valor` | `src/lib/conciliacao/sync-extrato.ts` `mapItem` | Dois débitos iguais no mesmo dia viram uma linha só (upsert descarta o segundo) |
| Novo lançamento sem empresa e sem conta | `financeiro/lancamentos/novo` | Despesas sem CNPJ |

Referência real (agosto/2026, analíticos isaac):

| Unidade isaac | Bruto (mensalidades) | Ajustes | Base | Taxa | Líquido |
|---|---|---|---|---|---|
| `epg-trindade-educacao-infantil` | 175.736,61 | −2.070,00 | 173.666,61 | 12.654,60 | **161.012,01** |
| `epg-trindade` | 213.545,72 | −2.346,55 | 211.199,17 | 15.509,88 | **195.689,29** |

Resumo do repasse de setembro/2026 (PDF "resumo" do Meu Arco, atualizações de 30/07 a 31/08):

| Linha | Educação Infantil | EPG Trindade |
|---|---|---|
| Mensalidades | 180.690,86 | 215.174,95 |
| Novo contrato (+) | 1.019,50 | 5.960,00 |
| Taxa isaac (−) | 13.241,06 | 16.052,69 |
| Recebido na escola (−) | 3.874,96 | 1.790,00 |
| Cancelado (−) | — | 890,00 |
| **Débito da parcela do crédito de curto prazo (−)** | — | **23.146,54** |
| **Total transferido** | **164.594,34** | **179.255,72** |
| Transferência dia 05 (70%) | 115.216,04 | 125.479,01 |
| Transferência dia 15 (30%) | 49.378,30 | 53.776,71 |

Consequências para o desenho:

1. **O repasse chega em duas transferências (dia 05 = 70%, dia 15 = 30%)**, não em um crédito único. A conciliação casa cada transferência separadamente.
2. **Existe um empréstimo com o isaac ("crédito de curto prazo")**, abatido do repasse da unidade EPG Trindade (R$ 23.146,54 em set/2026). Ele **não aparece no analítico .xlsx** (o de agosto fecha sem ele). A fonte dessa linha é o resumo PDF. É financiamento, não despesa operacional.
3. A taxa efetiva é 7,29% sobre (mensalidades + novo contrato − cancelado), calculada **antes** de "recebido na escola". O importador usa a taxa do arquivo e nunca a recalcula.
4. "Recebido na escola" somou R$ 5.664,96 em setembro. Esse dinheiro entrou na escola por fora do isaac e precisa de cobrança manual com baixa. Senão a receita fica subestimada exatamente nesse valor.

Os totais de agosto (analítico) e de setembro (resumo) são o **critério de aceite** do importador (Fase B).

---

## Fase A — Limpeza e desligamento da geração automática

**Status: A1 implementada** (branch `feat/isaac-fase-a`, commit `11cf691f`, 22/09). A2 escrita, **ainda não executada** no banco.

### A1. Código — feito

- Removidas as chamadas a `generateChargesForEnrollment` nos **três** callers: `students.ts`, `imports.ts` e `finance.ts` (dentro da própria `generateChargesForEnrollmentAction`, que o rascunho anterior deste spec não listava).
- Removidos `GenerateChargesButton`, `generateChargesForEnrollmentAction` e `getEnrollmentChargesPreview` (`src/lib/data/finance.ts`) — esta última só existia para alimentar o botão e ficou órfã.
- Removido `src/lib/server/generate-charges.ts`. **Não havia testes associados** — o rascunho anterior supunha uma rede de segurança que nunca existiu; o refactor foi validado por `typecheck` + `build` + suíte completa (508/508).
- Removidos `scripts/gerar_cobrancas_2026.js` e `scripts/registrar_repasse_isaac.js`.
- **Mantido** o formulário "Gerar lançamento avulso" da tela Cobranças (caso "pagou na escola").
- **Correção de rota adjacente:** em `imports.ts` o insert da matrícula descartava o erro do Supabase em silêncio (`const { data: enrollment }` sem checagem, usado só para gerar cobrança). Passou a registrar via `logSeFalhou`, que é o padrão do laço — lançar abortaria o lote no meio e deixaria as linhas seguintes sem processar.

Total: 531 linhas removidas, 9 adicionadas.

### A2. Dados — script único `scripts/limpar_financeiro_dev.sql`

Escrito (commit `d472703f`), **pendente de execução**. Roda **manualmente**, local primeiro e produção depois, sempre após backup (`scripts/backup_matriculas.mjs` + dump das tabelas abaixo), com ensaio em `rollback` antes do `commit`.

O SQL definitivo está no arquivo. Três correções sobre o rascunho anterior deste spec:

1. **`conciliacao_vinculo` ganhou escopo.** `delete ... where alvo_tipo = 'pagamento'` apagava *todos* os vínculos de pagamento, inclusive de pagamentos que não vêm de cobrança. Passou a ser `where alvo_tipo = 'pagamento' and alvo_id in (select id from pagamentos)`.
2. **`cobrancas` perdeu o `escola_id` hardcoded.** Se o id divergir entre local e produção, o `delete` não apaga nada e o script "passa" em silêncio. A base é mono-escola; sem filtro é mais seguro que com filtro errado.
3. **A ordem é obrigatória, não estética.** `conciliacao_vinculo.alvo_id` e `pix_cobranca.origem_id` são `uuid` solto, sem FK (confirmado em `202609110001:56` e `:105`), então o cascade de `cobrancas` não os alcança e os subselects precisam rodar enquanto as linhas ainda existem.

**Não toca:** `alunos`, `matriculas`, `planos`, `responsaveis_aluno`, folha, `lancamento_financeiro` de origem diferente de `cobranca`, `contas_bancarias`, `extrato_bancario`.

**Aceite A:** `alunos` e `matriculas` com a mesma contagem de antes; razão sem receita de origem `cobranca`; criar uma matrícula nova não gera cobrança.

**Efeito colateral esperado:** `dashboard-executive.ts` lê `cobrancas`/`pagamentos` para receita e inadimplência. Os dashboards ficam zerados até a Fase B reimportar os meses.

---

## Ordem de execução

A Fase B não cabe num PR: são 6 tabelas, 2 parsers, uma RPC transacional, 3 telas e a conciliação. Quebrada assim (aprovado 22/09):

| PR | Conteúdo | Estado |
|---|---|---|
| 1 | Fase A1 + A2 | **feito** (`11cf691f`, `d472703f`) |
| 2 | Migrations: enums (arquivo próprio) + tabelas isaac + `company_id` + RLS + RBAC | — |
| 3 | `parse-resumo.ts` + `parse-analitico.ts` + classificação + normalização/match — funções puras + testes | — |
| 4 | RPC `importar_repasse_isaac` + tela de upload/preview + fila de pendências | — |
| 5 | Reimport de agosto + validação contra os totais conferidos | — |
| 6 | Conciliação das transferências + Fase C (multi-CNPJ) | — |

As colunas `company_id` entram já no PR 2 (Fase B depende delas para gravar a despesa da taxa no CNPJ certo); o resto da Fase C fica para o PR 6.

---

## Fase B — Importador do analítico isaac

### Modelo de dados

**Duas migrations, não uma.** `alter type ... add value` não pode ser usado na mesma transação que o cria nem na mesma em que o valor novo é referenciado. Portanto:

- `202609220003_isaac_enums.sql` — só os `add value` (`origem_lancamento` → `'isaac'`, `alvo_conciliacao` → `'repasse_isaac'`), em arquivo próprio.
- `202609220004_isaac_repasse.sql` — tabelas, colunas, índices, RLS e RBAC.

(`202609220002` já está ocupada por `tipo_vaga_filho_professora_50.sql`, do PR #27 — o rascunho anterior deste spec propunha esse número.)

```sql
-- CNPJ de cada unidade isaac: configurado, nunca inferido do nome do arquivo
create table isaac_unidade (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id),
  company_id uuid not null references companies(id),
  nome_isaac text not null,              -- ex.: 'epg-trindade', 'epg-trindade-educacao-infantil'
  unique (escola_id, nome_isaac)
);

create table isaac_repasse (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id),
  unidade_id uuid not null references isaac_unidade(id),
  competencia_repasse text not null check (competencia_repasse ~ '^\d{4}-\d{2}$'),
  data_repasse date not null,            -- default dia 05; ajustável na conciliação
  bruto numeric(12,2) not null,
  ajustes numeric(12,2) not null,
  base numeric(12,2) not null,
  taxa numeric(12,2) not null,
  liquido numeric(12,2) not null,
  alunos_informados int,                 -- "307 alunos | 327 cobranças" do resumo:
  cobrancas_informadas int,              -- só conferência contra isaac_parcela, nunca fonte de valor
  arquivo_path text,                     -- storage privado, não versionado
  importado_por uuid references perfis(id),
  importado_em timestamptz not null default now(),
  unique (unidade_id, competencia_repasse)
);

-- Linhas do resumo PDF (fonte das linhas que o analítico não traz, ex.: crédito de curto prazo)
create table isaac_repasse_linha (
  id uuid primary key default gen_random_uuid(),
  repasse_id uuid not null references isaac_repasse(id) on delete cascade,
  grupo text not null check (grupo in ('recebimento','desconto','outros')),
  tipo text not null,                    -- 'Mensalidades','Novo contrato','Taxa isaac','Recebido na escola','Cancelado','Débito da parcela do crédito de curto prazo'
  valor numeric(12,2) not null,          -- com sinal
  unique (repasse_id, grupo, tipo)
);

-- Transferências programadas (hoje: dia 05 = 70%, dia 15 = 30%)
create table isaac_transferencia (
  id uuid primary key default gen_random_uuid(),
  repasse_id uuid not null references isaac_repasse(id) on delete cascade,
  data_prevista date not null,
  valor numeric(12,2) not null check (valor > 0),
  extrato_id uuid references extrato_bancario(id),
  unique (repasse_id, data_prevista)
);

create table isaac_parcela (
  id uuid primary key default gen_random_uuid(),
  repasse_id uuid not null references isaac_repasse(id) on delete cascade,
  id_parcela text not null,              -- "Identificador da parcela"
  aluno_id uuid references alunos(id),   -- null = não casou (fila de resolução)
  nome_isaac text not null,
  produto text not null,
  tipo text not null check (tipo in ('mensalidade','material','outro')),
  competencia text not null,             -- competência da parcela (pode ser anterior ao repasse)
  valor_mensalidade numeric(12,2) not null,
  valor_mudanca numeric(12,2) not null,
  valor_base numeric(12,2) not null,
  taxa numeric(12,2) not null,
  valor_final numeric(12,2) not null,
  tipo_mudanca text,
  cobranca_id uuid references cobrancas(id),   -- null enquanto pendente (sem casar OU tipo_vaga incompatível)
  motivo_pendencia text,                       -- null = ok; 'sem_aluno' | 'tipo_vaga_incompativel' | 'permuta_manual'
  unique (repasse_id, id_parcela)
);

create table isaac_mudanca (             -- aba "Mudanças"
  id uuid primary key default gen_random_uuid(),
  repasse_id uuid not null references isaac_repasse(id) on delete cascade,
  id_parcela text not null,
  nome_isaac text not null,
  produto text not null,
  competencia text not null,
  valor numeric(12,2) not null,
  data_mudanca date,
  tipo text not null                     -- 'Cancelado' | 'Recebido na escola' | 'Adicional desc. antecipação' | ...
);

create table aluno_alias (
  aluno_id uuid not null references alunos(id) on delete cascade,
  nome_normalizado text not null,
  fonte text not null default 'isaac',
  primary key (fonte, nome_normalizado)
);

alter table cobrancas add column if not exists origem text not null default 'manual'
  check (origem in ('manual','isaac'));
alter table cobrancas add column if not exists id_externo text;
alter table cobrancas add column if not exists categoria_id uuid references categorias_financeiras(id);
create unique index if not exists cobrancas_id_externo_uidx on cobrancas (origem, id_externo) where id_externo is not null;
```

RLS: mesmo padrão admin/financeiro via `current_perfil()`. RBAC: módulo `financeiro.isaac` (admin: tudo; financeiro: ler/criar).

#### Restrições do schema existente que o importador tem que respeitar

Levantadas ao conferir o código antes de implementar; nenhuma delas é impeditiva, mas todas mudam como a gravação (passo 7) tem que ser escrita.

- **`pagamentos` aceita um único pagamento ativo por cobrança.** Índice único parcial `pagamentos(cobranca_id) where cancelado_em is null` (`202605170001:9`). Uma parcela isaac vira uma cobrança com um pagamento, então o fluxo normal cabe. O que **não** cabe: baixa parcial, ou reimport que tente gravar um segundo pagamento sem cancelar o primeiro. O upsert do passo 7 tem que atualizar o pagamento existente, nunca inserir outro.
- **`cobrancas.valor_final` é coluna GENERATED** (`valor_original - valor_desconto + valor_acrescimo`, `202605130001`). O importador grava `valor_original = valor_base` (o valor pós-ajuste que o isaac de fato considerou) e **deixa desconto e acréscimo em zero**. Os descontos já vêm aplicados pelo isaac; recalcular aqui produziria um número que não existe em lugar nenhum. O desconto concedido fica rastreável em `isaac_parcela.valor_mensalidade` × `valor_base`, não em `cobrancas`.
- **O trigger do razão usa `origem_id = pagamento.id`**, e o lançamento da taxa isaac usa `origem_id = repasse.id`, ambos sob o índice único `(origem_tipo, origem_id)` (`202606140001:75`). Não colidem, porque `origem_tipo` difere (`'cobranca'` × `'isaac'`). Vale registrar porque o índice é parcial e a colisão seria silenciosa.
- **`companies` não tem vínculo com `escolas`.** `isaac_unidade` carrega `escola_id` (para RLS) e `company_id` (para o CNPJ) lado a lado, sem FK entre eles. É o mesmo arranjo que o RH já usa; não é dívida nova, mas significa que nada no banco impede apontar uma unidade para a company de outra escola.

### Fluxo de importação

1. Upload do analítico `.xlsx` **e** do resumo `.pdf` do mesmo mês → escolhe a unidade isaac (o CNPJ vem dela) e a competência do repasse.
   - **Parser é o caminho primário na v1. Validado com protótipo, não suposto** (22/09). Rodado com a própria `pdf-parse` do projeto (API v2: `new PDFParse({ data }).getText()`) contra os dois resumos reais de setembro/2026, o parser fechou **centavo a centavo** nas duas unidades: soma das linhas = total, e soma das transferências = total, batendo 179.255,72 (EPG Trindade) e 164.594,34 (Educação Infantil), com as transferências de 05 e 15 corretas. Ou seja: os números do Aceite B saem do parser, não de digitação.
   - **O texto extraído é sequencial e limpo** — rótulo, `\t`, valor; sem colunas embaralhadas. O parser (`src/lib/isaac/parse-resumo.ts`) varre linha a linha mantendo a seção corrente (`Recebimentos` / `Descontos` / `Outros valores` → `grupo`), e o sinal vem do próprio texto (`- R$`), nunca inferido pelo grupo.
   - **Seções somem quando vazias.** A unidade Educação Infantil não tem "Cancelado" nem "Outros valores" no resumo de setembro. O parser tem que ser orientado a seção/rótulo, **nunca a posição de linha**.
   - **Falha segura, não silenciosa.** Rótulos de ruído (`Valores referentes a parcelas de mensalidades`, `Mudanças em mensalidades`, `Crédito`, `Débito`) são ignorados por lista explícita — se o isaac introduzir um rótulo novo, ele **entra como linha** em vez de sumir, e a dupla validação abaixo quebra ruidosamente. Se um rótulo esperado sumir, a tela cai para os campos digitáveis à mão, pré-preenchidos com o que o parser conseguiu casar. **Nunca inferir** continua valendo: match exato de rótulo, nunca aproximação.
   - **Dupla validação de graça:** `soma(linhas) = total` **e** `soma(transferências) = total`. Duas equações independentes sobre a mesma extração; mudança de layout que passe por uma dificilmente passa pelas duas.
   - **Campo extra, fora do modelo de valores:** o cabeçalho "Recebimentos" traz `<n> alunos | <n> cobranças` (ex.: "307 alunos | 327 cobranças") — cross-check de graça contra `isaac_parcela` daquela unidade/competência, gravado em `isaac_repasse.alunos_informados` / `cobrancas_informadas` (nullable, só conferência), com divergência mostrada na pré-visualização.
   - A checagem de fechamento (passo 8) valida os valores extraídos (ou digitados) contra o analítico de qualquer forma — o parser economiza a digitação, não substitui a validação.
2. **Parser puro** (`src/lib/isaac/parse-analitico.ts`, exceljs) lê as abas "Repasse de Mensalidades" e "Mudanças". Valida colunas pelo nome e falha com mensagem clara se o layout mudar.
3. **Classificação do produto** (`classificarProduto`, função pura): `Mensalidade*`/`Anuidade*` → `mensalidade`; `Materia*`/`Material*` → `material`; o resto → `outro`.
4. **Casamento de aluno**, nesta ordem:
   - (a) `aluno_alias` (fonte `isaac`);
   - (b) `alunos.nome_normalizado`;
   - (c) sem casamento → `aluno_id = null`, `motivo_pendencia='sem_aluno'`, vai para a fila.

   **A normalização do importador tem que ser idêntica à da coluna, senão o match falha em silêncio.** `alunos.nome_normalizado` é GENERATED `lower(immutable_unaccent(nome))` (`202609190002`) — tira acento e caixa, mas **não colapsa espaço duplo nem apara as pontas**. O rascunho anterior deste spec dizia "espaço único", o que produziria uma chave diferente da que está no banco para qualquer nome com espaço duplo. Duas saídas, a decidir na implementação: normalizar no importador exatamente como a coluna (aceitando que "Ana  Silva" com dois espaços não casa), ou comparar contra `regexp_replace(nome_normalizado, '\s+', ' ', 'g')` dos dois lados. Em qualquer caso, **uma função só, compartilhada, com teste que prova a paridade contra a definição da coluna** — é o tipo de divergência que não aparece em erro, só em "esse aluno não casou".

   **Fuzzy nunca casa automaticamente.** Ele só sugere, porque irmãos têm sobrenome igual (ex.: "Laura Rodrigues da Silva" × "Amanda Rodrigues da Silva").
5. **Checagem `tipo_vaga` × parcela de mensalidade** (só roda para parcela com aluno casado e `tipo = 'mensalidade'`; parcela de material nunca é bloqueada por isso). Lê `matriculas.tipo_vaga` da matrícula **ativa** do aluno no ano da competência:
   - `NORMAL` e `BOLSA_50_PORCENTO` → esperado ter mensalidade no isaac. Segue para gravação normal (passo 7), sem checagem extra. O valor gravado é sempre o que o isaac de fato repassou, nunca o valor de tabela recalculado aqui.
   - `BOLSA_INTEGRAL`, `FILHO_PROFESSORA_INTEGRAL`, `ISENTO`, `FILHO_PROFESSORA` → **não deveriam ter mensalidade cobrada pelo isaac.** Se a parcela tem `valor_base > 0`, isso é uma inconsistência entre o cadastro da escola e o cadastro do isaac (aluno marcado como beneficiário aqui, mas isaac ainda cobrando) — não vira `cobranca`/`pagamento` automaticamente. Grava em `isaac_parcela` com `cobranca_id = null`, `motivo_pendencia = 'tipo_vaga_incompativel'`, entra na fila de revisão.
     - `FILHO_PROFESSORA` está neste grupo, e não junto de `BOLSA_50_PORCENTO`, apesar de os dois serem 50% (`percentual_bolsa = 50`, constraint da migration `202609220002`). Motivo: o desconto do filho de professora **é aplicado na folha de pagamento, não no isaac** — o aluno não é cobrado pelo isaac de forma alguma. Confirmado por Rodrigo (22/09) e consistente com os dados: todos os `FILHO_PROFESSORA` do levantamento aparecem na lista de alunos sem mensalidade no isaac. Os dois tipos compartilham o percentual, mas **não** o fluxo de cobrança — o `percentual_bolsa` igual não deve ser usado como critério de roteamento no importador.
     - **Consequência para o razão (a definir):** a contrapartida desses 50% nunca passa pelo isaac nem entra como crédito no extrato Sicoob — ela aparece como dedução no líquido da folha da professora. Se o razão só registrar receita pelo repasse isaac + Pix conciliado, essa parcela de receita simplesmente não existe no livro. `lancamento_financeiro` já tem `folha_run_id`, então o caminho natural é a própria rodada de folha gerar o lançamento correspondente — mas isso é frente de RH/folha, fora do escopo desta Fase B. Fica registrado aqui para não virar buraco silencioso no fechamento.
   - `PERMUTA` → não tem percentual fixo no schema (cada caso é negociado). **Toda parcela de mensalidade de aluno `PERMUTA` cai na fila de revisão manual** (`motivo_pendencia = 'permuta_manual'`), mesmo com `valor_base > 0`. Isso é uma escolha de modelagem deste spec, não uma regra que veio de você — se `PERMUTA` na prática sempre tiver valor previsível (ex.: sempre 30% da mensalidade), dá pra promover para checagem automática depois; até lá, mais seguro revisar caso a caso do que assumir um percentual.
   - Esta checagem **não altera** os totais do repasse nem a checagem de fechamento do passo 8 — ela decide só se uma parcela vira `cobranca` automaticamente ou vai para revisão; o dinheiro que o isaac diz ter transferido é gravado em `isaac_repasse`/`isaac_repasse_linha` de qualquer forma.
6. **Pré-visualização** antes de gravar:
   - totais do arquivo × totais calculados;
   - parcelas sem aluno (`motivo_pendencia='sem_aluno'`);
   - parcelas com `tipo_vaga` incompatível (`motivo_pendencia='tipo_vaga_incompativel'`) — **lista bloqueante**, precisa de decisão manual (corrigir cadastro no isaac, ou confirmar que a cobrança é legítima e ajustar `tipo_vaga` aqui) antes de prosseguir;
   - parcelas de `PERMUTA` para revisão (`motivo_pendencia='permuta_manual'`) — informativo, não bloqueia;
   - alunos com matrícula ativa e `tipo_vaga in ('NORMAL','BOLSA_50_PORCENTO')` sem nenhuma parcela de mensalidade no repasse — sinal de aluno pagante que sumiu do isaac;
   - parcelas cujo valor difere do `valor_mensalidade_praticado`.
7. **Gravação**, numa transação via RPC `importar_repasse_isaac(jsonb)`:
   - `isaac_repasse` + `isaac_parcela` + `isaac_mudanca` (todas as parcelas, inclusive as pendentes — `isaac_parcela` é o espelho fiel do que o isaac mandou);
   - para cada parcela com `valor_base > 0`, aluno casado **e `motivo_pendencia is null`**: upsert em `cobrancas` (`origem='isaac'`, `id_externo=id_parcela`, `valor_original=valor_base`, `valor_desconto=0`, `valor_acrescimo=0`, `categoria_id` pelo tipo) + **upsert** em `pagamentos` (`valor_pago=valor_base`, `data_pagamento=data_repasse`, `forma_pagamento='transferencia'`, `observacao='isaac <competencia_repasse>'`). O pagamento é **update quando já existe um ativo para aquela cobrança**, nunca insert — o índice único parcial `pagamentos(cobranca_id) where cancelado_em is null` recusa o segundo, e um reimport ingênuo quebraria aqui;
   - parcelas com `motivo_pendencia` não nulo **não geram `cobranca`/`pagamento` nesta importação** — ficam disponíveis numa tela de resolução (`/financeiro/isaac/pendencias` ou equivalente) para tratar depois, sem travar o fechamento do mês;
   - **um** `lancamento_financeiro` de despesa "Taxa isaac" (`origem_tipo='isaac'`, `origem_id=repasse.id`, `status='paga'`, `company_id` da unidade).
   - Linha "Débito da parcela do crédito de curto prazo": **um** `lancamento_financeiro` de despesa na categoria "Amortização crédito isaac", marcada como **não operacional**, para ficar fora do resultado operacional. A separação entre principal e juros depende do contrato do crédito (decisão em aberto).
8. **Checagem de fechamento**: mensalidades + novo contrato − taxa − recebido na escola − cancelado ± outros = soma das transferências (independe do que virou `cobranca` ou ficou pendente — é conferência do dinheiro do isaac, não do nosso cadastro). Se não fechar, a importação é **bloqueada**.
9. **Reimportar** o mesmo arquivo é idempotente (`unique` em `id_parcela` e em `(unidade, competencia)`); parcelas resolvidas manualmente numa fila continuam resolvidas (o reimport não reabre `motivo_pendencia` já tratado).

### Ajuste no trigger `espelhar_pagamento_cobranca_razao`

- Categoria = `cobrancas.categoria_id`, com fallback para "Mensalidades".
- `company_id` = o da cobrança (Fase C).

### Conciliação

No sync do extrato, **cada** `isaac_transferencia` é casada separadamente com um crédito na conta do CNPJ da unidade, de mesmo valor (tolerância 0,01) e em até ±3 dias úteis de `data_prevista`. O casamento gera `conciliacao_vinculo(alvo_tipo='repasse_isaac')` e preenche `isaac_transferencia.extrato_id`. Transferência sem crédito até D+3 vira alerta. Diferença de valor também vira alerta, sem ajuste silencioso.

### Reprocessamento de 2026

Importar os analíticos de cada mês de 2026 disponíveis no Meu Arco, por unidade. Escopo esperado: **Fev a Set/2026 × 2 unidades** (~16 analíticos + ~16 resumos; ver decisão 3). Mês sem analítico fica sem receita no razão, com aviso explícito no dashboard. **Não inventar valor.**

Ordem sugerida: importar **um** mês fechado primeiro (agosto, que já tem os números conferidos neste spec), validar o resultado no razão contra o resumo, e só então processar o resto em lote. Reprocessar 8 meses de uma vez sem ter validado o primeiro é como o banco ficou sujo da primeira vez.

### Testes (vitest)

- Parser, classificação e casamento de aluno como funções puras.
- **Fixture sintética:** o repositório tirou planilhas de alunos do versionamento, então nada de nomes reais.
- Teste de aceite com totais sintéticos que reproduzem a estrutura de agosto (base, taxa, ajustes, líquido).

**Aceite B:**
- os analíticos reais de agosto/2026 batem os totais de agosto;
- analítico + resumo de setembro/2026 batem R$ 164.594,34 e R$ 179.255,72, com as transferências de 05 e 15 corretas, centavo a centavo;
- a linha do crédito de curto prazo aparece fora do resultado operacional;
- nenhum dos 58 alunos com `tipo_vaga` em `BOLSA_INTEGRAL`/`FILHO_PROFESSORA_INTEGRAL`/`ISENTO`/`FILHO_PROFESSORA` (classificados via PR #27) gera `cobranca` automática de mensalidade ao reprocessar agosto/2026 — se algum deles tiver `valor_base > 0` no analítico daquele mês, tem que aparecer na fila de pendência, não no livro-razão.

---

## Fase C — Multi-CNPJ

### Dados

```sql
alter table contas_bancarias     add column if not exists company_id uuid references companies(id);
alter table lancamento_financeiro add column if not exists company_id uuid references companies(id);
alter table cobrancas            add column if not exists company_id uuid references companies(id);
alter table contas_bancarias     add column if not exists credencial_ref text;  -- ex.: 'INTEGRADO', 'PINGUINHO'
```

- Lançamentos existentes sem empresa ficam `null` e aparecem com o selo "sem empresa" para classificação manual. **Não há backfill por suposição.**
- Cobranças do isaac recebem o `company_id` da unidade.

### Sicoob por conta

- **Variáveis por referência:**

  ```
  SICOOB_<REF>_CLIENT_ID
  SICOOB_<REF>_CERT_PEM_B64
  SICOOB_<REF>_KEY_PEM_B64
  SICOOB_<REF>_CERT_NOT_AFTER
  ```

  Com `credencial_ref` nulo, o sistema usa as variáveis atuais (compatibilidade).
- `readSicoobConfig(ref)` e `sicoobRequest(path, { ref, scope })`.
- `tokenCache: Map<string, TokenCache>` com chave `${clientId}|${scope}`.
- Um `undici.Agent` por conta, reaproveitado (hoje é criado a cada chamada).
- `syncExtratoSicoob` itera as contas passando o `credencial_ref` de cada uma.
- Health-check e alerta de vencimento do certificado **por conta**.

### Identificador de transação do extrato

Quando `numeroDocumento` vier vazio ou repetido na mesma resposta, usar:

`sha256(conta | data | tipo | valor | descricao | descInfComplementar | ordinal)`

onde `ordinal` é a posição do item entre os itens idênticos da mesma resposta.

**Risco conhecido:** se o Sicoob mudar a ordem entre consultas, pode surgir uma duplicata. Isso é mitigado por um teste que compara duas consultas seguidas da mesma janela em produção antes de ativar o cron.

### UI

- **Novo lançamento:** campos Empresa (obrigatório) e Conta (opcional).
- **Livro-razão, Tesouraria, Conciliação:** filtro por Empresa + visão consolidada.

**Aceite C:**
- duas contas Sicoob ativas sincronizando com credenciais distintas;
- teste unitário prova que o cache não mistura tokens;
- dois débitos idênticos no mesmo dia geram duas linhas.

---

## Fora deste spec (próximas frentes)

1. Categorização de débitos por regra de contraparte + fila "a classificar".
2. Transferência interna (Sicoob A↔B, Sicoob→Caixa).
3. Caixa (OFX) + conciliação com `folha_run`.
4. Previsto × realizado.
5. MCP read-only para o Claude.
6. Pagamentos via API. As regras de aprovação são decisão dos sócios e não estão definidas aqui.
7. **Contrapartida em folha do desconto de `FILHO_PROFESSORA`** (ver Fase B, passo 5). Os 50% que a escola recebe via dedução no líquido da folha não passam pelo isaac nem pelo extrato Sicoob — hoje essa receita não existe em lugar nenhum do razão. Caminho natural: a rodada de folha gerar o `lancamento_financeiro` correspondente via `folha_run_id`. É frente de RH/folha, não deste spec, mas precisa existir para o fechamento fechar de verdade.

## Decisões em aberto (do Rodrigo, não assumidas)

1. ~~CNPJs / mapeamento unidade isaac~~ — **RESOLVIDO (confirmado por Rodrigo, 22/09).** Contra-intuitivo, não seguir o nome:
   - Unidade isaac **"EPG Trindade"** → **Escola Pinguinho de Gente LTDA**, CNPJ 11.714.876/0001-16.
   - Unidade isaac **"EPG Trindade - Educação Infantil"** → **Colégio Integrado EPG**, CNPJ 35.027.047/0001-23.
   - Isso é o oposto do que o nome da unidade sugeria. O importador (Fase B) e o `isaac_unidade` devem gravar esse vínculo explicitamente (não inferir por nome), e o de-para deve ficar comentado no código/migration citando esta confirmação — se o isaac renomear unidades no futuro, o vínculo quebra silenciosamente.
2. ~~Categoria do material didático~~ — **DECIDIDO: por segmento** (Rodrigo, 22/09), usando a hierarquia que `categorias_financeiras` já suporta: categoria pai "Material didático" com filhas `Infantil`, `Fund I`, `Fund II`, `Médio`.
   - **Segmento ≠ editora.** A tabela de material 2027 tem três editoras (COC → Infantil 3/4/5; POLIEDRO → 1º ao 9º ano; OLIMPO → 1ª a 3ª série), mas o POLIEDRO cobre **dois** segmentos (Fund I e Fund II). Categorizar por editora daria 3 categorias; por segmento dá 4. Escolhido segmento porque a editora é renegociada de ano para ano (se trocar o Poliedro em 2028, a série histórica do razão quebra), enquanto o segmento é estável e é o eixo em que se analisa margem. A editora entra como texto no lançamento/`isaac_parcela.produto`, não como categoria.
   - Maternal só tem agenda (R$ 70,00, sem apostilado) — cai em `Infantil`, não vira categoria própria.
   - **Todo o material está num CNPJ só.** Em ago/2026 a unidade "EPG Trindade - Educação Infantil" (= Colégio Integrado EPG) faturou R$ 81.456,61 de material — Infantil, Fund I **e** Fund II — enquanto a unidade "EPG Trindade" (Pinguinho) faturou **R$ 0,00** de material. Com categoria por segmento isso fica explícito no razão: receita de `Fund I`/`Fund II` sob o `company_id` do Integrado. Não é erro do importador, é como o isaac está configurado.
   - **Não corrigir isso no isaac: o material sai do isaac no próximo ano** (Rodrigo, 22/09) e passa a ser vendido na loja da própria editora. Ou seja, esta categorização serve para o **histórico** (2026 e o que sobrar de 2027), não para o regime permanente. Não vale investir em granularidade maior nem em ajuste de unidade isaac para algo que está saindo.
   - **Impacto a dimensionar fora deste spec:** material é parcelado em 10x, então os R$ 81,4 mil/mês de agosto sugerem ordem de ~R$ 800 mil/ano de receita bruta de material. Quando isso migra para a loja da editora, some a receita **e** o custo correspondente do DRE — o efeito líquido no EBITDA é a margem que a escola tinha nessa revenda, que não está apurada em lugar nenhum hoje. Isso afeta diretamente o modelo de valuation (`VALUATION_EPG_AGO_2026.xlsx`), que projeta a partir de um EBITDA que inclui essa margem. **Apurar a margem de material antes de usar aquele valuation para qualquer decisão de venda.**
3. ~~Quais meses de 2026 têm analítico~~ — **PARCIALMENTE RESOLVIDO.** O seletor do Meu Arco lista os 12 meses de 2026, mas listar não é ter dado: Out/Nov/Dez ainda não aconteceram (hoje é 22/09/2026) e Jan precisa ser verificado (o ano letivo começa em fevereiro). Na prática o backlog é de Fev a Set/2026, **× 2 unidades**, analítico `.xlsx` + resumo `.pdf` = ~32 arquivos para baixar à mão antes de reprocessar. Confirmar abrindo os meses antes de começar; mês sem dado fica sem receita no razão, com aviso — **não inventar valor**.
   - **Defasagem de competência (confirmado na tela):** o repasse rotulado "Setembro de 2026" cobre o período de atualizações de 30/jul a 31/ago. Ou seja, `competencia_repasse` ≠ competência da mensalidade — o que o spec já trata gravando os dois campos separados (`isaac_repasse.competencia_repasse` e `isaac_parcela.competencia`). Consequência: o ano letivo 2026 completo só fecha incluindo o repasse de jan/2027. Definir na tela de relatório qual eixo é o padrão (caixa = data do repasse, ou competência = mês da mensalidade); o dado suporta os dois.
   - **Estrutura do resumo confirmada pela tela:** Recebimentos − Descontos = Total a transferir (set/2026, unidade EPG Trindade: 221.134,95 − 41.879,23 = 179.255,72). Bate com o valor do Aceite B.
4. ~~"Filho de professor"~~ — **RESOLVIDO E JÁ EM PRODUÇÃO.** Entrou como `tipo_vaga`, não como motivo de desconto avulso: PR #27 (`feat/tipo-vaga-matriculas`, merged 22/09) substituiu o enum antigo (`paga/bolsa_integral/bolsa_parcial/permuta/gratuita`) por `NORMAL | BOLSA_50_PORCENTO | BOLSA_INTEGRAL | FILHO_PROFESSORA | FILHO_PROFESSORA_INTEGRAL | PERMUTA | ISENTO` (migrations `202609220001`/`202609220002`), com `FILHO_PROFESSORA` cobrando 50% (mesma regra de `BOLSA_50_PORCENTO`, tipo separado só para relatório) e `FILHO_PROFESSORA_INTEGRAL` isento. Os 58 alunos levantados pela secretaria (planilha `alunos_fora_isaac_revisado.xlsx`, matrícula → tipo_vaga) já foram classificados um a um via `matricula-full-edit-dialog.tsx` em produção — não sobrou pendência de dados aqui, o que resta é o item 2 (categoria de material) e a leitura de `tipo_vaga` na conciliação isaac (Fase B) para não gerar cobrança de mensalidade para bolsista/isento/permuta.
   - Dois alunos do levantamento original (Alvino Arriel e o outro caso de mensalidade cancelada em agosto) não entraram na planilha final porque saíram da escola — confirmado, não é dado perdido.
   - Campo informal "dono" (quem autorizou o desconto: Rodrigo/Renato/Rafaela/Escola) ficou só na planilha de trabalho, não tem coluna no schema — é rastreio pessoal entre os sócios, não precisa de campo dedicado (confirmado por Rodrigo).
5. ~~Crédito de curto prazo isaac~~ — **PARCIALMENTE RESOLVIDO.** Termos localizados em `VALUATION_EPG_AGO_2026.xlsx`, aba "6 - DIVIDAS_FINANCIAMENTOS": credor ISAAC, valor do empréstimo R$ 360.000,00, parcela R$ 23.146,54, 24 parcelas totais. Na foto de ago/2026 do valuation: 6 pagas / 18 restantes, saldo das parcelas R$ 416.637,72, saldo principal R$ 297.674,46, juros/encargos a vencer R$ 118.963,26, taxa informada 36,67% a.a. No resumo de set/2026 (repasse real): já são 7 parcelas pagas / 17 restantes, saldo principal ≈ R$ 285,9 mil.
   - **Pendência real que fica:** a taxa de 36,67% a.a. informada na planilha **não fecha** com a relação parcela/principal declarada — o cálculo (24 parcelas fixas de R$ 23.146,54 amortizando R$ 360.000,00) implica uma taxa em torno de 3,8% a.m. (~56,6% a.a.), quase 20 p.p. acima do que está escrito. Não corrigir esse número no spec nem no sistema sem o contrato de crédito em mãos — só ele resolve se a taxa da planilha está errada, se há capitalização diferente (CET vs. juros nominal), ou se a planilha mistura outro encargo. Até lá, tratar valor da parcela (R$ 23.146,54) e saldo devedor como os únicos números confiáveis para o registro contábil.
   - **Tratamento validado:** o próprio valuation exclui o empréstimo do EBITDA normalizado (aba 7, "DEDUZ EBITDA? NÃO") e deduz apenas o principal (não o saldo com juros futuros) do equity value (aba 4, passivos) — confirma a abordagem já proposta neste spec ("amortização do crédito isaac tratada fora do resultado operacional, só o principal como passivo").
6. ~~"Recebido na escola"~~ — **RESOLVIDO.** Confirmado por Rodrigo: entra via Pix na conta Sicoob (não é dinheiro/outro meio). O desenho da Fase B (criar cobrança manual a partir da linha "Recebido na escola" do isaac, sync diário do extrato Sicoob sugere o Pix correspondente por valor/data/CPF do responsável, confirmação manual para baixar) já cobre esse fluxo sem mudança — só deixa de ser pergunta em aberto.
7. **isaac Marlim API (`api.isaac.marlim.co`)** — investigada e descartada. Via WebFetch na documentação: é um gateway de pagamento para comerciantes (Payment Links, Transactions, parcelamento, conciliação, sellers, auth por api_key, ambientes sandbox/produção) — produto **diferente** do isaac de gestão escolar, sem relação com o contrato de repasse de mensalidade da escola. Não expõe repasse, recebíveis do contrato escolar nem dados do empréstimo. Não serve para esta integração. Confirma a desconfiança do próprio Rodrigo.
