-- Comunicados por turma/série: novo alcance "segmentado" + coluna de alvos.

alter type alcance_comunicado add value if not exists 'segmentado';

alter table comunicados
  add column if not exists alvos jsonb not null default '[]'::jsonb;
