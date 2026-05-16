-- Adiciona segmento às séries para agrupar por nível de ensino
create type segmento_serie as enum ('INFANTIL', 'FUNDAMENTAL1', 'FUNDAMENTAL2', 'MEDIO');

alter table series add column segmento segmento_serie null;
