-- CANCELADO 2026-05-17.
--
-- Backfill original marcava 33 matriculas concluida -> ativa+bolsa_integral
-- com base na heuristica "aluno sem matricula ativa mas com concluida".
--
-- Investigacao revelou: esses 33 sao EX-ALUNOS REAIS (turmas 2012-2025).
-- Nao sao bolsistas atuais. Backfill foi falso positivo.
--
-- Estrutura tipo_vaga + percentual_bolsa (migration 202605280003) MANTIDA.
-- Bolsistas reais serao marcados via UI conforme identificacao manual.
--
-- Esta migration permanece como no-op para preservar historico.

select 1;
