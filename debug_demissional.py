import pandas as pd
import json

file_path = r"C:\Users\ACPO Empreendimentos\Downloads\Controle RGS (1).xlsx"
xl = pd.ExcelFile(file_path)

for sheet in xl.sheet_names:
    if "Saída" in sheet or "Saida" in sheet or "Sada" in sheet:
        continue
    df = xl.parse(sheet)
    
    header_row = 0
    for i in range(min(5, len(df))):
        row_vals = [str(x).upper() if pd.notna(x) else "" for x in df.iloc[i]]
        if any("NOME" in x or "COLABORADOR" in x for x in row_vals):
            header_row = i
            break
            
    df.columns = df.iloc[header_row]
    df = df.iloc[header_row+1:].reset_index(drop=True)
    
    for idx, row in df.iterrows():
        for col in df.columns:
            col_name = str(col).upper()
            if "PROCESSO" in col_name:
                process_val = str(row[col]).upper()
                if "DEMISS" in process_val or "DESLIG" in process_val:
                    print(f"[{sheet}] Encontrado: {row.to_dict()}")
