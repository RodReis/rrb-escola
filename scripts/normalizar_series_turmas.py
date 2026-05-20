"""
Normaliza séries e turmas 2026 conforme padrão definido:
  Series renomeadas + segmento preenchido
  Turmas 2026 com nome MATUTINO/VESPERTINO e turno correto
Uso: python scripts/normalizar_series_turmas.py [--dry-run]
"""
import urllib.request, urllib.error, json, sys, argparse
sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = 'http://127.0.0.1:55421'
SERVICE_KEY  = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'
ESCOLA_ID    = '00000000-0000-0000-0000-000000000001'
ANO          = 2026

HEADERS = {
    'apikey': SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
}

def api(method, path, body=None):
    url = f'{SUPABASE_URL}/rest/v1/{path}'
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read()) if r.length != 0 else []
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'HTTP {e.code} {method} {path}: {e.read().decode()[:300]}') from e

def get(p):    return api('GET', p)
def patch(p, b): return api('PATCH', p, b)

# ── mapeamento: nome_atual → (novo_nome, segmento, ordem) ─────────────────────
# Séries que NÃO estão aqui são histórico puro (Infantil I/II/III) — só seta segmento
SERIE_MAP = {
    # INFANTIL
    'Maternal':   ('Maternal',   'INFANTIL',      1),
    'Infantil 3': ('Infantil 3', 'INFANTIL',      2),
    'Infantil 4': ('Infantil 4', 'INFANTIL',      3),
    'Infantil 5': ('Infantil 5', 'INFANTIL',      4),
    # FUNDAMENTAL1
    '1º Ano':     ('1º Ano',     'FUNDAMENTAL1',  5),
    '2º Ano':     ('2º Ano',     'FUNDAMENTAL1',  6),
    '3º Ano':     ('3º Ano',     'FUNDAMENTAL1',  7),
    '4º Ano':     ('4º Ano',     'FUNDAMENTAL1',  8),
    '5º Ano':     ('5º Ano',     'FUNDAMENTAL1',  9),
    # FUNDAMENTAL2
    '6º Ano':     ('6º Ano',     'FUNDAMENTAL2', 10),
    '7º Ano':     ('7º Ano',     'FUNDAMENTAL2', 11),
    '8º Ano':     ('8º Ano',     'FUNDAMENTAL2', 12),
    '9º Ano':     ('9º Ano',     'FUNDAMENTAL2', 13),
    # MEDIO
    '1ª Série':   ('1ª Série',   'MEDIO',        14),
    '2ª Série':   ('2ª Série',   'MEDIO',        15),
    '3ª Série':   ('3ª Série',   'MEDIO',        16),
    # histórico legado — só segmento
    'Infantil I':   ('Infantil I',   'INFANTIL', 0),
    'Infantil II':  ('Infantil II',  'INFANTIL', 0),
    'Infantil III': ('Infantil III', 'INFANTIL', 0),
}

# ── turmas 2026 esperadas por série ──────────────────────────────────────────
# (série_nome, turma_nome_atual_possivel) → (novo_nome, turno_enum)
# turno_enum: matutino | vespertino | noturno | integral
TURMA_NORM = {
    # nome atual → (novo_nome, turno)
    'MATUTINO':  ('MATUTINO', 'matutino'),
    'VESPERTINO': ('VESPERTINO', 'vespertino'),
    'MAT':       ('MATUTINO', 'matutino'),
    'VESP':      ('VESPERTINO', 'vespertino'),
    'A':         ('MATUTINO', 'matutino'),   # turmas A/B históricas → só pra 2026 das séries que usavam A/B
    'B':         ('VESPERTINO', 'vespertino'),
    '-':         (None, None),               # turma sem nome = não normalizar
}

# séries que usam A/B em vez de MATUTINO/VESPERTINO — mapear A→MATUTINO, B→VESPERTINO em 2026
SERIES_AB = {
    '1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano',
    '6º Ano', '7º Ano', '8º Ano', '9º Ano',
    '1ª Série', '2ª Série', '3ª Série',
}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    dry_run = args.dry_run

    if dry_run:
        print('=== DRY RUN ===\n')

    series_db = get(f'series?select=id,nome,segmento,ordem&escola_id=eq.{ESCOLA_ID}&order=nome')
    serie_by_id = {s['id']: s for s in series_db}

    # ── 1. normalizar séries ──────────────────────────────────────────────────
    print('=== SÉRIES ===')
    for s in series_db:
        nome = s['nome']
        if nome not in SERIE_MAP:
            print(f'  [SKIP] {nome} — sem mapeamento')
            continue

        novo_nome, segmento, ordem = SERIE_MAP[nome]
        updates = {}
        if s.get('segmento') != segmento:
            updates['segmento'] = segmento
        if s.get('ordem') != ordem and ordem > 0:
            updates['ordem'] = ordem
        if nome != novo_nome:
            updates['nome'] = novo_nome

        if not updates:
            print(f'  [OK] {nome}')
            continue

        print(f'  [UPDATE] {nome} → nome={novo_nome}, segmento={segmento}, ordem={ordem}')
        if not dry_run:
            patch(f'series?id=eq.{s["id"]}&escola_id=eq.{ESCOLA_ID}', updates)

    # ── 2. normalizar turmas 2026 ─────────────────────────────────────────────
    print('\n=== TURMAS 2026 ===')
    turmas_2026 = get(f'turmas?select=id,nome,turno,serie_id&escola_id=eq.{ESCOLA_ID}&ano_letivo=eq.{ANO}')

    for t in turmas_2026:
        serie = serie_by_id.get(t['serie_id'], {})
        serie_nome = serie.get('nome', '?')
        turma_nome = t['nome']

        if turma_nome == '-':
            print(f'  [SKIP] {serie_nome} / turma="-" (histórico sem turma)')
            continue

        # determina novo nome e turno
        norm = TURMA_NORM.get(turma_nome.upper())
        if norm is None:
            # já está em formato correto se for MATUTINO/VESPERTINO
            if turma_nome.upper() in ('MATUTINO', 'VESPERTINO'):
                novo_nome = turma_nome.upper()
                novo_turno = 'matutino' if novo_nome == 'MATUTINO' else 'vespertino'
            else:
                print(f'  [SKIP] {serie_nome} / turma="{turma_nome}" — não mapeado')
                continue
        else:
            novo_nome, novo_turno = norm
            if novo_nome is None:
                print(f'  [SKIP] {serie_nome} / turma="{turma_nome}" — turma sem nome')
                continue

        updates = {}
        if t['nome'] != novo_nome:
            updates['nome'] = novo_nome
        if t.get('turno') != novo_turno:
            updates['turno'] = novo_turno

        if not updates:
            print(f'  [OK] {serie_nome} / {turma_nome}')
            continue

        print(f'  [UPDATE] {serie_nome} / "{turma_nome}" → nome={novo_nome}, turno={novo_turno}')
        if not dry_run:
            try:
                patch(f'turmas?id=eq.{t["id"]}&escola_id=eq.{ESCOLA_ID}', updates)
            except RuntimeError as e:
                print(f'    ERRO: {e}')

    print('\nFeito.')

if __name__ == '__main__':
    main()
