# Product

## Register

product

## Users

Equipe interna da escola — administradores, secretaria, financeiro, RH e professores. Usam o sistema no trabalho diário, em desktop, sob luz de escritório, muitas vezes por horas seguidas: cadastrando alunos, lançando cobranças, fechando folha de pagamento, registrando frequência, conferindo relatórios. São poder-usuários por repetição, não por treino técnico. O trabalho é denso e recorrente; cada tela é uma tarefa a concluir, não algo a admirar. Confiança nos números (financeiro, folha, matrícula) é inegociável — dado errado tem consequência real.

## Product Purpose

CRM / sistema de gestão escolar multi-tenant (por `escola_id`). Cobre o ciclo completo da operação: alunos e matrículas, financeiro (cobranças, contratos, inadimplência), RH e folha de pagamento (motor de rubricas, holerite, pacote do contador), despesas, portaria com reconhecimento facial, frequência, comunicação com responsáveis (WhatsApp/comunicados), pipeline comercial e relatórios/DRE. Sucesso = a equipe conclui cada tarefa rápido, com confiança nos dados, sem tropeçar na interface. A ferramenta some na tarefa.

## Brand Personality

Confiável e profissional, ao mesmo tempo acolhedor e humano. Sério onde importa (dinheiro, dados de pessoas), com calor sutil no tom — é uma escola, não um banco. Voz direta em PT-BR, sem jargão corporativo nem infantilização. A personalidade vive no tom, na tipografia e no uso semântico de cor, nunca em decoração gratuita.

## Anti-references

- **ERP corporativo legado** (TOTVS, SAP, sistemas de gestão datados): telas cinzas indistintas, densidade sem hierarquia, estética de software dos anos 2000. O sistema é denso, mas denso-legível — não denso-feio.
- **Template SaaS genérico / slop de IA**: card-grids uniformes, gradientes gratuitos, hero-metric template, eyebrow uppercase acima de toda seção, marcadores numerados 01/02/03 por reflexo. Familiaridade útil sim; cliché de gerador não.
- Também evitar: cara de app escolar infantil (cores primárias saturadas, cartoon) e planilha Excel crua (tudo mesmo peso/cor, sem estados).

## Design Principles

- **A ferramenta some na tarefa.** Familiaridade ganha é uma feature; um poder-usuário deve sentar e confiar em cada componente, não pausar em affordance estranha. Reusar vocabulário padrão (top bar + nav, tabelas, filtros, command palette) em vez de reinventar.
- **Confiança pela precisão.** Numerais tabulares, contraste AA, estados semânticos consistentes (em dia / atraso / aguardando). Onde há dinheiro ou dado de pessoa, o visual reforça exatidão.
- **Denso, mas legível.** Muita informação por tela é virtude quando a equipe precisa dela — resolvida por hierarquia (escala, peso, cor semântica), não por espremer tudo no mesmo peso.
- **Colorido com disciplina.** Uma cor de marca (azul royal) + 7 matizes temáticos com papéis fixos (KPI, tag, gráfico). Cor carrega significado, nunca é enfeite. Sem inventar cor fora da paleta.
- **Paridade claro/escuro.** Todo token semântico existe nos dois temas; nenhum é cidadão de segunda classe. Tema por `data-theme` no `<html>`.
- **Consistência acima de surpresa.** O mesmo botão "Salvar" se parece igual em toda tela. Delight é reservado para momentos (estado vazio, confirmação), não espalhado por páginas.

## Accessibility & Inclusion

Alvo **WCAG 2.2 AA**. Corpo de texto ≥ 4.5:1 contra o fundo (inclusive placeholder e rótulo sobre tint — usar `--on-tint`); texto grande ≥ 3:1. Anel de foco visível (`0 0 0 4px`) em todo controle interativo; nunca remover sem substituir. `aria-label` obrigatório em botões só-ícone; `alt` em logo. Alvos de toque ≥ 30px (ações de linha) / 36–44px (controles principais). `prefers-reduced-motion` respeitado — toda animação tem alternativa (crossfade ou instantâneo). `color-scheme` definido por tema para controles nativos. Numerais tabulares para leitura em coluna.
