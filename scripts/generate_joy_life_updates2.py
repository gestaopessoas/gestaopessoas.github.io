import pdfplumber, re, json, sys

def parse_new_format(filepath):
    res = []
    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            for line in page.extract_text().split('\n'):
                m = re.match(r'^(\d+)\s+(.+?)\s+(\d{3,5})\s+\d{1,3},\d{2}\s+\d{2}/\d{2}/\d{4}', line.strip())
                if m:
                    res.append((m.group(1), m.group(3)))
    return res

joy = parse_new_format(r'C:\Users\ACPO Empreendimentos\Desktop\Nova pasta (2)\21072026 Empregados JOY.pdf')
life = parse_new_format(r'C:\Users\ACPO Empreendimentos\Desktop\Nova pasta (2)\21072026 Empregados LIFE RIO GRANDE.pdf')
all_pdf = joy + life

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

with open(r'C:\Users\ACPO Empreendimentos\.gemini\antigravity\brain\cdabee16-7d60-4be9-9d46-c848215f92a7\.system_generated\steps\621\output.txt', 'r', encoding='utf-8') as f:
    text = f.read()

# Extract json array from output.txt
start = text.find('[')
end = text.rfind(']')
if start != -1 and end != -1:
    json_str = text[start:end+1]
    # Replace escaped quotes if necessary
    if '\\"' in json_str:
        json_str = json_str.replace('\\"', '"')
    employees = json.loads(json_str)
else:
    print('Failed to find JSON brackets')
    sys.exit(1)

emp_map = {}
for e in employees:
    if e['registration_number']:
        emp_map[str(e['registration_number'])] = e

sql_lines = []
sql_lines.append("UPDATE cost_centers SET dominio_code = '10893' WHERE id = '9de53b66-fd8f-4be1-a0c0-4d28e901de0e';")
sql_lines.append("UPDATE cost_centers SET dominio_code = '988' WHERE id = '3cf775db-a3fe-4a0a-8cd0-01d80105e086';")
sql_lines.append("UPDATE cost_centers SET dominio_code = '10780' WHERE id = 'be2d73dc-55b6-495b-8801-3edd30d5525c';")
sql_lines.append("UPDATE cost_centers SET dominio_code = '10980' WHERE id = '746dbcfb-cae6-471b-86a7-83a4829605e8';")

missing = []
for matricula, cc_code in all_pdf:
    if str(matricula) not in emp_map:
        missing.append((matricula, cc_code))
    else:
        emp_id = emp_map[str(matricula)]['id']
        cc_id = cc_map.get(str(cc_code))
        if not cc_id:
            print(f'WARNING: Unmapped CC {cc_code} for matricula {matricula}')
        else:
            if emp_map[str(matricula)]['cost_center_id'] != cc_id:
                sql_lines.append(f"UPDATE employees SET cost_center_id = '{cc_id}' WHERE id = '{emp_id}';")

with open('update_joy_life_final.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_lines))

print(f'Generated {len(sql_lines)} SQL statements.')
if missing:
    print(f'Missing {len(missing)} employees in DB:', missing)
