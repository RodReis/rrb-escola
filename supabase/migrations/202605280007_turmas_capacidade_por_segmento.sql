-- Aplica capacidade por etapa nas turmas 2026
-- INFANTIL=20, FUNDAMENTAL1=20, FUNDAMENTAL2=35, MEDIO=35

update turmas t
set capacidade = case s.segmento
  when 'INFANTIL'      then 20
  when 'FUNDAMENTAL1'  then 20
  when 'FUNDAMENTAL2'  then 35
  when 'MEDIO'         then 35
  else t.capacidade
end
from series s
where t.serie_id = s.id
  and t.escola_id = '00000000-0000-0000-0000-000000000001'
  and t.ano_letivo = 2026;
