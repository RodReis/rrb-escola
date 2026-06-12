# Férias e 13º Salário (Folha v2.1) — Design

Data: 2026-06-12
Status: aprovado em brainstorming, aguardando plano de implementação
Pré-requisito: Folha v2 implementada (`2026-06-12-folha-v2-design.md` + Adendo 1)

## Contexto e objetivo

A Folha v2 cobre o ciclo mensal, mas acumula provisões de 13º e férias sem nunca consumi-las: o ciclo anual não fecha. Este módulo adiciona **runs especiais** de 13º (1ª e 2ª parcela) e férias ao mesmo motor, com baixa automática das provisões, recibos próprios e controle de períodos aquisitivos.

**Prática da escola (defaults configuráveis):** férias coletivas em julho (professores + parte do administrativo) e em dez/jan junto com o recesso (demais); 1ª parcela do 13º antecipada com as férias de julho para quem está nessa janela, novembro para os demais; 2ª parcela em dezembro para todos. Base de cálculo de 13º/férias para professores: **média dos últimos 12 meses** (hora-aula varia); demais perfis: salário vigente.

## Decisão de arquitetura (Abordagem A)

Runs especiais reutilizam TODO o pipeline da v2: mesmas tabelas (`folha_itens`, `folha_lancamentos`), mesma máquina de estados, mesma conciliação com despesas, mesmo gerador de PDF e pacote do contador. Alternativas descartadas: tabelas próprias (duplica workflow/telas — viola DRY) e rubricas dentro da folha mensal (ilegal: INSS/IRRF do 13º são **cálculos exclusivos**, separados da remuneração do mês, com datas próprias — 30/11 e 20/12).

## Escopo

**Dentro:** coluna `tipo` em `folha_runs`; tabela `folha_periodos_aquisitivos`; rubricas e fórmulas de 13º/férias/abono; geração automática via dispatcher; antecipação da 1ª parcela com férias; baixa de provisões no fechamento; desconto do gozo na folha mensal; recibos PDF (férias com assinatura); aba no pacote do contador; tela de agenda de férias; alertas de período aquisitivo vencendo; campos novos de config.

**Fora:** integração com módulo de frequência para abater faltas dos dias de direito (campo manual `dias_direito` por enquanto); férias fracionadas em 3 períodos (art. 134 §1º — v2.2 se precisar); rescisão (spec própria futura); 13º de RPA/PJ/estagiário (não têm direito).

## Modelo de dados (migration incremental sobre v2)

### `folha_runs`
- + `tipo text not null default 'mensal'` check in (`mensal`,`decimo_1a`,`decimo_2a`,`ferias`)
- unique muda de `(company_id, competencia)` para `(company_id, competencia, tipo)`
- Novembro/dezembro convivem: folha mensal + run de 13º na mesma competência

### `folha_periodos_aquisitivos` — nova
- `id`, `contrato_id` → `folha_contratos`, `inicio date`, `fim date` (12 meses), unique (contrato_id, inicio)
- `dias_direito int default 30` (editável — abatimento por faltas art. 130 é manual neste escopo)
- `janela text` (referencia `codigo` de `folha_config.ferias_janelas` ou `individual`)
- `gozo_inicio date null`, `gozo_dias int null`, `dias_abono int default 0` check in (0, 10)
- `status text default 'aberto'` check in (`aberto`,`agendado`,`gozado`,`vencido`)
- `run_id uuid null` → run de férias que pagou
- Criação: ao ativar contrato (primeiro período = admissão + 12m) e ao fechar run de férias (próximo período abre automaticamente)
- `vencido` = hoje > fim + 11 meses sem gozo agendado (limite concessivo art. 134; pagar em dobro art. 137) — atualizado pelo job de alertas

### `folha_contratos`
- + `antecipa_13_com_ferias boolean default false`
- + `janela_ferias text default null` (codigo da janela ou `individual`)

