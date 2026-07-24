import pandas as pd
import json
import subprocess
import re
import unicodedata

def normalize(name):
    if not isinstance(name, str):
        return ""
    n = unicodedata.normalize('NFKD', name).encode('ASCII', 'ignore').decode('utf-8')
    n = n.upper().strip()
    return re.sub(r'\s+', ' ', n)

print("Fetching inactive employees from DB...")
opts = {'cwd': 'C:\\Users\\ACPO Empreendimentos\\Documents\\Github\\gestaopessoas.github.io'}
cmd = 'npx supabase db query --linked "SELECT id, name, status, dismissed_at FROM employees WHERE status NOT IN (\'Ativo\', \'Férias\', \'Afastado\')" --output json'
result = subprocess.run(cmd, capture_output=True, text=True, shell=True, encoding="utf-8", errors="replace", **opts)

out = result.stdout
if out is None:
    print("No stdout output")
    exit(1)

start = out.find('{')
if start == -1:
    print("Failed to get JSON")
    exit(1)

parsed = json.loads(out[start:])
employees = parsed.get('rows', parsed)

missing_dismissed = [e for e in employees if not e.get('dismissed_at')]

file_path = r"C:\Users\ACPO Empreendimentos\Downloads\Controle RGS (1).xlsx"
print(f"Loading Excel file {file_path}...")
xl = pd.ExcelFile(file_path)

termination_data = {}

def process_df(df):
    col_map = {}
    for col in df.columns:
        col_name = str(col).upper()
        if "NOME" in col_name or "COLABORADOR" in col_name: col_map['name'] = col
        if "PROCESSO" in col_name: col_map['process'] = col
        if "DATA" in col_name or "VIGÊNCIA" in col_name or "VIGENCIA" in col_name:
            if 'date' not in col_map:
                col_map['date'] = col
                
    if 'name' in col_map and 'process' in col_map and 'date' in col_map:
        for idx, row in df.iterrows():
            process_val = str(row[col_map['process']]).upper()
            if "DESLIGAMENTO" in process_val or "DEMISS" in process_val or "RESCIS" in process_val or "SAÍDA" in process_val or "SAIDA" in process_val:
                name = row[col_map['name']]
                date = row[col_map['date']]
                if pd.notna(name) and pd.notna(date):
                    norm_name = normalize(str(name))
                    try:
                        parsed_date = pd.to_datetime(date, errors='coerce')
                        if pd.notna(parsed_date):
                            termination_data[norm_name] = parsed_date.strftime('%Y-%m-%d')
                    except:
                        pass

for sheet in xl.sheet_names:
    if "Saída" in sheet or "Saida" in sheet:
        continue
    df = xl.parse(sheet)
    process_df(df)

found = []
not_found = []
sql_statements = ["BEGIN;"]

for emp in missing_dismissed:
    norm_name = normalize(emp['name'])
    if norm_name in termination_data:
        t_date = termination_data[norm_name]
        emp['found_date'] = t_date
        found.append(emp)
        sql_statements.append(f"UPDATE employees SET dismissed_at = '{t_date}' WHERE id = '{emp['id']}';")
    else:
        # Check if there is a partial match
        matched = False
        for tn, td in termination_data.items():
            if tn in norm_name or norm_name in tn:
                emp['found_date'] = td
                found.append(emp)
                sql_statements.append(f"UPDATE employees SET dismissed_at = '{td}' WHERE id = '{emp['id']}';")
                matched = True
                break
        if not matched:
            not_found.append(emp)

sql_statements.append("COMMIT;")

sql_file = "C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/cdabee16-7d60-4be9-9d46-c848215f92a7/scratch/update_dismissals.sql"
with open(sql_file, "w", encoding="utf-8") as f:
    f.write("\n".join(sql_statements))

md = f"# Resultado da Busca por Datas de Desligamento\n\n"
md += f"Buscamos as datas de desligamento (Processos de Desligamento/Demissão) no arquivo `Controle RGS (1).xlsx`.\n\n"
md += f"- **Encontrados e atualizados:** {len(found)}\n"
md += f"- **Não encontrados:** {len(not_found)}\n\n"

if len(not_found) > 0:
    md += f"## Colaboradores sem data de desligamento na planilha (Total: {len(not_found)})\n\n"
    md += "| Nome | Status |\n|---|---|\n"
    not_found.sort(key=lambda x: x['name'])
    for nf in not_found:
        md += f"| {nf['name']} | {nf.get('status', '')} |\n"

md_file = "C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/cdabee16-7d60-4be9-9d46-c848215f92a7/cadastros_nao_encontrados_rgs.md"
with open(md_file, "w", encoding="utf-8") as f:
    f.write(md)

print(f"Found {len(found)}, Not Found {len(not_found)}")
print("Done")
