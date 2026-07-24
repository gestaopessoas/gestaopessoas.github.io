import os
import json
import re
import fitz  # PyMuPDF
import unicodedata

def normalize(name):
    if not isinstance(name, str): return ""
    n = unicodedata.normalize('NFKD', name).encode('ASCII', 'ignore').decode('utf-8')
    n = n.upper().strip()
    return re.sub(r'\s+', ' ', n)

with open("C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/cdabee16-7d60-4be9-9d46-c848215f92a7/scratch/folder_matches.json", "r", encoding="utf-8") as f:
    data = json.load(f)

found = data['found']

results = []

def extract_info(text):
    info = {}
    
    # Try to find Data de Admissão
    admissao_match = re.search(r'(?:admiss[aã]o|admitido em).*?(\d{2}[/\-]\d{2}[/\-]\d{4})', text, re.IGNORECASE)
    if admissao_match:
        info['admissao'] = admissao_match.group(1)
        
    # Try to find Data de Nascimento
    nasc_match = re.search(r'(?:nascimento|nascido em).*?(\d{2}[/\-]\d{2}[/\-]\d{4})', text, re.IGNORECASE)
    if nasc_match:
        info['nascimento'] = nasc_match.group(1)
        
    # Try to find Matrícula
    mat_match = re.search(r'(?:matr[ií]cula|chapa).*?(\d+)', text, re.IGNORECASE)
    if mat_match:
        info['matricula'] = mat_match.group(1)
        
    # Centro de custo?
    cc_match = re.search(r'(?:centro de custo|cc).*?([a-z0-9]+)', text, re.IGNORECASE)
    if cc_match:
        info['centro_custo'] = cc_match.group(1)
        
    return info

for emp_name, folder_path in found:
    emp_data = {'name': emp_name, 'extracted': {}, 'files_parsed': [], 'scanned_only': []}
    
    if os.path.exists(folder_path):
        for root, dirs, files in os.walk(folder_path):
            for file in files:
                name_lower = file.lower()
                if file.endswith('.pdf') and ('ficha' in name_lower or 'registro' in name_lower or 'contrato' in name_lower):
                    path = os.path.join(root, file)
                    try:
                        doc = fitz.open(path)
                        text = ""
                        for page in doc:
                            text += page.get_text()
                            
                        if len(text.strip()) > 50:
                            emp_data['files_parsed'].append(file)
                            info = extract_info(text)
                            for k, v in info.items():
                                if k not in emp_data['extracted']:
                                    emp_data['extracted'][k] = v
                        else:
                            emp_data['scanned_only'].append(file)
                    except Exception as e:
                        pass
    
    results.append(emp_data)

out_path = "C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/cdabee16-7d60-4be9-9d46-c848215f92a7/scratch/extracted_registration_data.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

extracted_count = sum(1 for r in results if len(r['extracted']) > 0)
scanned_count = sum(1 for r in results if len(r['scanned_only']) > 0 and len(r['files_parsed']) == 0)

print(f"Total employees checked: {len(results)}")
print(f"Employees with some data extracted: {extracted_count}")
print(f"Employees with ONLY scanned PDFs: {scanned_count}")
