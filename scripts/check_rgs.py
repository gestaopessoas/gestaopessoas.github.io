import os
import pandas as pd
import json
import re

# Read DB Employees
sql_output_file = r"C:\Users\ACPO Empreendimentos\.gemini\antigravity\brain\cdabee16-7d60-4be9-9d46-c848215f92a7\.system_generated\steps\65\output.txt"
with open(sql_output_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Extract JSON from output
try:
    json_str_match = re.search(r'<untrusted-data-[^>]+>\n(.*)\n</untrusted-data-', content, re.DOTALL)
    if not json_str_match:
        # Maybe it's just raw json if no untrusted data wrapper
        json_obj = json.loads(content)
        db_employees = json.loads(json_obj['result'])
    else:
        json_str = json_str_match.group(1)
        db_employees = json.loads(json_str)
except Exception as e:
    # If the file format is exactly a single JSON object containing "result" as a string
    try:
        data = json.loads(content)
        result_str = data.get("result", "")
        json_str_match = re.search(r'<untrusted-data-[^>]+>\n(.*)\n</untrusted-data-', result_str, re.DOTALL)
        if json_str_match:
             db_employees = json.loads(json_str_match.group(1))
        else:
             db_employees = []
    except Exception as e2:
        print("Failed to parse DB employees:", e2)
        exit(1)

db_active_names = []
db_inactive_names = []
for emp in db_employees:
    name = emp.get('name', '')
    if not name: continue
    full_name = str(name).strip().lower()
    
    status = str(emp.get('status', '')).strip().lower()
    if status == 'ativo':
        db_active_names.append(full_name)
    else:
        db_inactive_names.append(full_name)

# Process Excel
excel_path = r'C:\Users\ACPO Empreendimentos\Downloads\Controle RGS.xlsx'
xls = pd.ExcelFile(excel_path)
sheets = ['2023', '2024', '2025', '2026']

employee_status = {} # name -> list of processes

def clean_name(name):
    if pd.isna(name): return ""
    return str(name).strip().lower()

for s in sheets:
    df = pd.read_excel(xls, s)
    # Find the column for Name and Process
    col_nome = [c for c in df.columns if 'nome' in str(c).lower()]
    col_proc = [c for c in df.columns if 'processo' in str(c).lower()]
    
    if not col_nome or not col_proc:
        continue
        
    c_n = col_nome[0]
    c_p = col_proc[0]
    
    for idx, row in df.iterrows():
        name = clean_name(row[c_n])
        proc = str(row[c_p]).strip().lower()
        if not name or name == 'nan':
            continue
            
        if name not in employee_status:
            employee_status[name] = []
        employee_status[name].append(proc)

excel_active = []
excel_dismissed = []

for name, procs in employee_status.items():
    last_proc = procs[-1]
    if 'demissional' in last_proc or 'demissão' in last_proc:
        excel_dismissed.append(name)
    else:
        has_demissao = any('demissional' in p or 'demissão' in p for p in procs)
        if not has_demissao:
            excel_active.append(name)
        elif not ('demissional' in last_proc or 'demissão' in last_proc):
            excel_active.append(name)

print(f"--- Relatório de Divergências ---\n")
print(f"Total na planilha como ATIVOS: {len(excel_active)}")
print(f"Total na planilha como DEMITIDOS: {len(excel_dismissed)}")
print(f"Total no banco como ATIVOS: {len(db_active_names)}\n")

missing_or_inactive_in_db = []
for name in excel_active:
    matched = False
    for db_name in db_active_names:
        if name in db_name or db_name in name:
            matched = True
            break
    if not matched:
        is_inactive = False
        for db_name in db_inactive_names:
            if name in db_name or db_name in name:
                is_inactive = True
                break
        if is_inactive:
            missing_or_inactive_in_db.append({"name": name.title(), "status": "INATIVO"})
        else:
            missing_or_inactive_in_db.append({"name": name.title(), "status": "NÃO ENCONTRADO"})

# Output missing to json
with open('divergences.json', 'w', encoding='utf-8') as f:
    json.dump({
        "stats": {
             "planilha_ativos": len(excel_active),
             "planilha_demitidos": len(excel_dismissed),
             "db_ativos": len(db_active_names)
        },
        "missing": missing_or_inactive_in_db
    }, f, ensure_ascii=False, indent=2)

print(f"Identificadas {len(missing_or_inactive_in_db)} divergências. Salvo em divergences.json")
