import pandas as pd
import json

file_path = r"C:\Users\ACPO Empreendimentos\Downloads\Controle RGS (1).xlsx"
xl = pd.ExcelFile(file_path)

for sheet in xl.sheet_names:
    print(f"\n--- Sheet: {sheet} ---")
    df = xl.parse(sheet)
    for i in range(min(10, len(df))):
        print(df.iloc[i].to_dict())
