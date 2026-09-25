-- supabase/migrations/202609240011_cancelamento_matricula.sql
--
-- Cancelamento de matrícula no meio do ano (evento 2, distinto de
-- "não renovação" — ver docs/superpowers/specs/2026-09-24-cancelamento-matricula-design.md).
-- `cancelado_por` referencia `perfis(id)` (não `auth.users`), mesmo padrão de
-- `pagamentos.registrado_por` e `isaac_repasse.importado_por` já usados no
-- schema — session.profile.id é o id de `perfis`, não de `auth.users`.

alter table matriculas
  add column if not exists cancelamento_data date,
  add column if not exists cancelamento_motivo text,
  add column if not exists cancelamento_obs text,
  add column if not exists cancelado_por uuid references perfis(id) on delete set null,
  add column if not exists ciente_coordenacao boolean not null default false,
  add column if not exists ciente_diretoria boolean not null default false,
  add column if not exists isaac_cancelado_confirmado boolean;

alter table matriculas
  drop constraint if exists matriculas_cancelamento_motivo_check,
  add constraint matriculas_cancelamento_motivo_check
    check (cancelamento_motivo is null or cancelamento_motivo in (
      'transferencia', 'desistencia', 'mudanca_cidade', 'inadimplencia', 'outro'
    ));

alter table isaac_parcela
  drop constraint if exists isaac_parcela_motivo_pendencia_check,
  add constraint isaac_parcela_motivo_pendencia_check
    check (motivo_pendencia is null or motivo_pendencia in (
      'sem_aluno', 'tipo_vaga_incompativel', 'permuta_manual', 'aluno_cancelado'
    ));
