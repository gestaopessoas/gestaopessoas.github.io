import json
import os
import re

with open("C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/cdabee16-7d60-4be9-9d46-c848215f92a7/scratch/folder_matches.json", "r", encoding="utf-8") as f:
    data = json.load(f)

found = data['found']

files_by_keyword = {
    'ficha': [],
    'contrato': [],
    'registro': [],
    'documentos': [],
    'aso': [],
    'admissao': [],
    'admissional': []
}

for emp_name, folder_path in found:
    if os.path.exists(folder_path):
        for root, dirs, files in os.walk(folder_path):
            for file in files:
                name_lower = file.lower()
                for key in files_by_keyword.keys():
                    if key in name_lower and file.endswith('.pdf'):
                        files_by_keyword[key].append(file)

print("Most common files matching keywords:")
for key, file_list in files_by_keyword.items():
    print(f"\n--- {key.upper()} ({len(file_list)}) ---")
    # count exact frequencies
    freq = {}
    for f in file_list:
        # ignore dates in names to group them better
        f_clean = re.sub(r'\d', '', f).strip()
        f_clean = re.sub(r'[\-\_\.]+', ' ', f_clean).strip()
        freq[f_clean] = freq.get(f_clean, 0) + 1
        
    for k, v in sorted(freq.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"  {v}x : {k}")
