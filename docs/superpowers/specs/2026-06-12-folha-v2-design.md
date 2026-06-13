# Folha de Pagamento v2 — Design

Data: 2026-06-12
Status: aprovado em brainstorming, aguardando plano de implementação  Rodrigo Reis

## Contexto e objetivo

O módulo atual de folha (`/rh/folha`, tabela `payroll`) tem cálculos incompletos/errados, fluxo mensal totalmente manual, não calcula provisões, não gera holerite e a UX é confusa. A v2 substitui o módulo por um sistema de folha **genérico** (serve a outras empresas, não só escola), **automatizado mês a mês** e **auditável**, inspirado no fluxo "payroll planning → monthly close → reconciliation" do QuickBooks/Claude for Small Business — implementado nativamente no app (os conectores do plugin Small Business NÃO são embutíveis na aplicação; servem só de referência de fluxo).

**Papel oficial:** o app é a fonte da verdade do cálculo e da gestão. O contador continua transmitindo eSocial/FGTS Digital/DCTFWeb; o app gera mensalmente o "pacote do contador" para conferência e transmissão. O app NÃO transmite nada ao governo (fora de escopo).

**Parâmetros da escola (defaults configuráveis):** fechamento dia 01 de manhã; pagamento no 5º dia útil; 41–100 funcionários; vínculos CLT, CLT-professor, PJ, RPA/autônomo, estagiário; multi-empresa (1 contrato ativo por funcionário, sem professor em 2 CNPJs).

## Escopo

**Dentro:** schema novo `folha_*`; motor de cálculo puro com perfis por vínculo; geração automática mensal via cron dispatcher; workflow de estados com aprovação; provisões (13º, férias+1/3, FGTS, INSS patronal); conciliação automática com o módulo de despesas; holerite PDF; pacote do contador em xlsx; alertas de prazos; telas novas em `/rh/folha-v2`; configuração por empresa em menu.

**Fora:** transmissão eSocial/FGTS Digital/DCTFWeb; portal do funcionário (ver o próprio holerite) — candidato a v2.1; envio de holerite por e-mail — candidato a v2.1; integração bancária/CNAB/PIX para pagamento; conversão retroativa dos dados antigos de `payroll`; ponto eletrônico/apuração de frequência de funcionários.

## Modelo de dados (migrations novas, prefixo `folha_`)

Nenhuma tabela existente é alterada. `payroll` antiga vira somente leitura (aba "histórico").

### `folha_rubricas` — catálogo de verbas
- `id`, `escola_id`, `codigo` (text, único por escola), `nome`
- `tipo`: `provento` | `desconto` | `base` | `informativa`
- `metodo_calculo`: `fixo` | `manual` | `formula:<chave>` — chaves do motor: `salario_base`, `hora_aula`, `dsr_professor`, `hora_atividade`, `inss`, `irrf`, `inss_rpa`, `fgts`, `inss_patronal`, `provisao_13`, `provisao_ferias`, `percentual_sobre_base`, `valor_por_dependente`
- `incide_inss`, `incide_irrf`, `incide_fgts`, `incide_dsr` (boolean)
- `ordem_holerite` (int), `ativa` (boolean)
- Seed com rubricas padrão (salário base, hora-aula, **salário dobra** (segundo bloco salarial, valor contratual, incide DSR/INSS/IRRF/FGTS), DSR, hora-atividade, **1/3 de férias** (no mês de gozo), HE 50%, adicional noturno, gratificação, salário-família, VT 6%, VA, adiantamento, consignado, **mensalidade sindical**, faltas, INSS, IRRF, e informativas: FGTS 8%, INSS patronal, provisões)

### `folha_perfis_calculo` — perfil por vínculo
- `id`, `escola_id`, `codigo` (`clt`, `clt_professor`, `pj`, `rpa`, `estagiario` no seed), `nome`, `ativo`
- `folha_perfis_rubricas` (N:N): perfil_id, rubrica_id, `automatica` (boolean), `ordem_execucao` (int)
- Genérico: outras empresas criam perfis próprios; nada de "professor" hardcoded no código

### `folha_contratos` — vínculo do funcionário
- `id`, `escola_id`, `employee_id` → `employees`, `company_id` → `companies`, `perfil_calculo_id`
- `salario_base` numeric(12,2) NULL, `valor_hora_aula` numeric(12,2) NULL, `aulas_semanais` int NULL (constraint: salário OU hora-aula conforme perfil)
- `dependentes_irrf` int default 0, `data_admissao`, `data_desligamento` NULL, `ativo`
- Único contrato ativo por employee (unique partial index `where ativo`)

