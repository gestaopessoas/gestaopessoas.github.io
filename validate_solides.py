import os
import json
import pandas as pd
import unicodedata

def normalize(text):
    if pd.isna(text) or not text:
        return ""
    text = str(text).strip().upper()
    return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

# Load the CSV
csv_path = r'C:\Users\ACPO Empreendimentos\Desktop\Importar dados\Json Colaboradores\colaboradores_solides.csv'
df_solides = pd.read_csv(csv_path, encoding='utf-8-sig')

# Load the Supabase output
supabase_out = r'C:\Users\ACPO Empreendimentos\.gemini\antigravity\brain\81153a33-e7e6-4669-b0aa-c7994ab6c183\.system_generated\steps\152\output.txt'

with open(supabase_out, 'r', encoding='utf-8') as f:
    raw_data = f.read()

try:
    mcp_output = json.loads(raw_data)
    result_str = mcp_output.get("result", "")
    start = result_str.find('[')
    end = result_str.rfind(']')
    if start != -1 and end != -1:
        json_str = result_str[start:end+1]
        db_employees = json.loads(json_str)
    else:
        print("JSON array not found in result string")
        db_employees = []
except Exception as e:
    print(f"Failed to decode JSON from Supabase output: {e}")
    db_employees = []

print(f"Total in CSV: {len(df_solides)}")

db_names = {normalize(emp['name']): emp for emp in db_employees if emp.get('name')}

matched = 0
unmatched = []

for idx, row in df_solides.iterrows():
    name = normalize(row.get('NOME_COMPLETO', ''))
    if name in db_names:
        matched += 1
    else:
        unmatched.append(row.get('NOME_COMPLETO', ''))

print(f"\n--- Validation Summary ---")
print(f"Matched names: {matched} out of {len(df_solides)}")

if unmatched:
    print(f"\nUnmatched names ({len(unmatched)}):")
    for u in unmatched:
        print(f" - {u}")
else:
    print("\nAll extracted employees were found in the database!")
