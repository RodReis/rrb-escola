"""Aplica cobrancas 2026 pagas pros 2 alunos com nome divergente do xlsx."""
import json, sys, urllib.request

SUPABASE_URL = "http://127.0.0.1:55421"
SERVICE_KEY = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"
ESCOLA_ID = "00000000-0000-0000-0000-000000000001"
PLANO_ID = "30000000-0000-0000-0000-000000000001"
ANO = 2026

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

def api(method, path, body=None, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{path}{params}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    with urllib.request.urlopen(req) as r:
        raw = r.read()
        return json.loads(raw) if raw else []

ALVOS = [
    ("DAVI DE SOUZA OLIVEIRA", 690),
    ("ANA LAURA ROSA DO COUTO", 955),
]

for nome_upper, valor in ALVOS:
    alunos = api("GET", "alunos", params=f"?escola_id=eq.{ESCOLA_ID}&select=id,nome")
    aluno = next((a for a in alunos if a["nome"].upper() == nome_upper), None)
    if not aluno:
        print(f"[SKIP] {nome_upper} nao encontrado"); continue
    mats = api("GET", "matriculas", params=f"?aluno_id=eq.{aluno['id']}&ano_letivo=eq.{ANO}&select=id")
    if not mats:
        print(f"[SKIP] {nome_upper} sem matricula 2026"); continue
    mid = mats[0]["id"]
    api("DELETE", "cobrancas", params=f"?matricula_id=eq.{mid}&competencia=like.{ANO}-*")
    rows = [{
        "escola_id": ESCOLA_ID,
        "aluno_id": aluno["id"],
        "matricula_id": mid,
        "plano_id": PLANO_ID,
        "descricao": f"Mensalidade {m:02d}/{ANO}",
        "competencia": f"{ANO}-{m:02d}",
        "numero_parcela": m,
        "valor_original": valor,
        "valor_desconto": 0,
        "valor_acrescimo": 0,
        "data_vencimento": f"{ANO}-{m:02d}-10",
        "status": "paga",
    } for m in range(1,13)]
    cobs = api("POST", "cobrancas", body=rows)
    pags = [{
        "escola_id": ESCOLA_ID,
        "cobranca_id": c["id"],
        "aluno_id": aluno["id"],
        "matricula_id": mid,
        "valor_pago": valor,
        "data_pagamento": c["data_vencimento"],
        "forma_pagamento": "transferencia",
        "observacao": "Financeiro terceirizado",
    } for c in cobs]
    api("POST", "pagamentos", body=pags)
    print(f"[OK] {nome_upper}: 12 cobrancas R$ {valor}")