### `folha_contratos_rubricas` — verbas recorrentes por contrato
- `id`, `contrato_id`, `rubrica_id`, `valor` numeric(12,2) NULL, `percentual` numeric(7,4) NULL, `ativa`
- Mecanismo genérico para qualquer verba fixa do contrato: salário dobra (turno extra do professor), gratificação fixa, mensalidade sindical etc. O motor materializa essas verbas como lançamentos `auto` em toda folha gerada
- **Dobra de turno NÃO é flag nem caso especial no código**: é a rubrica "salário dobra" com valor próprio no contrato, e o DSR incide sobre ela automaticamente via flag `incide_dsr` (modelo confirmado na planilha real da escola: dobra com valor independente da base e DSR próprio)

### `folha_runs` — folha do mês por empresa
- `id`, `escola_id`, `company_id`, `competencia` text `YYYY-MM` (unique company+competencia)
- `status`: `rascunho` → `em_revisao` → `aprovada` → `paga` → `fechada` (check constraint; transições validadas em server action)
- `total_proventos`, `total_descontos`, `total_liquido`, `total_encargos` (denormalizados, recalculados a cada mudança)
- `gerada_por` (`cron` | uuid do usuário), `aprovada_por`, `fechada_por`, timestamps, `reaberta_motivo` text NULL

### `folha_itens` — contracheque
- `id`, `run_id`, `contrato_id` (unique run+contrato), totais do item, `status`: `ativo` | `excluido` (permite tirar alguém da folha do mês com rastro)

### `folha_lancamentos` — linhas do contracheque (coração do sistema)
- `id`, `item_id`, `rubrica_id`, `referencia` text NULL (ex.: "20 aulas", "5%"), `valor` numeric(12,2)
- `origem`: `auto` | `manual` | `recorrente` (copiado do mês anterior)
- `valor_calculado` numeric NULL (preserva o que o motor calculou quando editado à mão), `editado_por` uuid NULL
- `recorrente_parcelas` int NULL / `recorrente_parcela_atual` int NULL (ex.: consignado 3/10 — para de copiar quando termina)

### `folha_provisoes` — saldos acumulados
- `id`, `contrato_id`, `competencia`, `tipo`: `decimo_terceiro` | `ferias` | `fgts` | `inss_patronal`
- `valor_mes`, `saldo_acumulado`, `baixada_em` NULL (quando paga/quitada)
- Gerada no fechamento da run; imutável depois

### `folha_config` — configuração por empresa (o "menu configurável")
- `company_id` unique, `dia_fechamento` int default 1, `regra_pagamento` jsonb default `{"tipo":"dia_util","n":5}`
- `divisor_dsr` int default 6, `percentual_hora_atividade` numeric default 5, `semanas_mes` numeric default 4.5
- `dia_vencimento_gps` int default 20, `dia_vencimento_fgts` int default 20
- `categoria_despesa_folha` uuid → `categorias_despesa` (mapeamento da conciliação), idem para encargos
- `feriados_locais` jsonb (datas), `jobs` jsonb (quais jobs do dispatcher rodam e em que dia)

### `jobs_log` — execuções do dispatcher
- `id`, `job` text, `executado_em`, `sucesso` boolean, `detalhe` jsonb

### Tabelas reaproveitadas
- `inss_brackets`, `ir_brackets` (faixas vigentes, já versionadas) — ganham seed 2026
- **Nova** `irrf_redutor` (vigência, limite_isencao, limite_reducao, fórmula do redutor da Lei 15.270/2025) — ver "Regras legais"

### RLS
Padrão do projeto: todas as tabelas `folha_*` com RLS por `escola_id` + perfil `admin`/`financeiro` (write), `secretaria`/`professor` sem acesso. Server actions usam `requirePerfil(["admin","financeiro"])`.

## Motor de cálculo

Local: `src/lib/folha/engine/` — **funções puras**, zero import de Supabase. Entrada: contrato + perfil + rubricas + faixas vigentes + config + lançamentos manuais/recorrentes. Saída: lista de lançamentos calculados + bases + validações.

