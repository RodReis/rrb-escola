"""
Importa alunos dos PDFs dados-alunos/Resultado.pdf e Resultado1.pdf direto no Supabase local.
Cria séries e turmas faltantes automaticamente.
Uso: python scripts/import_pdf_alunos.py [--dry-run]
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

# ── config ───────────────────────────────────────────────────────────────────

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

# ── http helpers ──────────────────────────────────────────────────────────────

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

def get(path):
    return api("GET", path)

def post(path, body):
    return api("POST", path, body)

def patch(path, body):
    return api("PATCH", path, body)

# ── serie/turma split ────────────────────────────────────────────────────────

# Known series that consume more than one word
_SERIE_PREFIXES = [
    r'\d+[ºª°]\s*Ano',          # "5º Ano"
    r'Infantil\s+\d+',           # "Infantil 5"
    r'Infantil\s+[IVX]+',        # "Infantil III"
    r'Maternal',
    r'\d+[ºª°]\s*S[ée]rie',
    r'\d+[ºª°]\s*Ano\s+E[FM]',  # "9º Ano EF"
]
_SERIE_RE = re.compile(r'^(' + '|'.join(_SERIE_PREFIXES) + r')', re.IGNORECASE)

def split_serie_turma(raw):
    """
    Split "série turma" string handling:
      "5º Ano B"              → ("5º Ano", "B")
      "Infantil 5 VESPERTINO" → ("Infantil 5", "VESPERTINO")
      'Infantil I "INFANTIL I - MAT"' → ("Infantil I", "MAT")
      'Maternal "MATERNAL - MAT"'     → ("Maternal", "MAT")
    """
    # strip quoted part and extract turma from it first
    quote_m = re.search(r'"([^"]+)"', raw)
    if quote_m:
        inner = quote_m.group(1)  # e.g. "INFANTIL I - MAT" or "INFANTIL II MAT"
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

    # fallback: last word is turma
    parts = raw.rsplit(None, 1)
    if len(parts) == 2:
        return parts[0].strip(), parts[1].strip()
    return raw.strip(), "A"


# ── pdf parsing ───────────────────────────────────────────────────────────────

def extract_pages(pdf_path):
    import pdfplumber
    pages = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            txt = page.extract_text()
            if txt:
                pages.append(txt)
    return pages

def line_after(lines, label_pattern, offset=1):
    """Return the line `offset` positions after first line matching label_pattern."""
    pat = re.compile(label_pattern, re.IGNORECASE)
    for i, line in enumerate(lines):
        if pat.search(line):
            target = i + offset
            if target < len(lines):
                return lines[target].strip()
    return None

def value_on_same_line(text, label_pattern):
    """Return text after label on same line."""
    pat = re.compile(label_pattern + r'\s*[:\-]?\s*(.+)', re.IGNORECASE)
    m = pat.search(text)
    return m.group(1).strip() if m else None

def parse_date(s):
    if not s:
        return None
    m = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})$', s.strip())
    if m:
        return f"{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
    m = re.match(r'^(\d{4})-(\d{1,2})-(\d{1,2})', s.strip())
    if m:
        return f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"
    return None

def parse_page(text):
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    student = {
        "matricula_codigo": None,
        "nome": None,
        "sexo": None,
        "data_nascimento": None,
        "naturalidade": None,
        "celular": None,
        "endereco": None,
        "cidade": None,
        "uf": None,
        "cep": None,
        "cpf": None,
        "rg": None,
        "certidao": None,
        "email": None,
        "etnia": None,
        "informacoes_adicionais": [],
        "contatos": [],
        "responsaveis": [],
        "matriculas": [],
        "pessoas_autorizadas": [],
    }

    # ── matrícula + nome (always on same line after header "Matrícula Nome") ──
    for i, line in enumerate(lines):
        if re.search(r'matr[íi]cula\s+nome', line, re.IGNORECASE):
            if i + 1 < len(lines):
                parts = lines[i + 1].split(None, 1)
                if parts and parts[0].isdigit():
                    student["matricula_codigo"] = parts[0]
                    student["nome"] = parts[1].strip() if len(parts) > 1 else ""
            break

    # ── sexo + data nascimento ──
    for i, line in enumerate(lines):
        if re.search(r'^Sexo\s+Dt\.?\s*Nasc', line, re.IGNORECASE):
            if i + 1 < len(lines):
                nxt = lines[i + 1]
                m = re.match(r'^(Feminino|Masculino)\s+(\d{2}/\d{2}/\d{4})', nxt, re.IGNORECASE)
                if m:
                    student["sexo"] = m.group(1)
                    student["data_nascimento"] = parse_date(m.group(2))
                elif re.match(r'^(Feminino|Masculino)', nxt, re.IGNORECASE):
                    student["sexo"] = nxt.split()[0]
            break

    # ── naturalidade + celular ──
    for i, line in enumerate(lines):
        if re.search(r'^Naturalidade\s+Celular', line, re.IGNORECASE):
            if i + 1 < len(lines):
                nxt = lines[i + 1]
                # format: CIDADE-UF  (62)9xxxx-xxxx  or just CIDADE-UF
                m = re.match(r'^(.+?)\s+([\(\d][\d\s\(\)\-]+)$', nxt)
                if m:
                    student["naturalidade"] = m.group(1).strip()
                    student["celular"] = m.group(2).strip()
                else:
                    student["naturalidade"] = nxt
            break

    # ── endereço ──
    for i, line in enumerate(lines):
        if re.search(r'^Endere[çc]o$', line, re.IGNORECASE):
            if i + 1 < len(lines):
                student["endereco"] = lines[i + 1]
            break

    # ── cidade + cep ──
    for i, line in enumerate(lines):
        if re.search(r'^Cidade\s+CEP', line, re.IGNORECASE):
            if i + 1 < len(lines):
                nxt = lines[i + 1]
                m = re.match(r'^(.+?)\s+(\d{5}-\d{3})\s*$', nxt)
                if m:
                    cidade_uf = m.group(1).strip()
                    student["cep"] = m.group(2)
                    if '-' in cidade_uf:
                        parts = cidade_uf.rsplit('-', 1)
                        student["cidade"] = parts[0].strip()
                        student["uf"] = parts[1].strip()
                    else:
                        student["cidade"] = cidade_uf
                else:
                    student["cidade"] = nxt
            break

    # ── cpf + rg ──
    for i, line in enumerate(lines):
        if re.search(r'^CPF\s+RG', line, re.IGNORECASE):
            if i + 1 < len(lines):
                nxt = lines[i + 1]
                m = re.match(r'^(\d{3}\.\d{3}\.\d{3}-\d{2})\s+(.+)$', nxt)
                if m:
                    student["cpf"] = m.group(1)
                    student["rg"] = m.group(2).strip()
                elif re.match(r'^\d{3}\.\d{3}\.\d{3}-\d{2}$', nxt):
                    student["cpf"] = nxt
            break

    # ── certidão ──
    for i, line in enumerate(lines):
        if re.search(r'^Certid[ãa]o Nasc\.', line, re.IGNORECASE):
            if i + 1 < len(lines):
                certline = lines[i + 1]
                # "Livro: X Folha: Y Nº: Z Cartório: W" or just a number
                if not re.search(r'^E-?Mail', certline, re.IGNORECASE):
                    student["certidao"] = certline
            break

    # ── email ──
    for i, line in enumerate(lines):
        if re.search(r'^E-?Mail\s+C[oó]d\.?\s+INEP', line, re.IGNORECASE):
            if i + 1 < len(lines) and '@' in lines[i + 1]:
                student["email"] = lines[i + 1]
            break

    # ── etnia ──
    for i, line in enumerate(lines):
        if re.search(r'^Etnia$', line, re.IGNORECASE):
            if i + 1 < len(lines):
                nxt = lines[i + 1]
                if not re.search(r'^Informa', nxt, re.IGNORECASE):
                    student["etnia"] = nxt
            break

    # ── informações adicionais (multi-line until "Telefones") ──
    info_lines = []
    in_info = False
    for line in lines:
        if re.search(r'^Informa[çc][õo]es Adicionais$', line, re.IGNORECASE):
            in_info = True
            continue
        if in_info:
            if re.search(r'^Telefones de Contato', line, re.IGNORECASE):
                break
            info_lines.append(line)
    student["informacoes_adicionais"] = [l for l in info_lines if l]

    # ── telefones de contato (simples: nome, tel, parentesco) ──
    in_contacts = False
    for line in lines:
        if re.search(r'^Telefones de Contato', line, re.IGNORECASE):
            in_contacts = True
            continue
        if in_contacts:
            if re.search(r'^Respons[aá]veis do Aluno', line, re.IGNORECASE):
                break
            # "Nome (62)9xxxx-xxxx PARENTESCO"
            m = re.match(r'^(.+?)\s+([\(\d][\d\s\(\)\-]+)\s+([A-ZÁÀÃÉÍÓÕÚÇ]+)$', line)
            if m:
                student["contatos"].append({
                    "nome": m.group(1).strip(),
                    "celular": m.group(2).strip(),
                    "parentesco": m.group(3).strip(),
                })

    # ── responsáveis ──
    # Header: "Nome CPF Telefone Celular Parentesco E-Mail"
    # Rows can span 2 lines (nome on line 1, parentesco end of line 1 or line 2)
    in_resp = False
    resp_header_seen = False
    resp_buffer = []
    for i, line in enumerate(lines):
        if re.search(r'^Respons[aá]veis do Aluno', line, re.IGNORECASE):
            in_resp = True
            continue
        if in_resp and not resp_header_seen:
            if re.search(r'Nome\s+CPF\s+Telefone', line, re.IGNORECASE):
                resp_header_seen = True
            continue
        if in_resp and resp_header_seen:
            if re.search(r'^Rela[çc][ãa]o de Matr[íi]culas', line, re.IGNORECASE):
                break
            resp_buffer.append(line)

    # parse responsáveis buffer
    parentescos = {"Pai", "Mãe", "Mae", "Avó", "Avo", "Avô", "Tio", "Tia", "Irmão", "Irmã", "Outro"}
    i = 0
    while i < len(resp_buffer):
        line = resp_buffer[i]
        if not line:
            i += 1
            continue
        # try full row: NAME CPF TEL CELULAR PARENTESCO EMAIL
        m = re.match(
            r'^(.+?)\s+(\d{3}\.\d{3}\.\d{3}-\d{2})\s+([\(\d][\d\s\(\)\-]+)\s+([\(\d][\d\s\(\)\-]+)?\s*(\w[a-zA-ZãáàâéêíóõôúçÃÁÀÂÉÊÍÓÕÔÚÇ]+)\s*(.+)?$',
            line
        )
        if m:
            student["responsaveis"].append({
                "nome": m.group(1).strip(),
                "cpf": m.group(2),
                "telefone": m.group(3).strip() if m.group(3) else None,
                "celular": m.group(4).strip() if m.group(4) else None,
                "parentesco": m.group(5).strip(),
                "email": m.group(6).strip() if m.group(6) else None,
            })
            i += 1
            continue
        # simpler: NAME (no CPF) then next line is parentesco
        if i + 1 < len(resp_buffer):
            next_line = resp_buffer[i + 1]
            if any(p.lower() in next_line.lower() for p in parentescos):
                student["responsaveis"].append({
                    "nome": line.strip(),
                    "cpf": None,
                    "telefone": None,
                    "celular": None,
                    "parentesco": next_line.strip(),
                    "email": None,
                })
                i += 2
                continue
        i += 1

    # ── matrículas ──
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
            # "5º Ano B 04/11/2025 9"  or "Infantil 5 VESPERTINO 06/11/2024 5"
            m = re.match(r'^(.+?)\s+(\d{2}/\d{2}/\d{4})\s+(\d+)$', line)
            if m:
                serie_turma_raw = m.group(1).strip()
                data_mat = parse_date(m.group(2))
                idade = int(m.group(3))
                ano_letivo = int(m.group(2).split("/")[2])
                serie, turma = split_serie_turma(serie_turma_raw)
                student["matriculas"].append({
                    "serie": serie,
                    "turma": turma,
                    "data_matricula": data_mat,
                    "idade_na_matricula": idade,
                    "ano_letivo": ano_letivo,
                })

    # ── pessoas autorizadas ──
    in_pes = False
    pes_header_seen = False
    for line in lines:
        if re.search(r'^Pessoas Autorizadas a Buscar', line, re.IGNORECASE):
            in_pes = True
            continue
        if in_pes and not pes_header_seen:
            if re.search(r'Nome\s+Telefone\s+Obs', line, re.IGNORECASE):
                pes_header_seen = True
            continue
        if in_pes and pes_header_seen:
            if re.search(r'^Informa[çc][õo]es M[ée]dicas', line, re.IGNORECASE):
                break
            if line:
                m = re.match(r'^(.+?)\s+([\(\d][\d\s\(\)\-]{7,})\s*(.*)$', line)
                if m:
                    student["pessoas_autorizadas"].append({
                        "nome": m.group(1).strip(),
                        "telefone": m.group(2).strip(),
                        "observacao": m.group(3).strip() or None,
                    })
                else:
                    student["pessoas_autorizadas"].append({"nome": line, "telefone": None, "observacao": None})

    return student

# ── supabase lookups ──────────────────────────────────────────────────────────

def load_escola_id():
    rows = get(f"escolas?select=id&limit=1")
    if rows:
        return rows[0]["id"]
    raise RuntimeError("Nenhuma escola encontrada no banco.")

def load_series():
    rows = get(f"series?select=id,nome&escola_id=eq.{ESCOLA_ID}")
    return {r["nome"]: r["id"] for r in rows}

def load_turmas():
    rows = get(f"turmas?select=id,nome,ano_letivo,serie_id&escola_id=eq.{ESCOLA_ID}")
    result = {}
    for r in rows:
        result[(r["serie_id"], r["nome"].upper(), int(r["ano_letivo"]))] = r["id"]
    return result

def load_existing_matriculas():
    rows = get(f"alunos?select=matricula_codigo&escola_id=eq.{ESCOLA_ID}")
    return {r["matricula_codigo"] for r in rows}

# ── ensure serie/turma exist ──────────────────────────────────────────────────

def ensure_serie(nome, series_cache, dry_run):
    if nome in series_cache:
        return series_cache[nome]
    print(f"  [CRIAR SÉRIE] {nome}")
    if not dry_run:
        rows = post(f"series", {"escola_id": ESCOLA_ID, "nome": nome, "ativo": True})
        series_cache[nome] = rows[0]["id"]
    else:
        series_cache[nome] = f"dry-serie-{nome}"
    return series_cache[nome]

def ensure_turma(serie_id, turma_nome, ano_letivo, turmas_cache, dry_run):
    key = (serie_id, turma_nome.upper(), int(ano_letivo))
    if key in turmas_cache:
        return turmas_cache[key]
    print(f"  [CRIAR TURMA] {turma_nome} / ano {ano_letivo} / serie {serie_id}")
    if not dry_run:
        rows = post(f"turmas", {
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

# ── insert student ────────────────────────────────────────────────────────────

def insert_student(s, series_cache, turmas_cache, dry_run):
    matricula = s.get("matricula_codigo")
    nome = s.get("nome")
    if not matricula or not nome:
        return "skip-no-data"

    print(f"  Inserindo aluno {matricula} - {nome}")

    endereco_parts = (s.get("endereco") or "").split(",", 1)
    logradouro = endereco_parts[0].strip() if endereco_parts else s.get("endereco")
    numero = endereco_parts[1].strip() if len(endereco_parts) > 1 else None

    if dry_run:
        aluno_id = f"dry-{matricula}"
    else:
        rows = post("alunos", {
            "escola_id": ESCOLA_ID,
            "matricula_codigo": matricula,
            "nome": nome,
            "sexo": s.get("sexo"),
            "data_nascimento": s.get("data_nascimento"),
            "celular": s.get("celular"),
            "email": s.get("email"),
            "cpf": s.get("cpf"),
            "rg": s.get("rg"),
            "etnia": s.get("etnia"),
            "informacoes_adicionais": "\n".join(s.get("informacoes_adicionais") or []) or None,
            "naturalidade": s.get("naturalidade"),
            "ativo": True,
        })
        aluno_id = rows[0]["id"]

    if not dry_run:
        # endereço
        post("enderecos_aluno", {
            "aluno_id": aluno_id,
            "logradouro": logradouro or "Não informado",
            "numero": numero,
            "cidade": s.get("cidade"),
            "uf": s.get("uf"),
            "cep": s.get("cep"),
            "principal": True,
        })

        # responsáveis
        for resp in s.get("responsaveis") or []:
            if not resp.get("nome"):
                continue
            post("responsaveis_aluno", {
                "aluno_id": aluno_id,
                "nome": resp["nome"],
                "cpf": resp.get("cpf"),
                "telefone": resp.get("telefone"),
                "celular": resp.get("celular"),
                "parentesco": resp.get("parentesco"),
                "email": resp.get("email"),
                "responsavel_financeiro": True,
                "responsavel_pedagogico": True,
            })

        # contatos
        for c in s.get("contatos") or []:
            if not c.get("nome"):
                continue
            post("contatos_aluno", {
                "aluno_id": aluno_id,
                "nome": c["nome"],
                "celular": c.get("celular"),
                "parentesco": c.get("parentesco"),
                "principal": False,
            })

        # pessoas autorizadas
        for p in s.get("pessoas_autorizadas") or []:
            if not p.get("nome"):
                continue
            post("pessoas_autorizadas", {
                "aluno_id": aluno_id,
                "nome": p["nome"],
                "telefone": p.get("telefone"),
                "observacao": p.get("observacao"),
                "ativo": True,
            })

        # informações médicas (row vazio pra existir)
        post("informacoes_medicas", {"aluno_id": aluno_id})

        # autorizações
        post("autorizacoes_aluno", {"aluno_id": aluno_id})

    # matrículas — todas as do histórico
    for mat in s.get("matriculas") or []:
        serie_nome = mat["serie"]
        turma_nome = mat["turma"] or "A"
        ano = mat["ano_letivo"]

        serie_id = ensure_serie(serie_nome, series_cache, dry_run)
        turma_id = ensure_turma(serie_id, turma_nome, ano, turmas_cache, dry_run)

        if not dry_run:
            post("matriculas", {
                "escola_id": ESCOLA_ID,
                "aluno_id": aluno_id,
                "serie_id": serie_id,
                "turma_id": turma_id,
                "codigo": f"{matricula}-{ano}",
                "data_matricula": mat.get("data_matricula") or datetime.now().strftime("%Y-%m-%d"),
                "ano_letivo": ano,
                "idade_na_matricula": mat.get("idade_na_matricula"),
                "status": "ativa" if ano == datetime.now().year else "concluida",
                "observacoes": "Importado via script PDF",
            })

    return aluno_id

# ── main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Parse only, no DB writes")
    args = parser.parse_args()
    dry_run = args.dry_run

    if dry_run:
        print("=== DRY RUN — nenhuma escrita no banco ===\n")

    try:
        import pdfplumber
    except ImportError:
        print("Instale pdfplumber: pip install pdfplumber")
        sys.exit(1)

    existing = load_existing_matriculas()
    series_cache = load_series()
    turmas_cache = load_turmas()

    print(f"Alunos já no banco: {len(existing)}")
    print(f"Séries no banco: {list(series_cache.keys())}")

    total = 0
    skipped = 0
    errors = 0

    for pdf_path in PDF_FILES:
        if not pdf_path.exists():
            print(f"[AVISO] Arquivo não encontrado: {pdf_path}")
            continue

        print(f"\n=== {pdf_path.name} ===")
        pages = extract_pages(pdf_path)
        print(f"  {len(pages)} páginas")

        for i, page_text in enumerate(pages):
            if "Ficha do Aluno" not in page_text:
                continue
            try:
                s = parse_page(page_text)
                mat = s.get("matricula_codigo")
                if not mat:
                    skipped += 1
                    continue
                if mat in existing:
                    print(f"  [SKIP] {mat} já existe")
                    skipped += 1
                    continue
                insert_student(s, series_cache, turmas_cache, dry_run)
                existing.add(mat)
                total += 1
            except Exception as e:
                print(f"  [ERRO] página {i+1}: {e}")
                errors += 1

    print(f"\n=== Resultado ===")
    print(f"Importados: {total}")
    print(f"Pulados:    {skipped}")
    print(f"Erros:      {errors}")

if __name__ == "__main__":
    main()
