"""Cria aluna Heloisa Cristina Parreira (INFANTIL4 MATUTINO) + matricula 2026 + 12 cobrancas pagas R$ 690."""
import json, urllib.request

SUPABASE_URL = "http://127.0.0.1:55421"
SERVICE_KEY = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"
ESCOLA_ID = "00000000-0000-0000-0000-000000000001"
PLANO_ID = "30000000-0000-0000-0000-000000000001"
ANO = 2026
VALOR = 690

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

# 1. cria aluno
existing = api("GET", "alunos", params=f"?escola_id=eq.{ESCOLA_ID}&nome=eq.HELOISA%20CRISTINA%20PARREIRA&select=id")
if existing:
    aluno_id = existing[0]["id"]
    print(f"[EXIST] aluno {aluno_id}")
else:
    created = api("POST", "alunos", body=[{
        "escola_id": ESCOLA_ID,
        "matricula_codigo": "HELOISA-PARREIRA-2026",
        "nome": "HELOISA CRISTINA PARREIRA",
        "data_nascimento": "2021-01-01",
        "sexo": "F",
    }])
    aluno_id = created[0]["id"]
    print(f"[CREATED] aluno {aluno_id}")

# 2. busca serie INFANTIL4
serie = api("GET", "series", params=f"?escola_id=eq.{ESCOLA_ID}&nome=eq.INFANTIL4&select=id")[0]
serie_id = serie["id"]

# 3. busca/cria turma MATUTINO 2026
turmas = api("GET", "turmas", params=f"?escola_id=eq.{ESCOLA_ID}&serie_id=eq.{serie_id}&ano_letivo=eq.{ANO}&turno=eq.matutino&select=id")
if turmas:
    turma_id = turmas[0]["id"]
else:
    t = api("POST", "turmas", body=[{"escola_id":ESCOLA_ID,"serie_id":serie_id,"nome":"MATUTINO","ano_letivo":ANO,"turno":"matutino","ativo":True}])
    turma_id = t[0]["id"]

# 4. matricula
mats = api("GET", "matriculas", params=f"?aluno_id=eq.{aluno_id}&ano_letivo=eq.{ANO}&select=id")
if mats:
    mid = mats[0]["id"]
    api("PATCH", "matriculas", body={"serie_id":serie_id,"turma_id":turma_id,"status":"ativa"}, params=f"?id=eq.{mid}")
else:
    m = api("POST", "matriculas", body=[{
        "escola_id": ESCOLA_ID, "aluno_id": aluno_id, "serie_id": serie_id, "turma_id": turma_id,
        "plano_id": PLANO_ID, "codigo": f"M{ANO}-{aluno_id[:8]}",
        "data_matricula": f"{ANO}-01-01", "ano_letivo": ANO, "status": "ativa",
    }])
    mid = m[0]["id"]

# 5. cobrancas + pagamentos
api("DELETE", "cobrancas", params=f"?matricula_id=eq.{mid}&competencia=like.{ANO}-*")
rows = [{
    "escola_id": ESCOLA_ID, "aluno_id": aluno_id, "matricula_id": mid, "plano_id": PLANO_ID,
    "descricao": f"Mensalidade {m:02d}/{ANO}", "competencia": f"{ANO}-{m:02d}", "numero_parcela": m,
    "valor_original": VALOR, "valor_desconto": 0, "valor_acrescimo": 0,
    "data_vencimento": f"{ANO}-{m:02d}-10", "status": "paga",
} for m in range(1,13)]
cobs = api("POST", "cobrancas", body=rows)
pags = [{
    "escola_id": ESCOLA_ID, "cobranca_id": c["id"], "aluno_id": aluno_id, "matricula_id": mid,
    "valor_pago": VALOR, "data_pagamento": c["data_vencimento"],
    "forma_pagamento": "transferencia", "observacao": "Financeiro terceirizado",
} for c in cobs]
api("POST", "pagamentos", body=pags)
print(f"[OK] Heloisa: 12 cobrancas R$ {VALOR}, matricula {mid}")