Pipeline por contrato:
1. Resolve perfil → rubricas automáticas em `ordem_execucao`
2. Proventos: `salario_base` OU `hora_aula` (valor × aulas_semanais × `semanas_mes`), verbas contratuais de `folha_contratos_rubricas` (ex.: salário dobra), depois DSR — calculado **por rubrica** com `incide_dsr` (valor_sem_dsr / (`divisor_dsr` − 1); com divisor 6 equivale a 1/5 do valor sem DSR ou 1/6 do total, como a planilha atual da escola), uma linha de DSR por verba no holerite — então `hora_atividade` (% config sobre base+DSR) e demais proventos
3. Acumula bases por flags de incidência (base INSS, base IRRF, base FGTS)
4. Descontos legais: INSS progressivo (reaproveita `calcINSS` atual + faixas 2026), IRRF (faixas + **redutor Lei 15.270/2025**), depois descontos simples (VT 6% limitado, VA, adiantamento, consignado…)
5. Informativas: FGTS 8%, INSS patronal, provisão 13º (1/12 da remuneração), provisão férias ((remuneração + 1/3)/12) — não afetam líquido; alimentam `folha_provisoes` e projeção de caixa
6. Validações (ver "Erros")

Edição manual de lançamento → recalcula em cascata só o que depende (bases → INSS/IRRF → líquido), preservando `valor_calculado`.

### Perfis seed

| Perfil | Proventos | Descontos | Encargos/observações |
|---|---|---|---|
| `clt` | salário base + extras | INSS, IRRF, VT/VA… | FGTS 8%, INSS patronal, provisões |
| `clt_professor` | hora-aula × aulas × 4,5 + DSR 1/6 + hora-atividade 5% | idem CLT | idem CLT; percentuais por convenção em config |
| `rpa` | valor bruto do serviço | INSS 11% (até teto), IRRF | INSS patronal 20%; sem FGTS/provisões |
| `pj` | valor da nota | — | nenhum; só agenda pagamento e entra no pacote do contador |
| `estagiario` | bolsa + auxílio-transporte | — | sem INSS/FGTS (Lei 11.788/2008); recesso 30 dias é operacional, não entra no cálculo |

## Regras legais vigentes (2026) — entram como SEED, não como código

- **INSS** (progressivo, faixas a confirmar na implementação com fonte oficial): salário mínimo R$ 1.621,00; teto de contribuição R$ 8.475,55; alíquotas 7,5% a 14%; desconto máximo ≈ R$ 988,09
- **IRRF — Lei 15.270/2025**: isenção até R$ 5.000/mês; redutor linear entre R$ 5.000,01 e R$ 7.350,00; acima disso tabela normal. O motor implementa faixas + redutor (`irrf_redutor`). **O cálculo atual do app não contempla o redutor — está errado para 2026**
- **Professor — CLT arts. 317–323**: art. 320, salário mensal = hora-aula × aulas semanais × 4,5; DSR = 1/6 (Súmula/praxe; divisor configurável); hora-atividade ≈ 5% (definida por convenção coletiva — **valor da convenção regional precisa ser confirmado pelo usuário antes do go-live**)
- **RPA/autônomo**: INSS 11% retido (até o teto) + IRRF pela nova regra; empresa paga INSS patronal 20%; declarado pelo contador no eSocial/DCTFWeb. **Atenção**: NFS-e obrigatória para autônomos a partir de 2026 — processo do contador, registrado aqui como pendência operacional
- **Prazos default**: pagamento salários = 5º dia útil; FGTS Digital = dia 20; INSS/DARF (DCTFWeb) = dia 20 — todos configuráveis

Faixas e valores ficam em tabelas com vigência (`valido_de`/`valido_ate`) — virada de ano = INSERT, não deploy.

## Ciclo mensal automatizado

### Cron dispatcher
`vercel.json` passa a ter **um único cron**: `0 7 * * *` → `/api/jobs/dispatch` (token `JOBS_API_TOKEN`, mesmo padrão da portaria). O dispatcher lê `folha_config.jobs` + configs de comunicados/lembretes e executa na ordem: comunicados → lembretes → jobs de folha do dia. Cada execução loga em `jobs_log`. Limite do plano Hobby: execução diária, horário fixo no deploy — o menu configura **dia do mês e ativação** de cada job, não o horário (precisa Vercel Pro para horário livre). Rotas atuais `/api/comunicados/processar` e `/api/lembretes/processar` viram funções chamadas pelo dispatcher.

### Jobs de folha
1. **Gerar folha** (dia = `dia_fechamento`, default 01): para cada empresa ativa cria a run `rascunho` da competência, um item por contrato ativo, roda o motor, copia recorrentes do mês anterior (decrementando parcelas), notifica financeiro/admin via `notificacoes` existente. Idempotente: run existente → não duplica
2. **Alertas** (diário): folha em rascunho após D+2; pagamento em D-2 (regra de pagamento + dias úteis: feriados nacionais fixos + `feriados_locais`); GPS/FGTS em D-3; 13º (1ª parcela 30/11, 2ª 20/12)

### Estados da run

