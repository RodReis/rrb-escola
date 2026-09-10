"""
Insere matrículas históricas faltantes nos alunos já importados.
Uso: python scripts/fix_matriculas.py [--dry-run]
"""

import sys
import re
import json
import urllib.request
import urllib.error
import argparse
from datetime import datetime
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

SUPABASE_URL = "http://127.0.0.1:55421"
SERVICE_KEY = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"
ESCOLA_ID = "00000000-0000-0000-0000-000000000001"

PDF_FILES = [
    Path(__file__).parent.parent / "dados-alunos" / "Resultado.pdf",
    Path(__file__).parent.parent / "dados-alunos" / "Resultado1.pdf",
]

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

def api(method, path, body=None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read()) if r.length != 0 else []
    except urllib.error.HTTPError as e:
        msg = e.read().decode()
        raise RuntimeError(f"HTTP {e.code} {method} {path}: {msg}") from e

def get(path): return api("GET", path)
def post(path, body): return api("POST", path, body)

def parse_date(s):
    if not s: return None
    m = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})$', s.strip())
    if m: return f"{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
    return None

_SERIE_PREFIXES = [
    r'\d+[ºª°]\s*Ano',
    r'Infantil\s+\d+',
    r'Infantil\s+[IVX]+',
    r'Maternal',
    r'\d+[ºª°]\s*S[ée]rie',
    r'\d+[ºª°]\s*Ano\s+E[FM]',
]
_SERIE_RE = re.compile(r'^(' + '|'.join(_SERIE_PREFIXES) + r')', re.IGNORECASE)

def split_serie_turma(raw):
    quote_m = re.search(r'"([^"]+)"', raw)
    if quote_m:
        inner = quote_m.group(1)
        turma_m = re.search(r'[-–]\s*(\S+)\s*$', inner)
        turma = turma_m.group(1) if turma_m else inner.split()[-1]
        serie_raw = raw[:raw.index('"')].strip()
        serie_m = _SERIE_RE.match(serie_raw)
        serie = serie_m.group(0).strip() if serie_m else serie_raw
        return serie, turma
    serie_m = _SERIE_RE.match(raw)
    if serie_m:
        serie = serie_m.group(0).strip()
        rest = raw[serie_m.end():].strip()
        turma = rest.split()[0] if rest else "A"
        return serie, turma
    parts = raw.rsplit(None, 1)
    if len(parts) == 2:
        return parts[0].strip(), parts[1].strip()
    return raw.strip(), "A"

def extract_matriculas_from_page(text):
    """Extract matricula_codigo and list of enrollment records from one page."""
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    matricula_codigo = None
    for i, line in enumerate(lines):
        if re.search(r'matr[íi]cula\s+nome', line, re.IGNORECASE):
            if i + 1 < len(lines):
                parts = lines[i + 1].split(None, 1)
                if parts and parts[0].isdigit():
                    matricula_codigo = parts[0]
            break

    if not matricula_codigo:
        return None, []

    matriculas = []
    in_mat = False
    mat_header_seen = False
    for line in lines:
        if re.search(r'^Rela[çc][ãa]o de Matr[íi]culas', line, re.IGNORECASE):
            in_mat = True
            continue
        if in_mat and not mat_header_seen:
            if re.search(r'S[ée]rie\s+Turma\s+Data', line, re.IGNORECASE):
                mat_header_seen = True
            continue
        if in_mat and mat_header_seen:
            if re.search(r'^Atributos Adicionais', line, re.IGNORECASE):
                break
            m = re.match(r'^(.+?)\s+(\d{2}/\d{2}/\d{4})\s+(\d+)$', line)
            if m:
                serie_turma_raw = m.group(1).strip()
                data_mat = parse_date(m.group(2))
                idade = int(m.group(3))
                ano_letivo = int(m.group(2).split("/")[2])
                serie, turma = split_serie_turma(serie_turma_raw)
                matriculas.append({
                    "serie": serie,
                    "turma": turma,
                    "data_matricula": data_mat,
                    "idade_na_matricula": idade,
                    "ano_letivo": ano_letivo,
                })

    return matricula_codigo, matriculas

def load_series():
    rows = get(f"series?select=id,nome&escola_id=eq.{ESCOLA_ID}")
    return {r["nome"]: r["id"] for r in rows}

def load_turmas():
    rows = get(f"turmas?select=id,nome,ano_letivo,serie_id&escola_id=eq.{ESCOLA_ID}")
    result = {}
    for r in rows:
        result[(r["serie_id"], r["nome"].upper(), int(r["ano_letivo"]))] = r["id"]
    return result

