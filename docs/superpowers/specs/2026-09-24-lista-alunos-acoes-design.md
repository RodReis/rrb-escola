# Lista de Alunos — ícones de ação e status financeiro

## Contexto

`src/app/(app)/alunos/page.tsx` lista alunos com ações em
`src/components/students/aluno-row-actions.tsx`: Editar, Desativar/Ativar
(`toggleStudentAction`, que só mexe em `alunos.ativo`, sem tocar matrícula) e
Boletim. Os ícones são pequenos e monocromáticos.

Depende da frente **Cancelamento de Matrícula** (o ícone "Cancelar matrícula"
abre o diálogo definido lá).

## Decisões

- Remove o botão Desativar/Ativar da lista. Ativar/desativar aluno passa a
  acontecer só como efeito de duas ações de negócio:
  - **Matricular** → ativa (implícito ao criar matrícula).
  - **Cancelar matrícula** → inativa (parte da RPC `cancelar_matricula` da
    outra frente).
- Ícone **Matricular** aparece quando o aluno está inativo ou sem matrícula
  ativa no ano corrente. Leva para `/matriculas?aluno_id=X#nova-matricula`
  (mesmo destino do `ReenrollButton` já existente na ficha).
- Ícone **Cancelar matrícula** aparece quando há matrícula ativa no ano
  corrente. Abre o diálogo compartilhado da frente de Cancelamento.
- Ícones maiores, com cor por ação via tokens do DS (sem hex cru):
  Editar (primária), Boletim (neutra), Matricular (sucesso), Cancelar
  (perigo). Mantém tooltip e `aria-label`.
- Coluna nova **Financeiro** na lista: status da cobrança do mês corrente por
  aluno — *Pago (isaac)*, *Pago (manual)*, *Em aberto*, *Vencido*, ou "—" sem
  cobrança no mês. Filtro adicional por esse status, persistido na URL como
  os filtros já existentes.
- Extrato da ficha do aluno (`StudentStatementSection`) ganha selo "isaac"/
  "manual" por cobrança, usando `cobrancas.origem`.

## Implementação

### Ícones de ação
- `aluno-row-actions.tsx`: remove o par Desativar/Ativar (`UserX`/`UserCheck`
  + `toggleStudentAction`). Adiciona os dois ícones condicionais acima,
  reaproveitando `RowActionButton`.
- Verificar se `toggleStudentAction` (`src/lib/actions/students.ts:368-383`)
  tem outro chamador antes de remover a action; se não tiver, remover código
  morto junto (regra do projeto: sem código morto).
- A condição "matrícula ativa no ano corrente" reaproveita a mesma função já
  usada pela página (`activeEnrollment()`, `page.tsx:36-40`).

### Coluna Financeiro
- Consulta em lote (não por aluno) trazendo, para os alunos da página atual,
  a cobrança do mês corrente com `origem` e `status`:
  - `origem = 'isaac'` + `status = 'paga'` → *Pago (isaac)*.
  - `origem = 'manual'` + `status = 'paga'` → *Pago (manual)*.
  - `status = 'vencida'` → *Vencido*.
  - `status in ('aberta','parcial')` → *Em aberto*.
  - nenhuma cobrança no mês → "—".
- Filtro novo na URL (`financeiro=pago_isaac|pago_manual|aberto|vencido`),
  seguindo o padrão do filtro `situacao` já existente.

### Extrato da ficha
- `student-statement-section.tsx` e `getStudentStatement` (dados já buscam
  cobrança — só precisa incluir/exibir `origem`): badge "isaac" (uma cor) ou
  "manual" (outra), tokens do DS.

## Fora de escopo

- Mudar a regra de "aluno ativo com matrícula ativa" já documentada no
  comentário de `page.tsx:80`.
- Editar/excluir cobrança pela lista.
- Status financeiro de meses anteriores na lista (só mês corrente).

## Testes

- Regra de qual ícone aparece: ativo com matrícula ativa → só Cancelar;
  inativo ou sem matrícula ativa no ano → só Matricular.
- Derivação do status financeiro para as 5 combinações (isaac pago, manual
  pago, aberta, vencida, sem cobrança).
- `toggleStudentAction` removida sem quebrar outro chamador (ou mantida se
  houver uso legítimo fora da lista — a checar na implementação).
- `npm run typecheck && npm run build` verdes.

## Critério de aceite

- Lista sem o botão Desativar/Ativar; Matricular/Cancelar aparecem conforme
  a regra.
- Ícones maiores e coloridos por ação, com tokens do DS.
- Coluna Financeiro e filtro funcionando com dado real de isaac e manual.
- Extrato da ficha mostra a origem de cada cobrança.
