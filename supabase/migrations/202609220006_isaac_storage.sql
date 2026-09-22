-- Bucket privado dos arquivos de repasse isaac (analítico .xlsx e resumo .pdf).
--
-- Os arquivos ficam guardados porque são a fonte do que entra no livro-razão:
-- quando alguém questionar um número de fechamento daqui a um ano, o caminho
-- está em isaac_repasse.arquivo_analitico_path / arquivo_resumo_path.
--
-- Ref: docs/superpowers/specs/2026-09-21-financeiro-isaac-multicnpj-design.md

insert into storage.buckets (id, name, public)
values ('isaac-repasses', 'isaac-repasses', false)
on conflict (id) do nothing;

-- As policies dos buckets antigos usam `exists (select 1 from current_perfil())`,
-- que NÃO filtra nada: current_perfil() é `returns perfis` e devolve uma linha
-- de nulos quando não há sessão, então o exists é sempre verdadeiro. Aqui o
-- teste é sobre o id e sobre o perfil — repasse é dado financeiro, não deve
-- ficar legível para secretaria ou professor.
drop policy if exists "financeiro read isaac repasses" on storage.objects;
create policy "financeiro read isaac repasses" on storage.objects for select to authenticated
  using (
    bucket_id = 'isaac-repasses'
    and exists (select 1 from current_perfil() p where p.id is not null and p.perfil in ('admin','financeiro'))
  );

drop policy if exists "financeiro write isaac repasses" on storage.objects;
create policy "financeiro write isaac repasses" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'isaac-repasses'
    and exists (select 1 from current_perfil() p where p.id is not null and p.perfil in ('admin','financeiro'))
  );

-- Sem update nem delete: o arquivo importado é registro contábil e não deve ser
-- sobrescrito. Reimport do mesmo mês grava um caminho novo (o nome carrega
-- timestamp), preservando o anterior.