### `folha_config` — campos novos (tudo configurável, defaults da escola)
```
ferias_janelas          jsonb default [{"codigo":"julho","mes_gozo":7,"mes_pagamento":6},
                                       {"codigo":"dezembro","mes_gozo":1,"mes_pagamento":12}]
decimo_1a_prazo         text  default "11-30"
decimo_2a_prazo         text  default "12-20"
decimo_gerar_dia        jsonb default {"decimo_1a":"11-01","decimo_2a":"12-01"}
ferias_gerar_antes_dias int   default 30
ferias_pagar_antes_dias int   default 2
alerta_aquisitivo_dias  jsonb default [60,30]
base_13_ferias          jsonb default {"clt_professor":"media_12","clt":"vigente"}
```
Mecânica legal NÃO é configurável (avos ≥15 dias, 1/3 constitucional, cálculo exclusivo do 13º, abono = 1/3 dos dias): é lei, fica no motor.

### Rubricas novas no seed
| código | tipo | método | incidências |
|---|---|---|---|
| `decimo_1a_parcela` | provento | `decimo_1a` | só FGTS (1ª parcela não tem INSS/IRRF) |
| `decimo_2a_parcela` | provento | `decimo_2a` | FGTS |
| `inss_13` | desconto | `inss_13` | — (base exclusiva: 13º total) |
| `irrf_13` | desconto | `irrf_13` | — (base exclusiva; redutor Lei 15.270 SE aplica — art. da lei estende ao 13º) |
| `desconto_adiantamento_13` | desconto | `auto` na 2ª parcela | — |
| `inss_ferias` | desconto | `inss_ferias` | — (base: gozo+terço) |
| `irrf_ferias` | desconto | `irrf_ferias` | — (base: gozo+terço; redutor aplica) |
| `ferias_gozo` | provento | `ferias_gozo` | INSS, IRRF, FGTS |
| `ferias_terco` | provento | `ferias_terco` | INSS, IRRF, FGTS |
| `abono_pecuniario` | provento | `abono` | NENHUMA (indenizatório — art. 144) |
| `abono_terco` | provento | `abono_terco` | NENHUMA |
| `ferias_desconto_gozo` | desconto | `auto` na folha mensal | — (abate dias já pagos no recibo) |

## Motor — fórmulas novas (puras; serviço injeta dados)

- `mediaBase12(basesAnteriores: number[])` — média de `base_fgts` dos até 12 itens fechados mais recentes do contrato; <12 meses usa o que existir; lista vazia → erro de validação
- `baseCalculo(perfil, config, salarioVigente, basesAnteriores)` — resolve `media_12` vs `vigente` por `folha_config.base_13_ferias`
- `avos(admissao, desligamento, anoRef)` — meses do ano com ≥15 dias de vínculo; retorna 0–12
- `decimo1a(base, avos)` = round2(base/2 × avos/12)
- `decimo2a(base, avos, valor1aPaga)` = round2(base × avos/12 − valor1aPaga); INSS e IRRF calculados sobre `base × avos/12` (13º cheio) — base exclusiva, reusa `calcINSS` e `calcIrrf2026` (redutor aplica, mesma calibração pendente da v2)
- `ferias(base, diasGozo, diasAbono)`:
  - gozo = round2(base/30 × diasGozo); terço = round2(gozo/3)
  - abono = round2(base/30 × diasAbono); abonoTerco = round2(abono/3) — ambos sem incidências
  - INSS/IRRF sobre gozo+terço (mês de competência do pagamento)
- `descontoGozoNaMensal(base, diasGozadosNoMes)` = round2(base/30 × diasGozadosNoMes) — injetado na folha mensal do mês de gozo; dias trabalhados pagam normal

Validações que bloqueiam fechamento de run especial: férias sem período aquisitivo `agendado` correspondente; `gozo_dias + dias_abono > dias_direito`; 2ª parcela sem `desconto_adiantamento_13` quando existe 1ª paga no ano; avos fora de 0–12; base de média sem histórico (contrato novo → usar vigente com aviso).

