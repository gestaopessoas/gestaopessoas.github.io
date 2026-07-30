import pandas as pd
import json
import unicodedata
import re

def normalize(text):
    if pd.isna(text) or text is None: return ""
    text = str(text).strip().upper()
    return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

def clean_phone(phone):
    if not phone or pd.isna(phone): return ""
    return re.sub(r'\D', '', str(phone))

def clean_str(val):
    if pd.isna(val) or val is None: return ""
    return str(val).strip().upper()

csv_path = r'C:\Users\ACPO Empreendimentos\Desktop\Importar dados\Json Colaboradores\colaboradores_solides.csv'
df = pd.read_csv(csv_path, encoding='utf-8-sig')
supabase_out = r'C:\Users\ACPO Empreendimentos\.gemini\antigravity\brain\81153a33-e7e6-4669-b0aa-c7994ab6c183\.system_generated\steps\217\output.txt'

with open(supabase_out, 'r', encoding='utf-8') as f:
    raw_data = f.read()

mcp_output = json.loads(raw_data)
result_str = mcp_output.get("result", "")
start = result_str.find('[')
end = result_str.rfind(']')
json_str = result_str[start:end+1]
db_employees = json.loads(json_str)

db_map = {normalize(emp['name']): emp for emp in db_employees if emp.get('name')}

queries = []

for idx, row in df.iterrows():
    name_norm = normalize(row.get('NOME_COMPLETO', ''))
    db_emp = db_map.get(name_norm)
    if not db_emp: continue
    
    csv_email = clean_str(row.get('EMAIL', ''))
    csv_phone = clean_phone(row.get('TELEFONE', ''))
    
    db_email_corp = clean_str(db_emp.get('email_corporate', ''))
    db_email_pers = clean_str(db_emp.get('email_personal', ''))
    db_phone = clean_phone(db_emp.get('phone', ''))
    
    emp_id = db_emp['id']
    updates = []
    
    # Phone Update
    if csv_phone and csv_phone != db_phone:
        updates.append(f"phone = '{csv_phone}'")
        
    # Email Update
    if csv_email:
        if csv_email != db_email_corp and csv_email != db_email_pers:
            if "ACPO.COM.BR" in csv_email:
                updates.append(f"email_corporate = '{csv_email.lower()}'")
            else:
                updates.append(f"email_personal = '{csv_email.lower()}'")
                
    if updates:
        queries.append(f"UPDATE employees SET {', '.join(updates)} WHERE id = '{emp_id}';")

with open('update_contacts.sql', 'w', encoding='utf-8') as f:
    f.write("\n".join(queries))

print(f"Generated {len(queries)} update queries.")