| Transição | Efeito |
|---|---|
| → `em_revisao` | opcional (segregação revisor/aprovador) |
| → `aprovada` | trava edição de valores; **gera despesas** no módulo financeiro: líquidos, GPS/INSS, FGTS, RPA, PJ — cada uma com `folha_run_id`, categoria e vencimento corretos |
| → `paga` | preenche `data_pagamento` nas despesas vinculadas |
| → `fechada` | grava `folha_provisoes`, gera holerites PDF + pacote do contador, congela tudo |
| reabrir | só `admin`, exige `reaberta_motivo`, volta a `rascunho`, remove despesas não pagas geradas |

## Saídas

- **Conciliação**: despesas geradas carregam `folha_run_id`; tela da run mostra batimento calculado × pago × diferenças. Fim da redigitação em despesas
- **Holerite**: PDF por item via jsPDF (mesmo stack do boletim): cabeçalho da empresa, rubricas em `ordem_holerite`, bases (INSS/IRRF/FGTS) e líquido. Download individual ou .zip da run
- **Pacote do contador**: xlsx por competência (ExcelJS): aba resumo por empresa; aba analítica por funcionário (todas as rubricas + bases); aba RPA/PJ; aba provisões. Suficiente para o contador conferir e transmitir eSocial
- **Provisões/caixa**: tela com saldo acumulado por funcionário e projeção ("13º em novembro ≈ R$ X; férias programadas ≈ R$ Y")

## Telas (`/rh/folha-v2`, menu "Folha v2")

1. Lista de competências por empresa (status, totais)
2. Detalhe da run: tabela de contracheques, totais, validações pendentes, ações de estado, batimento de conciliação
3. Detalhe do contracheque: lançamentos editáveis inline (origem visível), recálculo imediato
4. Catálogo de rubricas (CRUD)
5. Perfis de cálculo (CRUD + vínculo de rubricas)
6. Configurações (`folha_config` — o menu configurável)
7. Provisões e projeção de caixa
8. Histórico (read-only da `payroll` antiga)

UI segue convenções do projeto: `@/components/ui/*`, `money.format()`, competência `YYYY-MM`.

## Erros e validações

Bloqueiam fechamento (lista de pendências na tela da run): líquido negativo; contrato sem salário/hora-aula; faixas INSS/IRRF sem vigência para a competência; item com base INSS zerada e provento > 0; despesa de conciliação divergente do total. Motor nunca lança exceção silenciosa: retorna `{ lancamentos, validacoes[] }`. Dispatcher: falha de um job não derruba os demais; tudo em `jobs_log`.

## Testes

- Unit (Vitest): motor por perfil com valores reais conhecidos (casos dourados: professor com N aulas, CLT acima do teto INSS, IRRF nas 3 zonas da Lei 15.270 — isento/redutor/normal, RPA no teto, consignado terminando parcelas)
- **Caso dourado "Ana Flávia"** (planilha real): base 2.917,81 (sem DSR 2.431,51 + DSR 486,30), salário dobra 2.457,51 + DSR próprio, total 5.836,27, deduções GPS 618,58 + IRRF 324,61, líquido 4.893,08. Atenção: o DSR da dobra na planilha (460,95) diverge do calculado (491,50) — usuário verificará se era ajuste intencional ou erro antes de fixar o valor esperado do teste
- Unit: dias úteis (5º dia útil com feriado no meio), redutor IRRF nas bordas (5.000,00 / 5.000,01 / 7.350,00 / 7.350,01)
- Integração: transições de estado (gera despesas, trava edição, reabre remove não pagas); idempotência do job de geração
- Smoke manual: gerar folha real de uma competência em paralelo com a planilha atual do financeiro e bater valores antes do corte

## Migração e corte

- v2 começa em competência de corte (sugestão: 2026-08). Sem conversão retroativa
- Rodar 1 mês em paralelo (v2 + processo atual), bater resultados, então desligar telas antigas
- `payroll`/`payroll_periods` permanecem para histórico; remoção física só em limpeza futura

## Riscos e pendências

