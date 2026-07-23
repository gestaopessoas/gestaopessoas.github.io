import pdfplumber
import glob
import os
import json
import re

pdf_files = glob.glob(r"C:\Users\ACPO Empreendimentos\Desktop\Nova pasta (2)\*.pdf")

def parse_pdf(filepath):
    employees = []
    current_company = ""
    current_cost_center = ""
    cc_dominio_code = ""
    
    with pdfplumber.open(filepath) as pdf:
        for page_num, page in enumerate(pdf.pages):
            text = page.extract_text()
            if not text: continue
            
            lines = text.split('\n')
            
            for line in lines:
                line = line.strip()
                if not line: continue
                
                # Check if line looks like a company name at the top (usually first line)
                if "RELAÇÃO DE EMPREGADOS" in line or "Página:" in line or "Emissão:" in line or "Horas:" in line:
                    continue
                
                # Sometimes company name is at the start of the page
                if " LTDA" in line.upper() or "CONSTRUTORA" in line.upper() or "ACPO" in line.upper():
                    if "Centro de Custo:" not in line:
                        # Assuming it's the company name if it's in the first few lines and not a CC
                        # Actually, let's be careful. Let's just look at line 0 or 1.
                        pass
                
                # Match Centro de Custo
                cc_match = re.match(r'^Centro de Custo:\s*(\d+)\s*-\s*(.*)', line, re.IGNORECASE)
                if cc_match:
                    cc_dominio_code = cc_match.group(1).strip()
                    current_cost_center = cc_match.group(2).strip()
                    continue
                
                # Match employee line: e.g. "19888 VALDILENE NEGRAO DE FARIAS TEC. SEG. DO TRABALHO Mensalista 220,00 0 0 13/02/2023 S S"
                # A common pattern: digits followed by name, then some text, then dates
                # Let's just match digits followed by letters
                emp_match = re.match(r'^(\d+)\s+([A-Z\s]+?)\s{2,}', line)
                if emp_match:
                    matricula = emp_match.group(1).strip()
                    name = emp_match.group(2).strip()
                    employees.append({
                        "matricula": matricula,
                        "name": name,
                        "cost_center": current_cost_center,
                        "cc_dominio_code": cc_dominio_code,
                        "pdf_file": os.path.basename(filepath)
                    })
                else:
                    # sometimes the spaces are not more than 2, but we can match dates at the end
                    date_match = re.search(r'(\d{2}/\d{2}/\d{4})', line)
                    if date_match:
                        # try to extract matricula and name
                        words = line.split()
                        if words and words[0].isdigit():
                            matricula = words[0]
                            # name is everything after matricula until a word that is not all caps (like Cargo or Categoria)
                            # Actually, a simpler way: just take all words until we hit one that is mixed case or a number, or just take the next few words
                            # Brazilian names are usually all caps in these systems
                            name_parts = []
                            for w in words[1:]:
                                if w.isupper() or w in ['DA', 'DE', 'DO', 'DAS', 'DOS', 'E']:
                                    name_parts.append(w)
                                else:
                                    break
                            
                            name = " ".join(name_parts)
                            
                            if name and matricula and not any(e['matricula'] == matricula for e in employees):
                                employees.append({
                                    "matricula": matricula,
                                    "name": name,
                                    "cost_center": current_cost_center,
                                    "cc_dominio_code": cc_dominio_code,
                                    "pdf_file": os.path.basename(filepath)
                                })
    return employees

all_extracted = []
for f in pdf_files:
    print(f"Parsing {f}...")
    extracted = parse_pdf(f)
    all_extracted.extend(extracted)

with open("pdf_extracted_employees.json", "w", encoding="utf-8") as f:
    json.dump(all_extracted, f, indent=2, ensure_ascii=False)

print(f"Extracted {len(all_extracted)} employees from PDFs.")
