import pdfplumber, re, json, sys

def extract_old(filepath, default_cc):
    res = []
    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text: continue
            lines = text.split('\n')
            cc_dominio_code = default_cc
            for line in lines:
                line = line.strip()
                if not line: continue
                # Update CC if we find it
                cc_match = re.match(r'^Centro de Custo:\s*(\d+)', line, re.IGNORECASE)
                if cc_match:
                    cc_dominio_code = cc_match.group(1).strip()
                    continue
                # Match Date at the end
                date_match = re.search(r'(\d{2}/\d{2}/\d{4})', line)
                if date_match:
                    words = line.split()
                    if words and words[0].isdigit():
                        matricula = words[0]
                        admissao = date_match.group(1)
                        
                        name_parts = []
                        for w in words[1:]:
                            if w.isupper() or w in ['DA', 'DE', 'DO', 'DAS', 'DOS', 'E', '(A)', 'O']:
                                name_parts.append(w)
                            else:
                                break
                        name = " ".join(name_parts)
                        res.append({
                            'matricula': matricula,
                            'nome': name,
                            'admissao': admissao,
                            'cc_code': cc_dominio_code,
                            'pdf_file': filepath.split('\\')[-1]
                        })
    return res

def extract_new(filepath):
    res = []
    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            for line in page.extract_text().split('\n'):
                # Format: matricula nome cc_code ... admissao
                m = re.match(r'^(\d+)\s+(.+?)\s+(\d{3,5})\s+\d{1,3},\d{2}\s+(\d{2}/\d{2}/\d{4})', line.strip())
                if m:
                    res.append({
                        'matricula': m.group(1),
                        'nome': m.group(2).strip(),
                        'cc_code': m.group(3),
                        'admissao': m.group(4),
                        'pdf_file': filepath.split('\\')[-1]
                    })
    return res

moov = extract_old(r'C:\Users\ACPO Empreendimentos\Desktop\Nova pasta (2)\17072026 Empregados MOOV.pdf', '10963')
specd = extract_old(r'C:\Users\ACPO Empreendimentos\Desktop\Nova pasta (2)\17072026 Empregados SPECD.pdf', '10867')
life_solanas = extract_old(r'C:\Users\ACPO Empreendimentos\Desktop\Nova pasta (2)\Empregados.pdf LIFE E SOLANAS.pdf', '10893')

joy = extract_new(r'C:\Users\ACPO Empreendimentos\Desktop\Nova pasta (2)\21072026 Empregados JOY.pdf')
life_rg = extract_new(r'C:\Users\ACPO Empreendimentos\Desktop\Nova pasta (2)\21072026 Empregados LIFE RIO GRANDE.pdf')

all_emp = moov + specd + life_solanas + joy + life_rg

# Save to JSON
with open('all_pdf_employees.json', 'w', encoding='utf-8') as f:
    json.dump(all_emp, f, indent=2, ensure_ascii=False)

print(f"Extracted {len(all_emp)} total employees from PDFs.")
