import pandas as pd

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
    
    col_map = {}
    for col in df.columns:
        col_name = str(col).upper()
        if "NOME" in col_name or "COLABORADOR" in col_name: col_map['name'] = col
        if "PROCESSO" in col_name: col_map['process'] = col
        if "DATA" in col_name or "VIGÊNCIA" in col_name or "VIGENCIA" in col_name:
            if 'date' not in col_map: col_map['date'] = col

    print(f"\n[{sheet}] Columns found: {col_map}")
    
    if 'process' in col_map:
        for idx, row in df.iterrows():
            process_val = str(row[col_map['process']]).upper()
            if process_val and process_val != "NAN":
                if "DEMISS" in process_val or "DESLIG" in process_val:
                    print(f"MATCHED PROCESS: {process_val} for row {idx}")
                    print(row.to_dict())
