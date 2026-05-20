-- Seed: disciplinas base por segmento, replicadas em todas series do segmento

with serie_disc as (
  select s.id as serie_id, s.segmento,
    unnest(case s.segmento
      when 'INFANTIL'      then array['Linguagem','Matematica','Natureza e Sociedade','Artes','Movimento','Musica']
      when 'FUNDAMENTAL1'  then array['Portugues','Matematica','Ciencias','Historia','Geografia','Artes','Educacao Fisica','Ingles']
      when 'FUNDAMENTAL2'  then array['Portugues','Matematica','Ciencias','Historia','Geografia','Artes','Educacao Fisica','Ingles','Producao Textual']
      when 'MEDIO'         then array['Portugues','Matematica','Fisica','Quimica','Biologia','Historia','Geografia','Filosofia','Sociologia','Ingles','Educacao Fisica','Artes','Redacao']
      else array[]::text[]
    end) as nome
  from series s
  where s.escola_id = '00000000-0000-0000-0000-000000000001'
)
insert into disciplinas (escola_id, serie_id, nome, ordem)
select
  '00000000-0000-0000-0000-000000000001',
  sd.serie_id,
  sd.nome,
  row_number() over (partition by sd.serie_id order by sd.nome) - 1
from serie_disc sd
on conflict (escola_id, serie_id, nome) do nothing;
