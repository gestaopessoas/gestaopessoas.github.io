import pandas as pd
import glob
import os

folder = r"C:\Users\ACPO Empreendimentos\Desktop\Nova pasta (2)"
files = glob.glob(os.path.join(folder, "CONTROLE*.xlsx"))

print(f"Found {len(files)} files.")

for f in files:
    print(f"\n--- {os.path.basename(f)} ---")
    try:
        # Read the excel file, try first row as header.
        df = pd.read_excel(f, nrows=5)
        cols = list(df.columns)
        print("Columns:", cols)
        
        # Check if 'matricula', 'codigo' or 'dominio' are in columns
        matches = [c for c in cols if 'mat' in str(c).lower() or 'cod' in str(c).lower() or 'dom' in str(c).lower()]
        if matches:
            print(">>> Matches found in columns:", matches)
        else:
            # Maybe the header is lower down, scan first 10 rows
            df_full = pd.read_excel(f, nrows=10)
            found = False
            for i, row in df_full.iterrows():
                row_str = ' '.join([str(x).lower() for x in row.values])
                if 'mat' in row_str or 'cod' in row_str or 'dom' in row_str:
                    print(f">>> Matches found in row {i}: {row.values}")
                    found = True
                    break
            if not found:
                print(">>> No obvious matricula/dominio column found.")
    except Exception as e:
        print("Error reading:", e)
