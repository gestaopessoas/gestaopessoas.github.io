import os
import subprocess
import json
import unicodedata
import re

def normalize(name):
    if not isinstance(name, str): return ""
    n = unicodedata.normalize('NFKD', name).encode('ASCII', 'ignore').decode('utf-8')
    n = n.upper().strip()
    return re.sub(r'\s+', ' ', n)

opts = {'cwd': 'C:\\Users\\ACPO Empreendimentos\\Documents\\Github\\gestaopessoas.github.io'}
cmd = 'npx supabase db query --linked "SELECT name FROM employees WHERE status IN (\'Ativo\', \'Férias\', \'Afastado\') AND (admission_date IS NULL OR registration_number IS NULL OR birthday IS NULL OR cost_center_id IS NULL OR company_id IS NULL OR workplace_id IS NULL)" --output json'

print("Querying database for active employees with missing info...")
result = subprocess.run(cmd, capture_output=True, text=True, shell=True, encoding="utf-8", errors="replace", **opts)
out = result.stdout
start = out.find('{')
if start == -1:
    print("Error querying db:", out)
    exit(1)

parsed = json.loads(out[start:])
active_missing = [e['name'] for e in parsed.get('rows', parsed)]

paths_to_check = [
    r"C:\Users\ACPO Empreendimentos\CONSTRUTORA ACPO LTDA\CLOUD PRIVADO - Documentos\ACPO\SEDE\FUNCIONARIOS",
    r"C:\Users\ACPO Empreendimentos\CONSTRUTORA ACPO LTDA\CLOUD PRIVADO - Documentos\ACPO\OBRAS"
]

all_folders = []

print("Scanning directories...")
for base_path in paths_to_check:
    if not os.path.exists(base_path):
        print(f"Path does not exist: {base_path}")
        continue
    
    # We walk the directory tree up to a certain depth (e.g. 3 levels) to find folders
    for root, dirs, files in os.walk(base_path):
        depth = root[len(base_path):].count(os.sep)
        if depth > 2:
            del dirs[:] # Don't go deeper than 2 levels under base_path
            continue
            
        for d in dirs:
            all_folders.append({
                'name': d,
                'norm_name': normalize(d),
                'path': os.path.join(root, d)
            })

print(f"Found {len(all_folders)} folders in total.")

found_folders = []
not_found_folders = []

for emp_name in active_missing:
    norm_emp = normalize(emp_name)
    
    # Try exact match first
    matched = None
    for folder in all_folders:
        if folder['norm_name'] == norm_emp:
            matched = folder
            break
            
    # Try partial match if not found
    if not matched:
        for folder in all_folders:
            # check if employee name is in folder name or vice-versa
            # use a reasonable threshold or split by words
            emp_words = set(norm_emp.split())
            folder_words = set(folder['norm_name'].split())
            
            if len(emp_words) > 1 and len(folder_words) > 1:
                # if they share at least 2 words (e.g. first and last name)
                overlap = emp_words.intersection(folder_words)
                if len(overlap) >= 2:
                    matched = folder
                    break

    if matched:
        found_folders.append((emp_name, matched['path']))
    else:
        not_found_folders.append(emp_name)

print(f"\n--- RESULT ---")
print(f"Active employees missing data: {len(active_missing)}")
print(f"Folders found: {len(found_folders)}")
print(f"Folders missing: {len(not_found_folders)}")

with open("C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/cdabee16-7d60-4be9-9d46-c848215f92a7/scratch/folder_matches.json", "w", encoding="utf-8") as f:
    json.dump({
        "found": found_folders,
        "not_found": not_found_folders
    }, f, indent=2, ensure_ascii=False)

print("Done.")
