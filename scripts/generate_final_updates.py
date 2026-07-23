import json
import uuid

# Re-use missing and clean_name/title_case from before
from fix_missing_names import missing, clean_name, title_case

# Load DB cost centers mapping
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

sql_lines = []

# 1. Update Existing DB names and roles to Title Case
with open(r'C:\Users\ACPO Empreendimentos\.gemini\antigravity\brain\cdabee16-7d60-4be9-9d46-c848215f92a7\.system_generated\steps\772\output.txt', 'r', encoding='utf-8') as f:
    text = f.read()

start = text.find('[')
end = text.rfind(']')
if start != -1 and end != -1:
    json_str = text[start:end+1].replace('\\"', '"')
    db_emp = json.loads(json_str)
    
    update_count = 0
    for e in db_emp:
        old_name = e.get('name') or ''
        old_role = e.get('role') or ''
        
        new_name = title_case(old_name)
        new_role = title_case(old_role)
        
        # Only update if changed to avoid unnecessary updates
        if new_name != old_name or new_role != old_role:
            escaped_name = new_name.replace("'", "''")
            escaped_role = new_role.replace("'", "''")
            sql = f"UPDATE employees SET name = '{escaped_name}'"
            if old_role:
                sql += f", role = '{escaped_role}'"
            sql += f" WHERE id = '{e['id']}';"
            sql_lines.append(sql)
            update_count += 1
    print(f"Generated {update_count} UPDATE statements for title casing.")

# 2. Insert 45 missing employees
insert_count = 0
for mat, raw_name, cc_code in missing:
    clean = clean_name(raw_name)
    final_name = title_case(clean)
    
    code = cc_code
    if code == '867': code = '10867'
    if code == '963': code = '10963'
    if code == '893': code = '10893'
    
    cc_id = cc_map.get(code)
    if not cc_id:
        print(f"Warning: CC {cc_code} -> {code} not found for {final_name}")
        continue
    
    emp_id = str(uuid.uuid4())
    escaped_name = final_name.replace("'", "''")
    
    sql_lines.append(
        f"INSERT INTO employees (id, name, registration_number, cost_center_id, status, type, external_id, created_at, updated_at) "
        f"VALUES ('{emp_id}', '{escaped_name}', '{mat}', '{cc_id}', 'Ativo', 'Mensalista', 'new_{mat}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);"
    )
    insert_count += 1

with open('final_update_and_insert.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_lines))

print(f"Generated {insert_count} INSERT statements.")
print(f"Total SQL lines: {len(sql_lines)}")
