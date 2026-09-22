# Financeiro — Repasse isaac real + Multi-CNPJ — Design

**Data:** 2026-09-21
**Status:** aprovado para spec (Rodrigo, 2026-09-21) — execução por fases
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
| `generateChargesForEnrollment` roda automaticamente ao criar/importar matrícula | `src/lib/actions/students.ts:149`, `src/lib/actions/imports.ts:329` | Toda matrícula nova gera 12 cobranças com o valor do plano |
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

### A1. Código

- Remover as chamadas a `generateChargesForEnrollment` em `students.ts` e `imports.ts`.
- Remover `GenerateChargesButton` de `matriculas/[id]` e a action `generateChargesForEnrollmentAction`.
- Remover `src/lib/server/generate-charges.ts` e os testes associados.
- Remover `scripts/gerar_cobrancas_2026.js` e `scripts/registrar_repasse_isaac.js`.
- **Manter** o formulário "Gerar lançamento avulso" da tela Cobranças (caso "pagou na escola").

### A2. Dados — script único `scripts/limpar_financeiro_dev.sql`

Roda **manualmente**, local primeiro e produção depois, sempre após backup (`scripts/backup_matriculas.mjs` + dump das tabelas abaixo).

```sql
begin;
-- 1) razão espelhado de cobranças (sem FK: precisa ser explícito)
delete from lancamento_financeiro where origem_tipo = 'cobranca';
-- 2) vínculos de conciliação que apontam para pagamentos
delete from conciliacao_vinculo where alvo_tipo = 'pagamento';
-- 3) pix de cobrança (se houver) ligados a cobranças
delete from pix_cobranca where origem_tipo = 'cobranca';
-- 4) cobranças (cascade apaga pagamentos)
delete from cobrancas where escola_id = '00000000-0000-0000-0000-000000000001';
-- conferência antes do commit
select (select count(*) from cobrancas) cobrancas,
       (select count(*) from pagamentos) pagamentos,
       (select count(*) from lancamento_financeiro where origem_tipo='cobranca') razao_cobranca,
       (select count(*) from alunos) alunos,
       (select count(*) from matriculas) matriculas;
commit;  -- trocar por rollback no ensaio
```

**Não toca:** `alunos`, `matriculas`, `planos`, `responsaveis_aluno`, folha, `lancamento_financeiro` de origem diferente de `cobranca`, `contas_bancarias`, `extrato_bancario`.

**Aceite A:** `alunos` e `matriculas` com a mesma contagem de antes; razão sem receita de origem `cobranca`; criar uma matrícula nova não gera cobrança.

**Efeito colateral esperado:** `dashboard-executive.ts` lê `cobrancas`/`pagamentos` para receita e inadimplência. Os dashboards ficam zerados até a Fase B reimportar os meses.

---

## Fase B — Importador do analítico isaac

### Modelo de dados

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
  cobranca_id uuid references cobrancas(id),
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

