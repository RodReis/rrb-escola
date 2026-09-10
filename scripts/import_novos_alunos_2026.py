"""
Importa alunos novos dos PDFs/JSONs de public/ para o Supabase de PRODUCAO.

Fonte de verdade: o PDF (texto limpo, tem matricula_codigo).
O JSON e usado apenas como referencia cruzada.

Dedupe: cpf, depois matricula_codigo, depois nome+data_nascimento.
Fotos: extrai a foto da ficha (img retrato), sobe no bucket alunos-fotos
e atualiza alunos.foto_url — inclusive para alunos ja existentes sem foto.

Uso:
  python scripts/import_novos_alunos_2026.py --dry-run
  python scripts/import_novos_alunos_2026.py --apply
  python scripts/import_novos_alunos_2026.py --apply --fotos-only
"""

import argparse
import json
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

import pymupdf

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).parent.parent
PAIRS = [
    (ROOT / "public" / "11714876000116.pdf", ROOT / "public" / "11714876000116.json"),
    (ROOT / "public" / "35027047000123.pdf", ROOT / "public" / "35027047000123.json"),
]
BUCKET = "alunos-fotos"
ANO_CORRENTE = 2026

# ── env / http ────────────────────────────────────────────────────────────────

def load_env():
    env = {}
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env

