-- supabase/migrations/202606220002_anamnese_pdf_completo.sql
-- Anamnese PDF completo: expande pipeline_anamnese para cobrir as ~60 perguntas
-- da ficha de anamnese em papel (FICHA DE ANAMNESE FUND 1).
--
-- Todas as colunas são nullable. Herdam RLS (policy pipeline_anamnese_rw),
-- grants e o trigger pipeline_anamnese_updated_at já existentes (MVP5).
-- NÃO altera pipeline_promover_card: campos qualitativos novos não espelham
-- em informacoes_medicas (decisão de design — YAGNI).

-- ─── Identificação / entrevista ──────────────────────────────────────────────
alter table pipeline_anamnese add column if not exists como_soube_escola   text;
alter table pipeline_anamnese add column if not exists turno               text;
alter table pipeline_anamnese add column if not exists data_visita         date;
alter table pipeline_anamnese add column if not exists crianca_compareceu  boolean;

-- ─── Família ─────────────────────────────────────────────────────────────────
alter table pipeline_anamnese add column if not exists pais_estado_civil   text;
alter table pipeline_anamnese add column if not exists crianca_vive_com     text;

-- ─── Gestação / parto ────────────────────────────────────────────────────────
alter table pipeline_anamnese add column if not exists gestacao            text;
alter table pipeline_anamnese add column if not exists saude_mae_gravidez  text;
alter table pipeline_anamnese add column if not exists parto               text;
alter table pipeline_anamnese add column if not exists amamentou           text;
alter table pipeline_anamnese add column if not exists mamadeira           text;

-- ─── Estrutura familiar ──────────────────────────────────────────────────────
alter table pipeline_anamnese add column if not exists tem_irmaos          boolean;
alter table pipeline_anamnese add column if not exists posicao_familiar    text;
alter table pipeline_anamnese add column if not exists filho_adotivo       boolean;
alter table pipeline_anamnese add column if not exists ciente_adocao       boolean;

-- ─── Desenvolvimento ─────────────────────────────────────────────────────────
alter table pipeline_anamnese add column if not exists desenvolvimento_motor        text;
alter table pipeline_anamnese add column if not exists atraso_fala                  text;
alter table pipeline_anamnese add column if not exists troca_fonemas                text;
alter table pipeline_anamnese add column if not exists dificuldade_visao_locomocao  text;
alter table pipeline_anamnese add column if not exists fatos_desenvolvimento        text;
alter table pipeline_anamnese add column if not exists controle_esfincter           text;
alter table pipeline_anamnese add column if not exists enurese_noturna              text;
alter table pipeline_anamnese add column if not exists perturbacoes_sono_dev        text;
alter table pipeline_anamnese add column if not exists habitos_especiais            text;
alter table pipeline_anamnese add column if not exists atende_intervencoes          text;

-- ─── Comportamento / emocional ───────────────────────────────────────────────
alter table pipeline_anamnese add column if not exists choro_facil              text;
alter table pipeline_anamnese add column if not exists recusa_auxilio           text;
alter table pipeline_anamnese add column if not exists resistencia_toque        text;
alter table pipeline_anamnese add column if not exists escola_anterior          text;
alter table pipeline_anamnese add column if not exists faz_amigos               text;
alter table pipeline_anamnese add column if not exists adapta_meio              boolean;
alter table pipeline_anamnese add column if not exists companheiros_brincadeira text;
alter table pipeline_anamnese add column if not exists distracoes_preferidas    text;
alter table pipeline_anamnese add column if not exists atitudes_sociais         text; -- CSV (múltipla)
alter table pipeline_anamnese add column if not exists emocional                text; -- CSV (múltipla)
alter table pipeline_anamnese add column if not exists sono                     text; -- CSV (múltipla)

-- ─── Saúde (complementa campos existentes) ───────────────────────────────────
alter table pipeline_anamnese add column if not exists problemas_neurologicos  text;
alter table pipeline_anamnese add column if not exists acompanhamento_medico   text;

-- ─── Reação / internet / fechamento ──────────────────────────────────────────
alter table pipeline_anamnese add column if not exists reacao_contrariada       text;
alter table pipeline_anamnese add column if not exists intolerancia_frustracao  boolean;
alter table pipeline_anamnese add column if not exists uso_internet             text;
alter table pipeline_anamnese add column if not exists orientacao_internet      text;
alter table pipeline_anamnese add column if not exists outras_informacoes       text;
