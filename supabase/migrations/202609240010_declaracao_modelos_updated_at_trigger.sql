-- declaracao_modelos ficou sem o trigger que atualiza updated_at
-- automaticamente (achado da revisao final de branch) — mesmo padrao ja
-- usado em escolas/perfis/alunos/... na migration inicial (set_updated_at()).

create trigger declaracao_modelos_updated_at
  before update on declaracao_modelos
  for each row execute function set_updated_at();