1. **Convenção coletiva regional dos professores** (piso, % hora-atividade, reajuste): usuário precisa fornecer antes do go-live — sem isso, defaults legais genéricos
1b. ~~DSR da dobra na planilha (460,95 vs 491,50)~~ **RESOLVIDO**: o contracheque oficial do contador (maio/2026) mostra que a dobra não é bloco separado — é horas totais (216h = 2×108) numa linha única de SALARIO HORA (23,16 × 216 = 5.002,56) com um único DSR 1/6 (833,76). O 460,95 da planilha era valor de fechamento ("plug") para bater com o total oficial. Ver "Adendo 1" abaixo
1c. ~~Calibração do redutor IRRF~~ **RESOLVIDO** (texto oficial da Lei 15.270/2025, art. 3º-A da Lei 9.250): Redução mensal = **R$ 978,62 − (0,133145 × rendimentos tributáveis mensais)**, limitada ao imposto da tabela (§1º), zero para rendimentos > 7.350 (§2º), aplica também ao 13º (§3º). CRÍTICO: o multiplicador usa o **rendimento tributável bruto** (antes do INSS), não a base de cálculo. Validado com a âncora: cheio 526,15 − (978,62 − 0,133145×5.836,32) = 324,59 ≈ 324,61 oficial. `irrf_redutor` ganha colunas `coef_fixo numeric` (978.62) e `coef_mult numeric(10,6)` (0.133145); `calcIrrf2026` troca a interpolação linear pela fórmula oficial: `redutor = clamp(coef_fixo − coef_mult × rendimento, 0, impostoIntegral)`, retornando `impostoIntegral − redutor` (zero garantido até 5.000; integral acima de 7.350)
2. Valores exatos das faixas INSS/IRRF 2026: confirmar com fonte oficial (gov.br) na implementação do seed
3. NFS-e obrigatória para autônomos (2026): processo operacional com o contador, fora do app
4. Plano Vercel Hobby: horário do cron fixo; jobs apenas diários
5. Volume: 100 contratos × 12 meses × ~15 lançamentos ≈ 18k linhas/ano em `folha_lancamentos` — irrelevante para Postgres, sem necessidade de particionamento

## Adendo 1 (2026-06-12) — correções a partir do contracheque oficial

Fonte: contracheque real do contador, Ana Flávia, maio/2026 (Escola Infantil Pinguinho de Gente LTDA).

1. **Dobra (modelo oficial)**: o contador trata dobra como horas totais — SALARIO HORA 216,00h × 23,16 = 5.002,56 + DSR PROFESSOR AULISTA 16,67% = 833,76. No v2: contrato da professora usa `aulas_semanais` totais (48) e `valor_hora_aula` 23,16; nenhuma rubrica de dobra. O motor já produz isso sem mudança (hora_aula 23,16 × 48 × 4,5 = 5.002,56; DSR único 1/6). A rubrica `salario_dobra` permanece no catálogo para empresas que queiram o bloco separado. `folha_contratos` ganha campo opcional `aulas_por_turno jsonb` (ex.: `{"matutino":24,"vespertino":24}`) só para rastreabilidade — cálculo usa o total.
2. **Caso dourado atualizado (gabarito oficial)**: proventos 5.002,56 + 833,76 = 5.836,32; INSS 618,58; base IRRF 5.217,74; IRRF 324,61; sindicato 3,33% = 194,35; descontos 1.137,54; líquido 4.698,78; FGTS do mês 466,90. Substitui os valores da planilha interna.
3. **Sindicato**: contribuição assistencial é `percentual_sobre_base` (3,33% do bruto), não valor fixo — e não ocorre todo mês: verba ativável por competência (lançamento manual/recorrente), não automática do perfil.
4. **IRRF — calibração obrigatória**: ver pendência 1c. A interpolação linear da spec NÃO reproduz o valor oficial; tratar a fórmula como parametrizável e calibrar com contracheques reais antes do corte.
5. **Holerite PDF — layout oficial**: colunas Código | Descrição | Referência | Vencimentos | Descontos; cabeçalho com empresa/CNPJ, tipo de folha, competência; funcionário com código, cargo, CBO, departamento/filial, data de admissão; rodapé com Salário Base, Sal. Contr. INSS, Base Cálc. FGTS, FGTS do mês, Base Cálc. IRRF e Faixa IRRF. Coluna Referência exibe: horas (216,00), percentual do DSR (16,67), alíquota efetiva INSS (10,60), faixa IRRF (27,50), percentual sindicato (3,33).
6. **`folha_contratos`**: + `cargo text`, + `cbo text` (aparecem no holerite).

## Adendo 2 (2026-06-12) — desligamento (rescisão fica com o contador)

Decisão: rescisão (verbas rescisórias, TRCT, homologação) permanece com o contador — fora do app. Gancho mínimo no v2: ao encerrar contrato (`data_desligamento` + `ativo=false`), as provisões acumuladas do contrato precisam de **baixa manual** — action `baixarProvisaoAction` (tipo, motivo livre ex.: "rescisão paga pelo contador", data) + botão na tela de provisões, para o passivo provisionado refletir a realidade. Sem cálculo de rescisão no motor.