def load_alunos():
    """Returns dict matricula_codigo → aluno_id."""
    rows = get(f"alunos?select=id,matricula_codigo&escola_id=eq.{ESCOLA_ID}")
    return {r["matricula_codigo"]: r["id"] for r in rows}

def load_existing_matriculas_by_aluno():
    """Returns dict aluno_id → set of (serie_id, turma_id, ano_letivo)."""
    rows = get(f"matriculas?select=aluno_id,serie_id,turma_id,ano_letivo&escola_id=eq.{ESCOLA_ID}")
    result = {}
    for r in rows:
        key = r["aluno_id"]
        result.setdefault(key, set())
        result[key].add((r["serie_id"], r["turma_id"], int(r["ano_letivo"])))
    return result

def ensure_serie(nome, series_cache, dry_run):
    if nome in series_cache:
        return series_cache[nome]
    print(f"  [CRIAR SÉRIE] {nome}")
    if not dry_run:
        rows = post("series", {"escola_id": ESCOLA_ID, "nome": nome, "ativo": True})
        series_cache[nome] = rows[0]["id"]
    else:
        series_cache[nome] = f"dry-serie-{nome}"
    return series_cache[nome]

def ensure_turma(serie_id, turma_nome, ano_letivo, turmas_cache, dry_run):
    key = (serie_id, turma_nome.upper(), int(ano_letivo))
    if key in turmas_cache:
        return turmas_cache[key]
    print(f"  [CRIAR TURMA] {turma_nome} / ano {ano_letivo}")
    if not dry_run:
        rows = post("turmas", {
            "escola_id": ESCOLA_ID,
            "serie_id": serie_id,
            "nome": turma_nome,
            "ano_letivo": ano_letivo,
            "ativo": True,
        })
        turmas_cache[key] = rows[0]["id"]
    else:
        turmas_cache[key] = f"dry-turma-{turma_nome}-{ano_letivo}"
    return turmas_cache[key]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    dry_run = args.dry_run

    if dry_run:
        print("=== DRY RUN ===\n")

    import pdfplumber

    alunos = load_alunos()
    series_cache = load_series()
    turmas_cache = load_turmas()
    existing_mats = load_existing_matriculas_by_aluno()

    print(f"Alunos no banco: {len(alunos)}")

    inserted = 0
    skipped = 0
    not_found = 0
    errors = 0

    for pdf_path in PDF_FILES:
        if not pdf_path.exists():
            print(f"[AVISO] {pdf_path} não encontrado")
            continue
        print(f"\n=== {pdf_path.name} ===")
        with pdfplumber.open(str(pdf_path)) as pdf:
            for i, page in enumerate(pdf.pages):
                txt = page.extract_text()
                if not txt or "Ficha do Aluno" not in txt:
                    continue
                try:
                    matricula_codigo, matriculas = extract_matriculas_from_page(txt)
                    if not matricula_codigo:
                        continue

                    aluno_id = alunos.get(matricula_codigo)
                    if not aluno_id:
                        not_found += 1
                        continue

                    aluno_mats = existing_mats.get(aluno_id, set())

                    for mat in matriculas:
                        serie_id = ensure_serie(mat["serie"], series_cache, dry_run)
                        turma_id = ensure_turma(serie_id, mat["turma"], mat["ano_letivo"], turmas_cache, dry_run)
                        key = (serie_id, turma_id, int(mat["ano_letivo"]))

                        if key in aluno_mats:
                            skipped += 1
                            continue

                        ano = mat["ano_letivo"]
                        status = "ativa" if ano == datetime.now().year else "concluida"
                        print(f"  [{matricula_codigo}] matrícula {mat['serie']} {mat['turma']} {ano} → {status}")

                        if not dry_run:
                            post("matriculas", {
                                "escola_id": ESCOLA_ID,
                                "aluno_id": aluno_id,
                                "serie_id": serie_id,
                                "turma_id": turma_id,
                                "codigo": f"{matricula_codigo}-{ano}",
                                "data_matricula": mat.get("data_matricula") or datetime.now().strftime("%Y-%m-%d"),
                                "ano_letivo": ano,
                                "idade_na_matricula": mat.get("idade_na_matricula"),
                                "status": status,
                                "observacoes": "Importado via script PDF",
                            })
                            aluno_mats.add(key)

                        inserted += 1

                except Exception as e:
                    print(f"  [ERRO] página {i+1}: {e}")
                    errors += 1

    print(f"\n=== Resultado ===")
    print(f"Matrículas inseridas: {inserted}")
    print(f"Já existiam:         {skipped}")
    print(f"Aluno não no banco:  {not_found}")
    print(f"Erros:               {errors}")

if __name__ == "__main__":
    main()
