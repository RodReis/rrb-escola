-- Logo da escola (URL de imagem)
alter table escolas add column if not exists logo_url text;
comment on column escolas.logo_url is 'URL publica da logo da escola';
