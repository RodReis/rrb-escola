"""
Normaliza matrículas 2026 com base na planilha MATRICULADOS2026.xlsx:
  - Cria séries/turmas faltantes
  - Corrige série/turma errada (UPDATE matrícula existente)
  - Cria matrículas 2026 faltantes
Uso: python scripts/normalizar_matriculas_2026.py [--dry-run]
"""
import urllib.request, urllib.error, json, sys, openpyxl, unicodedata, re, argparse
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = 'http://127.0.0.1:55421'
SERVICE_KEY  = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'
ESCOLA_ID    = '00000000-0000-0000-0000-000000000001'
ANO          = 2026
XLSX_PATH    = 'c:/Desenv/Projetos/rrb-escola/public/MATRICULADOS2026.xlsx'

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
        msg = e.read().decode()
        raise RuntimeError(f'HTTP {e.code} {method} {path}: {msg}') from e

def get(path):   return api('GET', path)
def post(path, body): return api('POST', path, body)
def patch(path, body): return api('PATCH', path, body)

def norm(s):
    if not s: return ''
    s = unicodedata.normalize('NFD', str(s))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', s).strip().upper()

def parse_st(raw):
    """Parse planilha série/turma string → (serie_nome, turma_nome)."""
    raw = raw.strip()
    m = re.match(r'^(\d+)[ªº]\s*S[ÉE]RIE\s*-\s*EM\s*-\s*(.+)$', raw, re.IGNORECASE)
    if m: return f'{m.group(1)}ª Série EM', m.group(2).strip()
    m = re.match(r'^(\d+)[ªº]\s*ANO\s*-\s*(.+)$', raw, re.IGNORECASE)
    if m: return f'{m.group(1)}º Ano', m.group(2).strip()
    m = re.match(r'^INFANTIL\s+(\d+)\s*-\s*(.+)$', raw, re.IGNORECASE)
    if m: return f'Infantil {m.group(1)}', m.group(2).strip()
    m = re.match(r'^MATERNAL\s*-\s*(.+)$', raw, re.IGNORECASE)
    if m: return 'Maternal', m.group(1).strip()
    return raw, ''

def ensure_serie(nome, series_cache, dry_run):
    if nome in series_cache:
        return series_cache[nome]
    print(f'  [CRIAR SÉRIE] {nome}')
    if not dry_run:
        rows = post('series', {'escola_id': ESCOLA_ID, 'nome': nome, 'ativo': True})
        series_cache[nome] = rows[0]['id']
    else:
        series_cache[nome] = f'dry-{nome}'
    return series_cache[nome]

def ensure_turma(serie_id, turma_nome, turmas_cache, dry_run):
    key = (serie_id, norm(turma_nome))
    if key in turmas_cache:
        return turmas_cache[key]
    print(f'  [CRIAR TURMA] {turma_nome} / serie {serie_id}')
    if not dry_run:
        rows = post('turmas', {
            'escola_id': ESCOLA_ID,
            'serie_id': serie_id,
            'nome': turma_nome,
            'ano_letivo': ANO,
            'ativo': True,
        })
        turmas_cache[key] = rows[0]['id']
    else:
        turmas_cache[key] = f'dry-turma-{turma_nome}'
    return turmas_cache[key]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    dry_run = args.dry_run

    if dry_run:
        print('=== DRY RUN ===\n')

    # load DB state
    series_db  = get(f'series?select=id,nome&escola_id=eq.{ESCOLA_ID}')
    turmas_db  = get(f'turmas?select=id,nome,serie_id&escola_id=eq.{ESCOLA_ID}&ano_letivo=eq.{ANO}')
    alunos_db  = get(f'alunos?select=id,nome,matricula_codigo&escola_id=eq.{ESCOLA_ID}')
    mats_db    = get(f'matriculas?select=id,aluno_id,serie_id,turma_id&escola_id=eq.{ESCOLA_ID}&ano_letivo=eq.{ANO}')

    # caches
    series_cache  = {s['nome']: s['id'] for s in series_db}
    # turmas indexed by (serie_id, NORM(nome))
    turmas_cache  = {(t['serie_id'], norm(t['nome'])): t['id'] for t in turmas_db}
    aluno_by_norm = {norm(a['nome']): a for a in alunos_db}
    mat_by_aluno  = {m['aluno_id']: m for m in mats_db}

    # load xlsx
    wb = openpyxl.load_workbook(XLSX_PATH)
    ws = wb.active

    created  = 0
    fixed    = 0
    already_ok = 0
    errors   = 0

    for row in ws.iter_rows(min_row=2, values_only=True):
        nome, st = row[3], row[4]
        if not nome or not st:
            continue

        aluno = aluno_by_norm.get(norm(nome))
        if not aluno:
            print(f'  [NÃO ENCONTRADO] {nome}')
            errors += 1
            continue

        serie_nome, turma_nome = parse_st(st)

        try:
            serie_id = ensure_serie(serie_nome, series_cache, dry_run)
            turma_id = ensure_turma(serie_id, turma_nome, turmas_cache, dry_run)
        except Exception as e:
            print(f'  [ERRO série/turma] {nome}: {e}')
            errors += 1
            continue

        mat = mat_by_aluno.get(aluno['id'])

        if not mat:
            # criar matrícula nova
            print(f'  [CRIAR MAT] {nome} → {serie_nome} / {turma_nome}')
            if not dry_run:
                try:
                    new_mat = post('matriculas', {
                        'escola_id':          ESCOLA_ID,
                        'aluno_id':           aluno['id'],
                        'serie_id':           serie_id,
                        'turma_id':           turma_id,
                        'codigo':             f'{aluno["matricula_codigo"]}-{ANO}',
                        'data_matricula':     datetime.now().strftime('%Y-%m-%d'),
                        'ano_letivo':         ANO,
                        'status':             'ativa',
                        'observacoes':        'Importado via planilha MATRICULADOS2026',
                    })
                    mat_by_aluno[aluno['id']] = new_mat[0]
                except Exception as e:
                    print(f'    ERRO: {e}')
                    errors += 1
                    continue
            created += 1

        elif mat['serie_id'] != serie_id or mat['turma_id'] != turma_id:
            # corrigir
            print(f'  [CORRIGIR MAT] {nome} → {serie_nome} / {turma_nome}')
            if not dry_run:
                try:
                    patch(f'matriculas?id=eq.{mat["id"]}&escola_id=eq.{ESCOLA_ID}', {
                        'serie_id': serie_id,
                        'turma_id': turma_id,
                    })
                    mat['serie_id'] = serie_id
                    mat['turma_id'] = turma_id
                except Exception as e:
                    print(f'    ERRO: {e}')
                    errors += 1
                    continue
            fixed += 1

        else:
            already_ok += 1

    print(f'\n=== Resultado ===')
    print(f'Matrículas criadas:   {created}')
    print(f'Matrículas corrigidas:{fixed}')
    print(f'Já corretas:          {already_ok}')
    print(f'Erros:                {errors}')

if __name__ == '__main__':
    main()