## Ciclo e automação (dispatcher existente, jobs novos)

1. **`folha_gerar_decimo`**: no dia `decimo_gerar_dia.decimo_1a`, run `decimo_1a` com contratos CLT/CLT-professor ativos, EXCETO quem já tem lançamento `decimo_1a_parcela` no ano (antecipou nas férias). No dia `.decimo_2a`, run `decimo_2a` para todos os CLT, com desconto da 1ª paga. Vencimento das despesas = prazos configurados (não o 5º dia útil)
2. **`folha_gerar_ferias`**: `ferias_gerar_antes_dias` antes do `mes_gozo` de cada janela, run `ferias` com períodos `agendado` da janela; contratos com `antecipa_13_com_ferias` ganham `decimo_1a_parcela` na mesma run. Vencimento = `gozo_inicio − ferias_pagar_antes_dias`
3. **`folha_alertas_aquisitivo`**: nos marcos de `alerta_aquisitivo_dias`, notifica períodos sem agendamento; marca/alerta `vencido` diariamente (vermelho — pagamento em dobro)
4. **Folha mensal**: serviço injeta `ferias_desconto_gozo` automaticamente quando período `gozado` intersecta a competência

Fechamento de run especial: baixa provisões (`baixada_em` + vínculo à run) do tipo correspondente (13º na `decimo_2a`; férias na run de férias) e, no caso de férias, marca período `gozado`, grava `run_id` e abre o próximo período aquisitivo.

Estados, aprovação, reabertura e conciliação com despesas: idênticos à run mensal (zero código novo).

## Telas

1. **Agenda de férias** (`/rh/folha-v2/ferias`): períodos por funcionário (início/fim, dias direito, janela, status com cor; vencido em vermelho); ações: agendar gozo (data + dias + abono), reatribuir janela; card "X períodos vencem em 60 dias"
2. **Lista de runs** (existente): badge por `tipo`; detalhe e contracheque reusados; run de 13º exibe avos na referência
3. **Provisões** (existente): + coluna "baixado em" com link para a run que consumiu; projeção = acumulado − baixas
4. **Config** (existente): grupo novo "Férias e 13º" com os campos da config
5. **Contratos** (existente): + `antecipa_13_com_ferias`, + `janela_ferias`

## Saídas

- **Recibo de Férias** (PDF, layout oficial do Adendo 1): cabeçalho com período aquisitivo e datas de gozo; linhas gozo/terço/abono/INSS/IRRF; **linha de assinatura do funcionário**
- **Recibo 13º** (PDF): título "13º Salário — 1ª parcela" / "2ª parcela"; avos na referência
- **Pacote do contador**: aba nova `Ferias-13o` quando houver run especial na competência — funcionário, tipo, base (com memória da média: os 12 valores usados), avos, proventos, INSS-13/IRRF-13, líquido

## Testes

- Unit: `avos` (admissão meio do ano, ≥15/<15 dias, desligamento), `mediaBase12` (12, 7 e 0 meses), `decimo1a/2a` (com e sem antecipação), `ferias` (30 dias, 20+10 abono, incidências do abono = nenhuma), `descontoGozoNaMensal` (gozo cruzando virada de mês)
- Unit: IRRF-13 nas 3 zonas da Lei 15.270 (isento/redutor/cheio) — base exclusiva
- Integração: fechamento de férias baixa provisão e abre período seguinte; 2ª parcela valida desconto da 1ª; folha mensal do mês de gozo recebe `ferias_desconto_gozo`
- Dourado: Ana Flávia — férias jul/2026 com base = média 12 meses das bases reais; comparar com recibo do contador quando disponível (pendência: pedir recibo de férias real)

## Riscos e pendências