alter type origem_lancamento add value if not exists 'isaac';
alter type alvo_conciliacao add value if not exists 'repasse_isaac';
```

RLS: mesmo padrão admin/financeiro via `current_perfil()`. RBAC: módulo `financeiro.isaac` (admin: tudo; financeiro: ler/criar).

### Fluxo de importação

1. Upload do analítico `.xlsx` **e** do resumo `.pdf` do mesmo mês → escolhe a unidade isaac (o CNPJ vem dela) e a competência do repasse.
   - O parser do resumo (`src/lib/isaac/parse-resumo.ts`, `pdf-parse` já está no projeto) extrai as linhas e as transferências programadas.
   - Se o layout do PDF mudar, a tela permite digitar as linhas à mão. Nunca inferir.
2. **Parser puro** (`src/lib/isaac/parse-analitico.ts`, exceljs) lê as abas "Repasse de Mensalidades" e "Mudanças". Valida colunas pelo nome e falha com mensagem clara se o layout mudar.
3. **Classificação do produto** (`classificarProduto`, função pura): `Mensalidade*`/`Anuidade*` → `mensalidade`; `Materia*`/`Material*` → `material`; o resto → `outro`.
4. **Casamento de aluno**, nesta ordem:
   - (a) `aluno_alias` (fonte `isaac`);
   - (b) `alunos.nome_normalizado` = nome normalizado (sem acento, minúsculo, espaço único);
   - (c) sem casamento → `aluno_id = null`, vai para a fila.

   **Fuzzy nunca casa automaticamente.** Ele só sugere, porque irmãos têm sobrenome igual (ex.: "Laura Rodrigues da Silva" × "Amanda Rodrigues da Silva").
5. **Pré-visualização** antes de gravar:
   - totais do arquivo × totais calculados;
   - parcelas sem aluno;
   - alunos ativos pagantes (`tipo_vaga in ('paga','bolsa_parcial')`) sem parcela de mensalidade;
   - parcelas cujo valor difere do `valor_mensalidade_praticado`.
6. **Gravação**, numa transação via RPC `importar_repasse_isaac(jsonb)`:
   - `isaac_repasse` + `isaac_parcela` + `isaac_mudanca`;
   - para cada parcela com `valor_base > 0` e aluno casado: upsert em `cobrancas` (`origem='isaac'`, `id_externo=id_parcela`, `valor_original=valor_base`, `categoria_id` pelo tipo) + `pagamentos` (`valor_pago=valor_base`, `data_pagamento=data_repasse`, `forma_pagamento='transferencia'`, `observacao='isaac <competencia_repasse>'`);
   - **um** `lancamento_financeiro` de despesa "Taxa isaac" (`origem_tipo='isaac'`, `origem_id=repasse.id`, `status='paga'`, `company_id` da unidade).
   - Linha "Débito da parcela do crédito de curto prazo": **um** `lancamento_financeiro` de despesa na categoria "Amortização crédito isaac", marcada como **não operacional**, para ficar fora do resultado operacional. A separação entre principal e juros depende do contrato do crédito (decisão em aberto).
   - Checagem de fechamento: mensalidades + novo contrato − taxa − recebido na escola − cancelado ± outros = soma das transferências. Se não fechar, a importação é **bloqueada**.
7. **Reimportar** o mesmo arquivo é idempotente (`unique` em `id_parcela` e em `(unidade, competencia)`).

### Ajuste no trigger `espelhar_pagamento_cobranca_razao`

- Categoria = `cobrancas.categoria_id`, com fallback para "Mensalidades".
- `company_id` = o da cobrança (Fase C).

### Conciliação

No sync do extrato, **cada** `isaac_transferencia` é casada separadamente com um crédito na conta do CNPJ da unidade, de mesmo valor (tolerância 0,01) e em até ±3 dias úteis de `data_prevista`. O casamento gera `conciliacao_vinculo(alvo_tipo='repasse_isaac')` e preenche `isaac_transferencia.extrato_id`. Transferência sem crédito até D+3 vira alerta. Diferença de valor também vira alerta, sem ajuste silencioso.

### Reprocessamento de 2026

Importar os analíticos de cada mês de 2026 disponíveis no Meu Arco, por unidade. Mês sem analítico fica sem receita no razão, com aviso explícito no dashboard. **Não inventar valor.**

### Testes (vitest)

- Parser, classificação e casamento de aluno como funções puras.
- **Fixture sintética:** o repositório tirou planilhas de alunos do versionamento, então nada de nomes reais.
- Teste de aceite com totais sintéticos que reproduzem a estrutura de agosto (base, taxa, ajustes, líquido).

**Aceite B:**
- os analíticos reais de agosto/2026 batem os totais de agosto;
- analítico + resumo de setembro/2026 batem R$ 164.594,34 e R$ 179.255,72, com as transferências de 05 e 15 corretas, centavo a centavo;
- a linha do crédito de curto prazo aparece fora do resultado operacional.

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

## Decisões em aberto (do Rodrigo, não assumidas)

1. ~~CNPJs / mapeamento unidade isaac~~ — **RESOLVIDO (confirmado por Rodrigo, 22/09).** Contra-intuitivo, não seguir o nome:
   - Unidade isaac **"EPG Trindade"** → **Escola Pinguinho de Gente LTDA**, CNPJ 11.714.876/0001-16.
   - Unidade isaac **"EPG Trindade - Educação Infantil"** → **Colégio Integrado EPG**, CNPJ 35.027.047/0001-23.
   - Isso é o oposto do que o nome da unidade sugeria. O importador (Fase B) e o `isaac_unidade` devem gravar esse vínculo explicitamente (não inferir por nome), e o de-para deve ficar comentado no código/migration citando esta confirmação — se o isaac renomear unidades no futuro, o vínculo quebra silenciosamente.
2. Categoria do material didático: uma só ou por segmento.
3. Quais meses de 2026 têm analítico disponível no Meu Arco.
4. ~~"Filho de professor"~~ — **RESOLVIDO E JÁ EM PRODUÇÃO.** Entrou como `tipo_vaga`, não como motivo de desconto avulso: PR #27 (`feat/tipo-vaga-matriculas`, merged 22/09) substituiu o enum antigo (`paga/bolsa_integral/bolsa_parcial/permuta/gratuita`) por `NORMAL | BOLSA_50_PORCENTO | BOLSA_INTEGRAL | FILHO_PROFESSORA | FILHO_PROFESSORA_INTEGRAL | PERMUTA | ISENTO` (migrations `202609220001`/`202609220002`), com `FILHO_PROFESSORA` cobrando 50% (mesma regra de `BOLSA_50_PORCENTO`, tipo separado só para relatório) e `FILHO_PROFESSORA_INTEGRAL` isento. Os 58 alunos levantados pela secretaria (planilha `alunos_fora_isaac_revisado.xlsx`, matrícula → tipo_vaga) já foram classificados um a um via `matricula-full-edit-dialog.tsx` em produção — não sobrou pendência de dados aqui, o que resta é o item 2 (categoria de material) e a leitura de `tipo_vaga` na conciliação isaac (Fase B) para não gerar cobrança de mensalidade para bolsista/isento/permuta.
   - Dois alunos do levantamento original (Alvino Arriel e o outro caso de mensalidade cancelada em agosto) não entraram na planilha final porque saíram da escola — confirmado, não é dado perdido.
   - Campo informal "dono" (quem autorizou o desconto: Rodrigo/Renato/Rafaela/Escola) ficou só na planilha de trabalho, não tem coluna no schema — é rastreio pessoal entre os sócios, não precisa de campo dedicado (confirmado por Rodrigo).
5. ~~Crédito de curto prazo isaac~~ — **PARCIALMENTE RESOLVIDO.** Termos localizados em `VALUATION_EPG_AGO_2026.xlsx`, aba "6 - DIVIDAS_FINANCIAMENTOS": credor ISAAC, valor do empréstimo R$ 360.000,00, parcela R$ 23.146,54, 24 parcelas totais. Na foto de ago/2026 do valuation: 6 pagas / 18 restantes, saldo das parcelas R$ 416.637,72, saldo principal R$ 297.674,46, juros/encargos a vencer R$ 118.963,26, taxa informada 36,67% a.a. No resumo de set/2026 (repasse real): já são 7 parcelas pagas / 17 restantes, saldo principal ≈ R$ 285,9 mil.
   - **Pendência real que fica:** a taxa de 36,67% a.a. informada na planilha **não fecha** com a relação parcela/principal declarada — o cálculo (24 parcelas fixas de R$ 23.146,54 amortizando R$ 360.000,00) implica uma taxa em torno de 3,8% a.m. (~56,6% a.a.), quase 20 p.p. acima do que está escrito. Não corrigir esse número no spec nem no sistema sem o contrato de crédito em mãos — só ele resolve se a taxa da planilha está errada, se há capitalização diferente (CET vs. juros nominal), ou se a planilha mistura outro encargo. Até lá, tratar valor da parcela (R$ 23.146,54) e saldo devedor como os únicos números confiáveis para o registro contábil.
   - **Tratamento validado:** o próprio valuation exclui o empréstimo do EBITDA normalizado (aba 7, "DEDUZ EBITDA? NÃO") e deduz apenas o principal (não o saldo com juros futuros) do equity value (aba 4, passivos) — confirma a abordagem já proposta neste spec ("amortização do crédito isaac tratada fora do resultado operacional, só o principal como passivo").
6. ~~"Recebido na escola"~~ — **RESOLVIDO.** Confirmado por Rodrigo: entra via Pix na conta Sicoob (não é dinheiro/outro meio). O desenho da Fase B (criar cobrança manual a partir da linha "Recebido na escola" do isaac, sync diário do extrato Sicoob sugere o Pix correspondente por valor/data/CPF do responsável, confirmação manual para baixar) já cobre esse fluxo sem mudança — só deixa de ser pergunta em aberto.
7. **isaac Marlim API (`api.isaac.marlim.co`)** — investigada e descartada. Via WebFetch na documentação: é um gateway de pagamento para comerciantes (Payment Links, Transactions, parcelamento, conciliação, sellers, auth por api_key, ambientes sandbox/produção) — produto **diferente** do isaac de gestão escolar, sem relação com o contrato de repasse de mensalidade da escola. Não expõe repasse, recebíveis do contrato escolar nem dados do empréstimo. Não serve para esta integração. Confirma a desconfiança do próprio Rodrigo.
