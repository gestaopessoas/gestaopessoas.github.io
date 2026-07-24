import pandas as pd
import json
import re
import unicodedata
import subprocess
import math
from datetime import datetime

def normalize(name):
    if not isinstance(name, str): return ""
    n = unicodedata.normalize('NFKD', str(name)).encode('ASCII', 'ignore').decode('utf-8')
    n = n.upper().strip()
    return re.sub(r'\s+', ' ', n)

print("Reading database...")
opts = {'cwd': 'C:\\Users\\ACPO Empreendimentos\\Documents\\Github\\gestaopessoas.github.io'}
cmd = 'npx supabase db query --linked "SELECT id, name, admission_date, registration_number, cost_center_id, company_id, status FROM employees WHERE status IN (\'Ativo\', \'Férias\', \'Afastado\')" --output json'
result = subprocess.run(cmd, capture_output=True, text=True, shell=True, encoding="utf-8", errors="replace", **opts)

out = result.stdout
start = out.find('{')
parsed = json.loads(out[start:])
db_emps = parsed.get('rows', parsed)

db_emps_dict = {normalize(e['name']): e for e in db_emps}

# get cost centers
cmd_cc = 'npx supabase db query --linked "SELECT id, name FROM cost_centers" --output json'
result_cc = subprocess.run(cmd_cc, capture_output=True, text=True, shell=True, encoding="utf-8", errors="replace", **opts)
start_cc = result_cc.stdout.find('{')
cc_parsed = json.loads(result_cc.stdout[start_cc:])
db_ccs = cc_parsed.get('rows', cc_parsed)
cc_dict = {normalize(cc['name']): cc['id'] for cc in db_ccs}

# get companies
cmd_co = 'npx supabase db query --linked "SELECT id, name FROM companies" --output json'
result_co = subprocess.run(cmd_co, capture_output=True, text=True, shell=True, encoding="utf-8", errors="replace", **opts)
start_co = result_co.stdout.find('{')
co_parsed = json.loads(result_co.stdout[start_co:])
db_cos = co_parsed.get('rows', co_parsed)
co_dict = {normalize(co['name']): co['id'] for co in db_cos}

print(f"Loaded {len(db_emps)} active employees, {len(db_ccs)} cost centers, {len(db_cos)} companies from DB.")

print("Reading Custos Geral Excel...")
file_path = r"C:\Users\ACPO Empreendimentos\Documents\RHID to Dominio\Custos Geral 20072026.xlsx"
df = pd.read_excel(file_path, sheet_name=0, skiprows=3)

# Headers: 'ATIVO', 'Cod', 'Setor', 'Nome', 'CARGO', 'Códico PC', 'Plano de Carreira', 'ADMISSÃO', 'CENTRO CUSTO', 'DEPARTAMENTO', ...
col_nome = 'Nome'
col_matricula = 'Cod'
col_admissao = 'ADMISSÃO'
col_cc = 'CENTRO CUSTO'
col_empresa = None # Not present in this sheet
col_nascimento = 'NASCIMENTO'

updates = []
missing_in_db = []

for idx, row in df.iterrows():
    name = row.get(col_nome)
    if pd.isna(name) or str(name).strip() == '': continue

    
    norm_name = normalize(name)
    if norm_name not in db_emps_dict:
        missing_in_db.append(norm_name)
        continue
        
    db_emp = db_emps_dict[norm_name]
    
    # Check what needs updating
    update_fields = {}
    
    # 1. Registration Number (Matrícula)
    if not db_emp.get('registration_number'):
        mat = row.get(col_matricula)
        if not pd.isna(mat) and str(mat).strip() != '' and str(mat) != '0':
            mat_str = str(mat).split('.')[0].strip()
            update_fields['registration_number'] = f"'{mat_str}'"
            
    # 2. Admission Date
    if not db_emp.get('admission_date'):
        adm = row.get(col_admissao)
        if not pd.isna(adm):
            try:
                # pandas usually parses dates as datetime if in excel
                if isinstance(adm, str):
                    parsed_date = pd.to_datetime(adm, dayfirst=True)
                else:
                    parsed_date = pd.to_datetime(adm)
                update_fields['admission_date'] = f"'{parsed_date.strftime('%Y-%m-%d')}'"
            except Exception as e:
                pass
                
    # 3. Cost Center
    if not db_emp.get('cost_center_id'):
        cc = row.get(col_cc)
        if not pd.isna(cc):
            norm_cc = normalize(str(cc))
            # try to match cc
            cc_id = None
            for key, val in cc_dict.items():
                if norm_cc in key or key in norm_cc:
                    cc_id = val
                    break
            if cc_id:
                update_fields['cost_center_id'] = f"'{cc_id}'"
                
    # 4. Company
    if not db_emp.get('company_id'):
        co = row.get(col_empresa)
        if not pd.isna(co):
            norm_co = normalize(str(co))
            co_id = None
            for key, val in co_dict.items():
                if norm_co in key or key in norm_co:
                    co_id = val
                    break
            if co_id:
                update_fields['company_id'] = f"'{co_id}'"
                
    # 5. Birthday
    if not db_emp.get('birthday'):
        nasc = row.get(col_nascimento)
        if not pd.isna(nasc):
            try:
                if isinstance(nasc, str):
                    parsed_date = pd.to_datetime(nasc, dayfirst=True)
                else:
                    parsed_date = pd.to_datetime(nasc)
                update_fields['birthday'] = f"'{parsed_date.strftime('%Y-%m-%d')}'"
            except Exception as e:
                pass

    if update_fields:
        updates.append({'id': db_emp['id'], 'name': name, 'fields': update_fields})

print(f"Generated updates for {len(updates)} employees.")

sql = "BEGIN;\n\n"
for u in updates:
    sets = ", ".join([f"{k} = {v}" for k, v in u['fields'].items()])
    sql += f"-- Atualizando {u['name']}\n"
    sql += f"UPDATE employees SET {sets}, updated_at = NOW() WHERE id = '{u['id']}';\n\n"
sql += "COMMIT;\n"

with open("C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/cdabee16-7d60-4be9-9d46-c848215f92a7/scratch/update_from_custos.sql", "w", encoding="utf-8") as f:
    f.write(sql)

print(f"SQL file written to update_from_custos.sql. Missing in DB: {len(missing_in_db)}")
