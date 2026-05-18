"""
Extrai fotos de alunos dos PDFs Resultado.pdf e Resultado1.pdf,
faz upload para Supabase Storage bucket 'alunos-fotos',
e atualiza alunos.foto_url pelo matricula_codigo.

Uso:
  python scripts/recover_photos.py

Requer:
  pip install pymupdf requests python-dotenv
"""

import os
import re
import sys
import unicodedata
import fitz  # PyMuPDF
import requests
from pathlib import Path
from dotenv import load_dotenv

# ── Config ────────────────────────────────────────────────────────────────────
load_dotenv(".env.local")

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
BUCKET = "alunos-fotos"
PDFS = [
    "docs/pdfs/Resultado.pdf",
    "docs/pdfs/Resultado1.pdf",
]

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
}

# ── Supabase helpers ──────────────────────────────────────────────────────────

def sb_get(path: str, params: dict = None):
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{path}", headers={**HEADERS, "Accept": "application/json"}, params=params)
    r.raise_for_status()
    return r.json()

def sb_patch(table: str, filters: dict, body: dict):
    params = "&".join(f"{k}=eq.{v}" for k, v in filters.items())
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/{table}?{params}",
        headers={**HEADERS, "Content-Type": "application/json", "Prefer": "return=minimal"},
        json=body,
    )
    r.raise_for_status()

def sb_upload(bucket: str, path: str, data: bytes, content_type: str):
    r = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}",
        headers={**HEADERS, "Content-Type": content_type, "x-upsert": "true"},
        data=data,
    )
    r.raise_for_status()
    return r.json()

def sb_public_url(bucket: str, path: str) -> str:
    return f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}"

# ── PDF helpers ───────────────────────────────────────────────────────────────

def extract_matricula_nome(blocks):
    """Bloco padrão: '1361\nMatrícula\n'  e  'ALICE ...\nNome\n'"""
    mat = None
    nome = None
    for b in blocks:
        lines = [l.strip() for l in b[4].split("\n") if l.strip()]
        for i, line in enumerate(lines):
            if line.endswith("cula") and i > 0:          # Matrícula
                candidate = lines[i - 1]
                if re.match(r"^\d{3,6}$", candidate):
                    mat = candidate
            if line == "Nome" and i > 0 and mat is not None and nome is None:
                nome = lines[i - 1]
    return mat, nome

def slugify(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text)
    ascii_str = nfkd.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", ascii_str.lower()).strip("-")

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # Carrega todos os alunos para lookup rápido
    alunos = sb_get("alunos", {"select": "id,nome,matricula_codigo,foto_url"})
    alunos_by_code = {str(a["matricula_codigo"]): a for a in alunos}
    print(f"Alunos no banco: {len(alunos_by_code)}")

    updated = 0
    skipped_no_match = 0
    skipped_no_img = 0
    skipped_already = 0
    errors = 0

    for pdf_path in PDFS:
        if not Path(pdf_path).exists():
            print(f"[WARN] PDF não encontrado: {pdf_path}")
            continue

        print(f"\nProcessando {pdf_path}…")
        doc = fitz.open(pdf_path)

        for page_num, page in enumerate(doc):
            imgs = page.get_images()
            if not imgs:
                skipped_no_img += 1
                continue

            blocks = page.get_text("blocks")
            mat_code, nome = extract_matricula_nome(blocks)

            if not mat_code:
                print(f"  [WARN] p{page_num}: matrícula não encontrada")
                skipped_no_match += 1
                continue

            aluno = alunos_by_code.get(mat_code)
            if not aluno:
                print(f"  [WARN] p{page_num}: matrícula {mat_code} não encontrada no banco")
                skipped_no_match += 1
                continue

            if aluno.get("foto_url"):
                skipped_already += 1
                continue

            xref = imgs[0][0]
            try:
                img_data = doc.extract_image(xref)
            except Exception as e:
                print(f"  [ERROR] p{page_num} extração: {e}")
                errors += 1
                continue

            image_bytes = img_data["image"]
            ext = img_data.get("ext", "jpeg")

            if len(image_bytes) < 1000:
                skipped_no_img += 1
                continue

            aluno_id = aluno["id"]
            slug = slugify(aluno.get("nome") or mat_code)
            storage_path = f"{aluno_id}/{slug}.{ext}"

            try:
                sb_upload(BUCKET, storage_path, image_bytes, f"image/{ext}")
            except Exception as e:
                print(f"  [ERROR] upload {storage_path}: {e}")
                errors += 1
                continue

            public_url = sb_public_url(BUCKET, storage_path)

            try:
                sb_patch("alunos", {"id": aluno_id}, {"foto_url": public_url})
                print(f"  OK {mat_code} {aluno.get('nome', '')} -> {storage_path}")
                updated += 1
                alunos_by_code[mat_code]["foto_url"] = public_url
            except Exception as e:
                print(f"  [ERROR] update aluno {aluno_id}: {e}")
                errors += 1

        doc.close()

    print(f"\n--- Resumo ---")
    print(f"  Atualizados:          {updated}")
    print(f"  Já tinham foto:       {skipped_already}")
    print(f"  Sem match no banco:   {skipped_no_match}")
    print(f"  Sem imagem válida:    {skipped_no_img}")
    print(f"  Erros:                {errors}")


if __name__ == "__main__":
    main()
