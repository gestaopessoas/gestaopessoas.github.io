import pandas as pd
import json
import subprocess
import unicodedata
import re

def normalize(name):
    if not isinstance(name, str): return ""
    n = unicodedata.normalize('NFKD', name).encode('ASCII', 'ignore').decode('utf-8')
    n = n.upper().strip()
    return re.sub(r'\s+', ' ', n)

opts = {'cwd': 'C:\\Users\\ACPO Empreendimentos\\Documents\\Github\\gestaopessoas.github.io'}
cmd = 'npx supabase db query --linked "SELECT name FROM employees WHERE status NOT IN (\'Ativo\', \'Férias\', \'Afastado\') AND dismissed_at IS NULL" --output json'
result = subprocess.run(cmd, capture_output=True, text=True, shell=True, encoding="utf-8", errors="replace", **opts)
out = result.stdout
start = out.find('{')
parsed = json.loads(out[start:])
missing_names = [normalize(e['name']) for e in parsed.get('rows', parsed)]

file_path = r"C:\Users\ACPO Empreendimentos\Downloads\Controle RGS (1).xlsx"
xl = pd.ExcelFile(file_path)

excel_names = set()
for sheet in xl.sheet_names:
    if "Saída" in sheet or "Saida" in sheet or "Sada" in sheet: continue
    df = xl.parse(sheet)
    col_map = {}
    for col in df.columns:
        if "NOME" in str(col).upper() or "COLABORADOR" in str(col).upper(): col_map['name'] = col
    if 'name' in col_map:
        for val in df[col_map['name']].dropna().unique():
            excel_names.add(normalize(str(val)))

found_any = [n for n in missing_names if n in excel_names]
print(f"Missing in DB: {len(missing_names)}")
print(f"Unique names in Excel: {len(excel_names)}")
print(f"Overlap (names missing in DB that APPEAR in Excel AT ALL): {len(found_any)}")
if len(found_any) > 0:
    print(f"Sample of overlap: {found_any[:5]}")
