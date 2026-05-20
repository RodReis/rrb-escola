## reconcile_matriculas_2026

Reconcilia série/turma/turno de matrículas 2026 a partir de
`public/MATRICULADOS2026.xlsx`.

- Dry-run: `npm run reconcile:matriculas:2026`
- Apply: `npm run reconcile:matriculas:2026:apply`

Relatório em `docs/pdfs/reconcile-2026-*.json`.

Convenção:
- Maternal/Infantil: turno no cabeçalho (`MATERNAL - MATUTINO`).
- Fund+Médio: turma `A` = matutino, `B` = vespertino.

Match aluno: nome exato normalizado (sem acento, upper, trim).
Sem match → órfão (revisar manualmente).
