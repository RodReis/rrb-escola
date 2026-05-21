# Roadmap MVP2 — RRB Escola

> Documento de referência. Não é spec executável — cada frente abaixo recebe seu próprio
> spec (`docs/superpowers/specs/`) e plano de implementação no momento de execução.

**Data:** 2026-05-20
**Objetivo:** Mapear todas as features-alvo do MVP2 (quadro de visão de produto), o estado
atual de cada uma no sistema, e a ordem de execução acordada.

---

## Legenda de estado

| Marca | Significado |
|-------|-------------|
| ✅ | Existe e em uso |
| 🟡 | Existe mas subutilizado / parcial |
| ❌ | Não existe |

---

## 1. Gestão Pedagógica

| Feature | Estado | Observação |
|---------|--------|------------|
| Alunos, Aulas e Turmas | ✅ | `alunos` (508), `turmas` (146), `disciplinas` (139) |
| Grade Horária e Diários | 🟡 | `professor_disciplina_turma` existe (0 linhas). Sem grade horária visual. |
| Notas e Boletins | 🟡 | CRUD completo (`avaliacoes`, `notas`, boletim). 0 uso em produção. |
| Calendário Letivo e Presença | 🟡 | Chamada funcional. **Falta calendário letivo** (dias letivos/feriados). |
| Documentação Escolar | ✅ | Templates + geração de `.docx` |

## 2. Gestão Financeira

| Feature | Estado | Observação |
|---------|--------|------------|
| Faturamento e Cobrança Automática | ✅ | `cobrancas` (5558). Geradas na matrícula, idempotente. |
| Boleto Bancário, PIX, Cartão | ❌ | Sem gateway. Pagamentos registrados manualmente. |
| Cobrança Recorrente | ✅ | 12 parcelas geradas na matrícula. Suficiente. |
| Fluxo de Caixa e Gráficos | ✅ | Dashboard financeiro executivo |
| Redução de Inadimplência | 🟡 | Relatório existe. **Falta ação ativa** (lembretes). |

## 3. Comunicação Escolar

| Feature | Estado | Observação |
|---------|--------|------------|
| App Agenda Digital | ❌ | — |
| Comunicados e Avisos | ❌ | — |
| Protocolos Digitais | ❌ | — |
| Chat pelo App | ❌ | — |
| Comunicação Escola x Pais | ❌ | Infra de portaria existe (`notificacoes_responsavel`, 0 linhas) |

## 4. CRM / Captação

| Feature | Estado | Observação |
|---------|--------|------------|
| Captação de Novos Alunos | ❌ | — |
| Matrículas online com pagamento | ❌ | Matrícula é processo interno |
| Acompanhamento Comercial | ❌ | — |
| Apoio ao Crescimento | ❌ | — |

## 5. BI e Indicadores

| Feature | Estado | Observação |
|---------|--------|------------|
| Dashboards Inteligentes | ✅ | Dashboard executivo robusto |
| Indicadores de Desempenho | ✅ | Pedagógico + financeiro |
| Inteligência para Decisões | 🟡 | Alertas existem. Sem análise preditiva. |
| Relatórios Personalizados | 🟡 | Relatórios fixos. Não customizáveis pelo usuário. |

## 6. EAD e LMS

| Feature | Estado | Observação |
|---------|--------|------------|
| Aulas em Vídeo, Áudio e PDF | ❌ | — |
| Vendas de Cursos Online | ❌ | — |
| Avaliações com Correção Automática | ❌ | — |
| Emissão de Certificados | ❌ | — |

---

## Escopo aprovado do MVP2 — execução faseada (Opção A)

Foco: **completar o core**. Quatro frentes, cada uma com spec + plano próprios,
executadas em sequência respeitando dependências.

### Frente 1 — Calendário Letivo
Definir dias letivos, feriados e recessos por ano letivo. Chamada de frequência passa a
validar contra dias letivos reais.
- **Tamanho:** pequeno-médio
- **Depende de:** nada
- **Destrava:** uso real do módulo de frequência
- **Spec:** *(a criar)*

### Frente 2 — Gateway de Pagamento (Asaas)
Integração com Asaas: gerar boleto/PIX por cobrança, webhook confirma pagamento e baixa
a `cobranca` automaticamente.
- **Tamanho:** médio-alto
- **Depende de:** nada (mas idealmente após Frente 1)
- **Provedor escolhido:** Asaas
- **Schema:** `cobrancas` precisa de coluna p/ ID externo Asaas. `responsaveis_aluno`
  já tem CPF/celular/email/`responsavel_financeiro` (dados do pagador).
- **Spec:** *(a criar)*

### Frente 3 — Camada de Mensageria WhatsApp
Serviço genérico de envio de mensagens via provedor BR (Z-API / Evolution API — API não
oficial, QR code de número comum). Base para Frentes 4.
- **Tamanho:** médio
- **Depende de:** nada
- **Provedor escolhido:** Z-API / Evolution API
- **Spec:** *(a criar)*

### Frente 4 — Lembretes de Inadimplência + Comunicação com Pais
Consome a camada de mensageria (Frente 3):
- Lembretes automáticos de vencimento/atraso de cobrança
- Comunicados e avisos da escola para os responsáveis
- **Tamanho:** médio
- **Depende de:** Frente 3 (mensageria); Frente 2 fortalece (dados de cobrança)
- **Spec:** *(a criar)*

---

## Fora do escopo do MVP2 (futuro)

Subsistemas grandes e independentes, cada um exige seu próprio ciclo de produto:

- **CRM / Captação** — funil de leads, matrícula online, acompanhamento comercial
- **EAD / LMS** — hospedagem de aulas, venda de cursos, correção automática, certificados
- **App Agenda Digital / Chat** — app mobile dedicado para pais
- **Grade Horária visual** — montagem de grade, diários de classe
- **Relatórios personalizáveis** — construtor de relatórios pelo usuário