1. ~~Calibração IRRF~~ **RESOLVIDO**: fórmula oficial na spec v2 (pendência 1c) — Redução = 978,62 − 0,133145 × rendimento bruto; vale também para `irrf_13` (§3º da Lei 15.270)
2. ~~Recibo de férias real~~ **RESOLVIDO**: recibo oficial recebido (Ana Flávia, jul/2025) — ver Adendo 1 abaixo
3. ~~Recesso art. 322~~ **RESOLVIDO**: CCT Sinpro-GO — recesso 21/12 a 10/01 remunerado, sem convocação; folha mensal segue normal (design já correto). Ressalva: confirmar documento da CCT de educação básica (SINEPE) para piso e hora-atividade
4. **Faltas × dias de direito**: art. 130 reduz dias por faltas injustificadas — manual neste escopo (campo editável); integração com frequência fica para depois
5. **Contrato novo sem 12 meses de histórico**: média usa o que existir; primeiro ano da v2 terá histórico parcial — para julho/2026 (corte ago/2026, sem histórico) a primeira run de férias real será 2027, ou importa-se bases de 2025/26 manualmente
6. **Vigente × média (divergência observada)**: o recibo oficial de jul/2025 usou salário VIGENTE (campos de média zerados), não média de 12 meses. Para carga estável os dois coincidem. Confirmar com o contador qual regra a CCT manda quando o nº de aulas varia; config `base_13_ferias` já suporta ambos

## Adendo 1 (2026-06-12) — recibo oficial de férias + CCT

Fonte: "Aviso e Recibo de Férias" real (contador, jul/2025) + regras CCT Sinpro-GO 2025/2026.

1. **Documento duplo**: o PDF de férias tem DUAS partes — (a) "Aviso Prévio de Férias": notificação nominal, períodos (aquisição, gozo com datas e total de dias, abono), bloco "Base para cálculo" (faltas não justificadas, salário base, média horas, média valores, outras vantagens, total), bloco "Proventos e Descontos" (férias, 1/3, abono, 1/3 abono, dobro, 1/3 dobro, salário-família, 1ª parcela 13º, INSS, IRRF, totais P/D, líquido), texto de comunicação legal e CIENTE com assinatura do funcionário e da empresa; (b) "Recibo de Férias": texto de quitação com razão social, endereço e cidade da empresa, valor por extenso, data e assinatura do funcionário. Endereço/cidade vêm de `companies` (adicionar colunas `endereco text`, `cidade text` se não existirem)
2. **Rubricas adicionais no catálogo** (linhas presentes no recibo oficial): `ferias_dobro` (provento, art. 137 — férias vencidas pagas em dobro) e `ferias_dobro_terco`; sem cálculo automático no motor (lançamento manual quando ocorrer — o sistema deve PREVENIR via alertas, não normalizar)
3. **Validação de agendamento (CCT + art. 134 §3º)**: `gozo_inicio` não pode cair em sábado, domingo ou feriado (nacional ou local da config) — validar em `agendarGozo`
4. **Recesso em config**: `folha_config.recesso jsonb default {"inicio":"12-21","fim":"01-10"}` — informativo na agenda de férias (período bloqueado para convocação, não conta como férias); sem regra dura no motor
5. **Hora-atividade da escola = 0**: o contracheque oficial não tem linha de hora-atividade — default de `percentual_hora_atividade` para as empresas desta escola é 0 (o default genérico 5% permanece para novas empresas, editável)
6. **Antecipação confirmada**: linha "1ª Parcela 13º Salário" existe no recibo oficial de férias — design da antecipação validado
7. **Caso dourado de férias (recibo jul/2025, tabela 2025)**: base 5.531,40; férias 30d = 5.531,40; 1/3 = 1.843,80; proventos 7.375,20; INSS 842,11; IRRF 887,87 (= (7.375,20−842,11) × 27,5% − 908,73, EXATO — valida a mecânica de férias com tabela cheia pré-2026); líquido 5.645,22. Usar como teste com faixas/parcelas de 2025 e SEM redutor (vigência)