ENV = load_env()
URL = ENV["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
KEY = ENV["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}

def api(method, path, body=None, prefer="return=representation"):
    data = json.dumps(body).encode() if body is not None else None
    headers = {**H, "Content-Type": "application/json", "Prefer": prefer}
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else []
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code} {method} {path}: {e.read().decode()[:400]}") from e

def get_all(path):
    out, off = [], 0
    while True:
        headers = {**H, "Range": f"{off}-{off + 999}"}
        req = urllib.request.Request(f"{URL}/rest/v1/{path}", headers=headers)
        with urllib.request.urlopen(req) as r:
            batch = json.loads(r.read())
        out += batch
        if len(batch) < 1000:
            return out
        off += 1000

def upload_foto(path, data, content_type):
    req = urllib.request.Request(
        f"{URL}/storage/v1/object/{BUCKET}/{path}",
        data=data,
        headers={**H, "Content-Type": content_type, "x-upsert": "true"},
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        r.read()
    return f"{URL}/storage/v1/object/public/{BUCKET}/{path}"

# ── normalizacao ──────────────────────────────────────────────────────────────

def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s).strip().upper()

def digits(s):
    return re.sub(r"\D", "", s or "")

def slugify(text):
    s = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "foto"

def parse_date(s):
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", (s or "").strip())
    return f"{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}" if m else None

# ── serie/turma ───────────────────────────────────────────────────────────────

# Series em producao usam nome normalizado sem espaco: INFANTIL4, MATERNAL, 5º ANO.
_ROMANO = {"I": "1", "II": "2", "III": "3", "IV": "4", "V": "5"}

def serie_key(serie_raw):
    """Converte o rotulo do PDF para o nome canonico usado em producao.

    Producao usa: MATERNAL, INFANTIL1..5, '5º ANO', '1ª SÉRIE'.
    norm() derruba acentos e transforma 'º' em 'O', entao a ordinal
    tem que ser reconstruida a partir do numero, nunca do texto cru.
    """
    s = norm(serie_raw)
    s = re.sub(r"[ºª°]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()

    m = re.match(r"^INFANTIL\s*([IVX]+|\d+)\b", s)
    if m:
        return "INFANTIL" + _ROMANO.get(m.group(1), m.group(1))
    if s.startswith("MATERNAL"):
        return "MATERNAL"
    m = re.match(r"^(\d+)\s*O?\s*ANO\b", s)
    if m:
        return f"{m.group(1)}º ANO"
    m = re.match(r"^(\d+)\s*A?\s*SERIE\b", s)
    if m:
        return f"{m.group(1)}ª SÉRIE"
    return s

def split_serie_turma(serie_txt, turma_txt):
    """No PDF serie e turma vem em linhas separadas; turma pode vir entre aspas."""
    turma = (turma_txt or "").strip()
    q = re.search(r'"([^"]+)"', turma)
    if q:
        inner = q.group(1)
        m = re.search(r"[-–]\s*(\S+)\s*$", inner)
        turma = m.group(1) if m else inner.split()[-1]
    turma = turma.strip().upper() or "A"
    return serie_key(serie_txt), turma

# ── parsing da ficha (PDF) ────────────────────────────────────────────────────

PARENTESCOS = {"MAE", "PAI", "AVO", "AVOH", "TIO", "TIA", "IRMAO", "IRMA", "PADRASTO",
               "MADRASTA", "RESPONSAVEL", "OUTRO", "AVOS", "PRIMO", "PRIMA", "TUTOR"}

def parse_page(text):
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    # Campos vazios somem do texto extraido, entao a linha anterior a um rotulo
    # pode ser o rotulo do campo vizinho (RG vazio -> pega 'CPF'). Descarta.
    ROTULOS = {
        "Matrícula", "Nome", "Sexo", "Dt. Nascimento", "Naturalidade", "Celular",
        "Endereço", "Cidade", "CEP", "CPF", "RG", "Certidão Nasc.", "E-Mail",
        "Cód. INEP", "Etnia", "Foto", "Disciplina Eletiva", "Dados do Aluno",
        "Informações Adicionais", "Telefones de Contato", "Responsáveis do Aluno",
    }

    def after(label, pattern=None):
        """No layout do PDF o VALOR vem ANTES do rotulo."""
        for i, l in enumerate(lines):
            if l == label and i > 0:
                v = lines[i - 1]
                if v in ROTULOS:
                    return None
                if pattern and not re.match(pattern, v):
                    return None
                return v
        return None

    mat = after("Matrícula", r"^\d{2,6}$")
    if not mat:
        return None

    idx_mat = lines.index("Matrícula")
    nome = None
    for i in range(idx_mat, len(lines)):
        if lines[i] == "Nome" and i > 0:
            nome = lines[i - 1]
            break
    if not nome:
        return None

    s = {
        "matricula_codigo": mat,
        "nome": nome,
        "sexo": after("Sexo", r"^(Masculino|Feminino)$"),
        "data_nascimento": parse_date(after("Dt. Nascimento")),
        "naturalidade": after("Naturalidade"),
        "celular": after("Celular", r"^[\(\d]"),
        "endereco": after("Endereço"),
        "cidade": None,
        "uf": None,
        "cep": after("CEP", r"^\d{5}-?\d{0,3}$"),
        "cpf": after("CPF", r"^\d{3}\.\d{3}\.\d{3}-\d{2}$"),
        "rg": after("RG", r"^[\dA-Za-z]"),
        "certidao": after("Certidão Nasc."),
        "email": after("E-Mail", r".+@.+"),
        "etnia": after("Etnia", r"^[A-Za-zÀ-ÿ]+$"),
        "responsaveis": [],
        "matriculas": [],
        "pessoas_autorizadas": [],
    }

    cidade = after("Cidade")
    if cidade:
        if "-" in cidade:
            p = cidade.rsplit("-", 1)
            s["cidade"], s["uf"] = p[0].strip(), p[1].strip()
        else:
            s["cidade"] = cidade

    # responsaveis: bloco entre "Responsáveis do Aluno" e "Relação de Matrículas"
    try:
        a = lines.index("Responsáveis do Aluno")
        b = lines.index("Relação de Matrículas")
        block = lines[a + 1:b]
    except ValueError:
        block = []
    # descarta cabecalho
    for hdr in ["Nome", "CPF", "Telefone", "Celular", "Parentesco", "E-Mail"]:
        if block and block[0] == hdr:
            block = block[1:]
        elif hdr in block[:6]:
            block = [x for j, x in enumerate(block) if not (j < 6 and x == hdr)]
    cur = None
    for l in block:
        if re.match(r"^\d{3}\.\d{3}\.\d{3}-\d{2}$", l):
            if cur:
                cur["cpf"] = l
        elif re.match(r"^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$", l):
            if cur:
                cur["celular"] = l
        elif "@" in l:
            if cur:
                cur["email"] = l
        elif norm(l) in PARENTESCOS:
            if cur:
                cur["parentesco"] = l
        elif cur is not None and not any(cur[k] for k in ("cpf", "celular", "parentesco", "email")):
            # Nome longo quebra em duas linhas no PDF. Enquanto o responsavel atual
            # nao recebeu nenhum outro campo, a linha seguinte e continuacao do nome
            # — nao um novo responsavel (senao vira registro fantasma tipo 'Borges').
            cur["nome"] = f"{cur['nome']} {l}".strip()
        else:
            cur = {"nome": l, "cpf": None, "celular": None, "parentesco": None, "email": None}
            s["responsaveis"].append(cur)

    # matriculas: entre "Relação de Matrículas" e "Atributos Adicionais"
    try:
        a = lines.index("Relação de Matrículas")
        b = next(i for i, l in enumerate(lines) if l.startswith("Atributos Adicionais"))
        block = lines[a + 1:b]
    except (ValueError, StopIteration):
        block = []
    block = [l for l in block if l not in ("Série", "Turma", "Data Matrícula", "Idade na Matrícula")]
    # padrao: serie, turma, data, idade
    i = 0
    while i + 3 < len(block) + 1:
        if i + 3 >= len(block) + 1:
            break
        chunk = block[i:i + 4]
        if len(chunk) < 4:
            break
        serie_txt, turma_txt, data_txt, idade_txt = chunk
        if not re.match(r"^\d{2}/\d{2}/\d{4}$", data_txt):
            i += 1
            continue
        serie, turma = split_serie_turma(serie_txt, turma_txt)
        ano = int(data_txt.split("/")[2])
        s["matriculas"].append({
            "serie": serie,
            "turma": turma,
            "data_matricula": parse_date(data_txt),
            "idade_na_matricula": int(idade_txt) if idade_txt.isdigit() else None,
            "ano_letivo": ano,
        })
        i += 4

    return s

def extract_foto(doc, page):
    """Retorna (bytes, ext) da foto do aluno — imagem retrato, ignora o logo."""
    best = None
    for x in page.get_images():
        d = doc.extract_image(x[0])
        if len(d["image"]) < 3000 or d["height"] < d["width"]:
            continue
        if best is None or len(d["image"]) > len(best["image"]):
            best = d
    return (best["image"], best.get("ext", "jpeg")) if best else (None, None)

# ── main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="grava no banco (senao, dry-run)")
    ap.add_argument("--fotos-only", action="store_true", help="so atualiza fotos, nao insere alunos")
    args = ap.parse_args()
    dry = not args.apply

    print("=== DRY RUN — nada sera gravado ===\n" if dry else "=== APLICANDO EM PRODUCAO ===\n")

    escola_id = get_all("escolas?select=id&limit=1")[0]["id"]
    alunos = get_all("alunos?select=id,nome,cpf,data_nascimento,matricula_codigo,foto_url")
    # indexa pela mesma funcao canonica usada no parse, senao '5º ANO' do banco
    # nunca casa com o '5º ANO' derivado do PDF e o script duplica series.
    series = {serie_key(r["nome"]): r["id"] for r in get_all(f"series?select=id,nome&escola_id=eq.{escola_id}")}
    turmas = {(r["serie_id"], norm(r["nome"]), int(r["ano_letivo"])): r["id"]
              for r in get_all(f"turmas?select=id,nome,ano_letivo,serie_id&escola_id=eq.{escola_id}")}

    by_cpf = {digits(a["cpf"]): a for a in alunos if len(digits(a["cpf"])) == 11}
    by_mat = {str(a["matricula_codigo"]): a for a in alunos if a.get("matricula_codigo")}
    by_nb = {(norm(a["nome"]), a["data_nascimento"]): a for a in alunos}

    print(f"escola={escola_id}  alunos={len(alunos)}  series={len(series)}  turmas={len(turmas)}")

    novos, fotos_ok, fotos_skip, erros = 0, 0, 0, 0
    vistos = set()

    for pdf_path, json_path in PAIRS:
        doc = pymupdf.open(str(pdf_path))
        print(f"\n--- {pdf_path.name} ({len(doc)} paginas) ---")

        for pno, page in enumerate(doc):
            try:
                s = parse_page(page.get_text())
            except Exception as e:
                print(f"  [ERRO parse] p{pno+1}: {e}")
                erros += 1
                continue
            if not s:
                continue  # pagina de transbordo

            cpf_d = digits(s["cpf"])
            key = cpf_d if len(cpf_d) == 11 else f"{norm(s['nome'])}|{s['data_nascimento']}"
            if key in vistos:
                continue
            vistos.add(key)

            existing = (by_cpf.get(cpf_d) if len(cpf_d) == 11 else None) \
                or by_mat.get(s["matricula_codigo"]) \
                or by_nb.get((norm(s["nome"]), s["data_nascimento"]))

            aluno_id = existing["id"] if existing else None

            # ── insere aluno novo ──
            if not existing and not args.fotos_only:
                novos += 1
                print(f"  [NOVO] {s['matricula_codigo']} {s['nome']} ({s['data_nascimento']})")
                if dry:
                    for m in s["matriculas"]:
                        flag = "" if m["serie"] in series else "  << SERIE NOVA"
                        print(f"          {m['serie']} / {m['turma']} / {m['ano_letivo']}{flag}")
                else:
                    endereco = s["endereco"] or ""
                    parts = endereco.split(",", 1)
                    row = api("POST", "alunos", {
                        "escola_id": escola_id,
                        "matricula_codigo": s["matricula_codigo"],
                        "nome": s["nome"],
                        "sexo": s["sexo"],
                        "data_nascimento": s["data_nascimento"],
                        "naturalidade": s["naturalidade"],
                        "celular": s["celular"],
                        "cpf": s["cpf"],
                        "rg": s["rg"],
                        "certidao_nascimento": s["certidao"],
                        "email": s["email"],
                        "etnia": s["etnia"],
                        "ativo": True,
                    })[0]
                    aluno_id = row["id"]

                    api("POST", "enderecos_aluno", {
                        "aluno_id": aluno_id,
                        "logradouro": (parts[0].strip() or "Não informado"),
                        "numero": parts[1].strip() if len(parts) > 1 else None,
                        "cidade": s["cidade"], "uf": s["uf"], "cep": s["cep"],
                        "principal": True,
                    }, prefer="return=minimal")

                    for r in s["responsaveis"]:
                        if not r.get("nome"):
                            continue
                        api("POST", "responsaveis_aluno", {
                            "aluno_id": aluno_id, "nome": r["nome"], "cpf": r.get("cpf"),
                            "celular": r.get("celular"), "parentesco": r.get("parentesco"),
                            "email": r.get("email"),
                            "responsavel_financeiro": True, "responsavel_pedagogico": True,
                        }, prefer="return=minimal")

                    api("POST", "informacoes_medicas", {"aluno_id": aluno_id}, prefer="return=minimal")
                    api("POST", "autorizacoes_aluno", {"aluno_id": aluno_id}, prefer="return=minimal")

                    for m in s["matriculas"]:
                        sid = series.get(m["serie"])
                        if not sid:
                            # serie so referenciada por matricula historica nasce inativa,
                            # igual INFANTIL2 em producao — nao deve virar opcao de matricula nova.
                            ativa = m["ano_letivo"] >= ANO_CORRENTE
                            sid = api("POST", "series", {
                                "escola_id": escola_id, "nome": m["serie"], "ativo": ativa})[0]["id"]
                            series[m["serie"]] = sid
                            print(f"          [SERIE CRIADA] {m['serie']}")
                        tkey = (sid, m["turma"], m["ano_letivo"])
                        tid = turmas.get(tkey)
                        if not tid:
                            tid = api("POST", "turmas", {
                                "escola_id": escola_id, "serie_id": sid, "nome": m["turma"],
                                "ano_letivo": m["ano_letivo"],
                                "ativo": m["ano_letivo"] >= ANO_CORRENTE})[0]["id"]
                            turmas[tkey] = tid
                            print(f"          [TURMA CRIADA] {m['serie']}/{m['turma']}/{m['ano_letivo']}")
                        api("POST", "matriculas", {
                            "escola_id": escola_id, "aluno_id": aluno_id,
                            "serie_id": sid, "turma_id": tid,
                            "codigo": f"{s['matricula_codigo']}-{m['ano_letivo']}",
                            "data_matricula": m["data_matricula"],
                            "ano_letivo": m["ano_letivo"],
                            "idade_na_matricula": m["idade_na_matricula"],
                            "status": "ativa" if m["ano_letivo"] >= ANO_CORRENTE else "concluida",
                            "observacoes": "Importado do PDF (set/2026)",
                        }, prefer="return=minimal")

            # ── foto ──
            ja_tem = bool(existing and existing.get("foto_url"))
            if ja_tem:
                fotos_skip += 1
                continue
            img, ext = extract_foto(doc, page)
            if not img:
                continue
            if dry:
                if aluno_id or not existing:
                    fotos_ok += 1
                continue
            if not aluno_id:
                continue
            try:
                path = f"{aluno_id}/{slugify(s['nome'])}.{ext}"
                url = upload_foto(path, img, f"image/{ext}")
                api("PATCH", f"alunos?id=eq.{aluno_id}", {"foto_url": url}, prefer="return=minimal")
                fotos_ok += 1
            except Exception as e:
                print(f"  [ERRO foto] {s['nome']}: {e}")
                erros += 1

        doc.close()

    print("\n=== RESUMO ===")
    print(f"  Alunos novos:      {novos}")
    print(f"  Fotos atualizadas: {fotos_ok}")
    print(f"  Fotos ja tinham:   {fotos_skip}")
    print(f"  Erros:             {erros}")
    if dry:
        print("\n  (dry-run — rode com --apply para gravar)")

if __name__ == "__main__":
    main()
