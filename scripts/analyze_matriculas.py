import urllib.request, json, sys, openpyxl, unicodedata, re
sys.stdout.reconfigure(encoding='utf-8')

url = 'http://127.0.0.1:55421'
key = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'
ESCOLA_ID = '00000000-0000-0000-0000-000000000001'
h = {'apikey': key, 'Authorization': f'Bearer {key}'}

def get(path):
    req = urllib.request.Request(f'{url}/rest/v1/{path}', headers=h)
    with urllib.request.urlopen(req) as r: return json.loads(r.read())

def norm(s):
    if not s: return ''
    s = unicodedata.normalize('NFD', str(s))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', s).strip().upper()

def parse_st(raw):
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

# DB data
series_db = get(f'series?select=id,nome&escola_id=eq.{ESCOLA_ID}')
turmas_db = get(f'turmas?select=id,nome,serie_id,ano_letivo&escola_id=eq.{ESCOLA_ID}&ano_letivo=eq.2026')
alunos_db = get(f'alunos?select=id,nome,matricula_codigo&escola_id=eq.{ESCOLA_ID}')
mats_db   = get(f'matriculas?select=id,aluno_id,serie_id,turma_id,status,ano_letivo&escola_id=eq.{ESCOLA_ID}&ano_letivo=eq.2026')

serie_by_id   = {s['id']: s['nome'] for s in series_db}
serie_by_nome = {s['nome']: s['id'] for s in series_db}
turma_by_id   = {t['id']: t['nome'] for t in turmas_db}
aluno_by_norm = {norm(a['nome']): a for a in alunos_db}
mat_by_aluno  = {m['aluno_id']: m for m in mats_db}

# xlsx
wb = openpyxl.load_workbook('c:/Desenv/Projetos/rrb-escola/public/MATRICULADOS2026.xlsx')
ws = wb.active

print('=== MAPEAMENTO SÉRIE/TURMA ===')
seen = set()
for row in ws.iter_rows(min_row=2, values_only=True):
    st = row[4]
    if not st or st in seen: continue
    seen.add(st)
    serie, turma = parse_st(st)
    in_db = serie in serie_by_nome
    print(f'  {st!r:38} → {serie!r:20} / {turma!r:12} | série_no_banco={in_db}')

print('\n=== SITUAÇÃO MATRÍCULAS 2026 ===')
sem_matricula = []
serie_errada  = []
turma_errada  = []
ok            = []

for row in ws.iter_rows(min_row=2, values_only=True):
    nome, st = row[3], row[4]
    if not nome or not st: continue
    aluno = aluno_by_norm.get(norm(nome))
    if not aluno: continue

    serie_nome, turma_nome = parse_st(st)
    mat = mat_by_aluno.get(aluno['id'])

    if not mat:
        sem_matricula.append((nome, serie_nome, turma_nome))
        continue

    db_serie = serie_by_id.get(mat['serie_id'], '?')
    db_turma = turma_by_id.get(mat['turma_id'], '?')

    serie_ok = norm(db_serie) == norm(serie_nome)
    turma_ok = norm(db_turma) == norm(turma_nome)

    if not serie_ok or not turma_ok:
        serie_errada.append((nome, serie_nome, turma_nome, db_serie, db_turma))
    else:
        ok.append(nome)

print(f'OK (série+turma corretos): {len(ok)}')
print(f'Sem matrícula 2026:        {len(sem_matricula)}')
print(f'Série/turma errada:        {len(serie_errada)}')

print('\nSEM MATRÍCULA (primeiros 20):')
for nome, s, t in sem_matricula[:20]:
    print(f'  {nome} → {s} / {t}')

print('\nSÉRIE/TURMA ERRADA (primeiros 20):')
for nome, s, t, ds, dt in serie_errada[:20]:
    print(f'  {nome}')
    print(f'    planilha: {s} / {t}')
    print(f'    banco:    {ds} / {dt}')
