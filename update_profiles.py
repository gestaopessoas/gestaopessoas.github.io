import pandas as pd
import json
import unicodedata

def normalize(text):
    if pd.isna(text) or not text:
        return ""
    text = str(text).strip().upper()
    return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

csv_path = r'C:\Users\ACPO Empreendimentos\Desktop\Importar dados\Json Colaboradores\colaboradores_solides.csv'
df = pd.read_csv(csv_path, encoding='utf-8-sig')

supabase_out = r'C:\Users\ACPO Empreendimentos\.gemini\antigravity\brain\81153a33-e7e6-4669-b0aa-c7994ab6c183\.system_generated\steps\183\output.txt'
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
    profile_code = row.get('CODIGO_PERFIL', '')
    
    if db_emp and pd.notna(profile_code) and str(profile_code).strip():
        # Only update if profile_code is different or missing in DB
        db_prof = db_emp.get('profile_code')
        new_prof = str(profile_code).strip()
        if not db_prof or db_prof != new_prof:
            emp_id = db_emp['id']
            # safely escape quotes if any
            new_prof_escaped = new_prof.replace("'", "''")
            queries.append(f"UPDATE employees SET profile_code = '{new_prof_escaped}' WHERE id = '{emp_id}';")

with open('update_profiles.sql', 'w', encoding='utf-8') as f:
    f.write("\n".join(queries))

print(f"Generated {len(queries)} update queries.")
