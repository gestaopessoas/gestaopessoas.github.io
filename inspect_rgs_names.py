import pandas as pd
import json

file_path = r"C:\Users\ACPO Empreendimentos\Downloads\Controle RGS (1).xlsx"
xl = pd.ExcelFile(file_path)

processes = set()
names = set()

def process_df(df):
    col_map = {}
    for col in df.columns:
        col_name = str(col).upper()
        if "NOME" in col_name or "COLABORADOR" in col_name: col_map['name'] = col
        if "PROCESSO" in col_name: col_map['process'] = col
                
    if 'process' in col_map:
        for val in df[col_map['process']].dropna().unique():
            processes.add(str(val))
            
    if 'name' in col_map:
        for val in df[col_map['name']].dropna().unique():
            names.add(str(val))

for sheet in xl.sheet_names:
    if "Saída" in sheet or "Saida" in sheet or "Sada" in sheet:
        continue
    df = xl.parse(sheet)
    process_df(df)

print("Processos encontrados:")
for p in sorted(list(processes)):
    print(f"- {p}")
    
print(f"\nTotal de nomes encontrados: {len(names)}")
sample_names = sorted(list(names))[:10]
print("Amostra de nomes:")
for n in sample_names:
    print(f"- {n}")
