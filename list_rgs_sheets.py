import pandas as pd
import json

file_path = r"C:\Users\ACPO Empreendimentos\Downloads\Controle RGS (1).xlsx"
xl = pd.ExcelFile(file_path)
print(json.dumps(xl.sheet_names))
