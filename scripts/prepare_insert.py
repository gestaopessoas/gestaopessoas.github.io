import json
import uuid
import re

# Load cost centers
db_cc = [
  {'id':'9de53b66-fd8f-4be1-a0c0-4d28e901de0e','name':'SOLANAS RESIDENCIAL','code':'893','dominio_code':'10893'},
  {'id':'3cf775db-a3fe-4a0a-8cd0-01d80105e086','name':'LIFE RIO GRANDE SPE LTDA','code':'988','dominio_code':'988'},
  {'id':'be2d73dc-55b6-495b-8801-3edd30d5525c','name':'JOY II','code':'780','dominio_code':'10780'},
  {'id':'1b852425-1e45-48ee-9339-e9803d4b2223','name':'CONSTRUTORA MATRIZ','code':'491','dominio_code':'491'},
  {'id':'75b17271-f725-4f54-8b5d-0b82463bfd3a','name':'SPE CONNECT DUQUE RESIDENCE LTDA','code':'867','dominio_code':'10867'},
  {'id':'746dbcfb-cae6-471b-86a7-83a4829605e8','name':'JOY RESIDENCE','code':'980','dominio_code':'10980'},
  {'id':'f424102d-6760-4307-98d5-edcb47eeeb10','name':'RESERVA HOME CLUB','code':'861','dominio_code':'10861'},
  {'id':'8ccb799f-56f5-40f4-9fc4-6f82e7fa124f','name':'SPE MOOV RESIDENCIAL LTDA','code':'963','dominio_code':'10963'},
  {'id':'6b7429f7-9012-412c-a7d3-ea61bc1c9074','name':'SPE MOOV RESIDENCIAL LTDA 2 ATO','code':'987','dominio_code':'987'},
  {'id':'a3b4cad9-63e0-49ad-b759-b490499722bc','name':'DIRECT SPE LTDA','code':'967','dominio_code':'967'},
  {'id':'510ac4b0-9949-46a1-89b1-7b0d98c0141e','name':'ASSISTENCIA TECNICA','code':'519','dominio_code':'519'},
  {'id':'80283154-7a9f-4022-ac88-5029a5f013b8','name':'ACPO COTIZA SPE','code':'879','dominio_code':'879'}
]
cc_map = {c['dominio_code']: c['id'] for c in db_cc}

# Load DB employees
with open(r'C:\Users\ACPO Empreendimentos\.gemini\antigravity\brain\cdabee16-7d60-4be9-9d46-c848215f92a7\.system_generated\steps\695\output.txt', 'r', encoding='utf-8') as f:
    text = f.read()

start = text.find('[')
end = text.rfind(']')
db_emp = []
if start != -1 and end != -1:
    json_str = text[start:end+1].replace('\\"', '"')
    db_emp = json.loads(json_str)

db_reg_map = {str(e['registration_number']): e for e in db_emp if e.get('registration_number')}

# Also map by name just in case? Or maybe first try reg_num
db_name_map = {e['name'].upper(): e for e in db_emp if e.get('name')}

# Load PDF employees
with open('all_pdf_employees.json', 'r', encoding='utf-8') as f:
    pdf_emp = json.load(f)

to_insert = []
to_reactivate = []
already_active = []

for emp in pdf_emp:
    matricula = str(emp['matricula'])
    nome = emp['nome'].upper()
    cc_code = emp['cc_code']
    admissao = emp['admissao']
    
    # Check if exists
    db_record = None
    if matricula in db_reg_map:
        db_record = db_reg_map[matricula]
    elif nome in db_name_map:
        db_record = db_name_map[nome]
        
    if db_record:
        if db_record.get('status', '').lower() != 'ativo':
            to_reactivate.append((emp, db_record))
        else:
            already_active.append((emp, db_record))
    else:
        to_insert.append(emp)

# Generate SQL
sql_lines = []
for emp in to_insert:
    emp_id = str(uuid.uuid4())
    code = emp['cc_code']
    if code == '867': code = '10867'
    if code == '963': code = '10963'
    if code == '893': code = '10893'
    cc_id = cc_map.get(code)
    if not cc_id:
        print(f"Warning: CC {emp['cc_code']} not found for {emp['nome']}")
        continue
    # Convert admissao DD/MM/YYYY to YYYY-MM-DD
    d, m, y = emp['admissao'].split('/')
    iso_date = f"{y}-{m}-{d}"
    sql_lines.append(
        f"INSERT INTO employees (id, name, registration_number, cost_center_id, status, type, external_id, created_at, updated_at) "
        f"VALUES ('{emp_id}', '{emp['nome']}', '{emp['matricula']}', '{cc_id}', 'ativo', 'mensalista', 'new_{emp['matricula']}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);"
    )

for emp, db_rec in to_reactivate:
    code = emp['cc_code']
    if code == '867': code = '10867'
    if code == '963': code = '10963'
    if code == '893': code = '10893'
    cc_id = cc_map.get(code)
    sql_lines.append(
        f"UPDATE employees SET status = 'ativo', cost_center_id = '{cc_id}' WHERE id = '{db_rec['id']}';"
    )

with open('insert_employees.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_lines))

# Generate Plan
plan = ["# Plano de Inserção e Reativação de Colaboradores\n\n"]
plan.append("Conforme solicitado, preparei a carga de dados de todos os funcionários faltantes dos PDFs.\n\n")

plan.append("## Novos Cadastros (INSERTS)\n")
plan.append(f"Serão cadastrados **{len(to_insert)}** novos colaboradores:\n")
for emp in to_insert:
    plan.append(f"- **{emp['nome']}** (Matrícula {emp['matricula']}, CC: {emp['cc_code']})")
plan.append("\n")

plan.append("## Reativações (UPDATES)\n")
plan.append(f"Foram encontrados **{len(to_reactivate)}** ex-colaboradores que estão no banco como inativos, e serão reativados:\n")
for emp, db_rec in to_reactivate:
    plan.append(f"- **{emp['nome']}** (Matrícula {emp['matricula']}, Atualizar para CC: {emp['cc_code']})")
plan.append("\n")

plan.append("## Já Ativos\n")
plan.append(f"**{len(already_active)}** colaboradores já estão ativos no sistema.\n\n")

plan.append("> [!IMPORTANT]\n")
plan.append("> Analise a lista de nomes acima. Se estiver tudo OK, basta aprovar para eu executar o SQL de inserção/reativação no banco de dados!")

plan_path = r'C:\Users\ACPO Empreendimentos\.gemini\antigravity\brain\cdabee16-7d60-4be9-9d46-c848215f92a7\implementation_plan.md'
with open(plan_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(plan))
    
print(f"Generated {len(to_insert)} inserts, {len(to_reactivate)} updates.")
