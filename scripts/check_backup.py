import json
import re
from ocr_data import moov_text, specd_text, life_text, jpeg_data
from datetime import datetime

# Build rich_employees from OCR texts
employees_data = []

def parse_text(text, default_company):
    company = default_company
    centro_custo = ""
    obra = ""
    for line in text.split('\n'):
        line = line.strip()
        if not line: continue
        if line.startswith("SPE MOOV RESIDENCIAL LTDA"):
            company = "SPE MOOV RESIDENCIAL LTDA"
        elif line.startswith("SPE CONNECT DUQUE RESIDENCE LTDA"):
            company = "SPE CONNECT DUQUE RESIDENCE LTDA"
        elif line.startswith("ACPO LIFE.RIO GRANDE SPE LTDA"):
            company = "ACPO LIFE.RIO GRANDE SPE LTDA"
            
        if line.startswith("Centro de Custo:"):
            parts = line.split('-', 1)
            if len(parts) == 2:
                cc_part = parts[0].replace("Centro de Custo:", "").strip()
                obra_part = parts[1].strip()
                centro_custo = cc_part
                obra = obra_part
                
        match = re.match(r'^(\d{2,6})\s+([A-Z\s\.]+)', line)
        if match:
            mat = match.group(1)
            raw_name = match.group(2).strip()
            admissao = "N/A"
            date_match = re.search(r'(\d{2}/\d{2}/\d{4})', line)
            if date_match:
                admissao = date_match.group(1)
            
            employees_data.append({
                "matricula": mat,
                "raw_name": raw_name,
                "centro_custo": centro_custo if centro_custo else "N/A",
                "obra": obra if obra else "N/A",
                "empresa": company,
                "admissao": admissao,
            })

parse_text(moov_text, "SPE MOOV RESIDENCIAL LTDA")
parse_text(specd_text, "SPE CONNECT DUQUE RESIDENCE LTDA")
parse_text(life_text, "ACPO LIFE.RIO GRANDE SPE LTDA")

jpeg_dates = ["18/11/2025", "18/11/2025", "23/12/2024", "18/02/2026", "24/04/2024"]
for i, j in enumerate(jpeg_data):
    employees_data.append({
        "matricula": j["mat"],
        "raw_name": j["nome"],
        "centro_custo": "N/A",
        "obra": "N/A",
        "empresa": "N/A",
        "admissao": jpeg_dates[i]
    })

with open(r'scripts\employee_list.txt', 'r', encoding='utf-8') as f:
    exact_names = [line.strip() for line in f.readlines() if line.strip()]

rich_employees = []
for exact_name in exact_names:
    found = False
    for ed in employees_data:
        if ed['raw_name'].startswith(exact_name):
            rich_employees.append({
                "name": exact_name,
                "matricula": ed["matricula"],
                "centro_custo": ed["centro_custo"],
                "obra": ed["obra"],
                "empresa": ed["empresa"],
                "admissao": ed["admissao"]
            })
            found = True
            break
    if not found:
        rich_employees.append({
            "name": exact_name,
            "matricula": "N/A", "centro_custo": "N/A", "obra": "N/A", "empresa": "N/A", "admissao": "N/A"
        })

# Load Backup Data
backup_file = r"C:\Users\ACPO Empreendimentos\Desktop\Nova pasta (2)\backup_gestaopessoas_2026-07-21.json"
with open(backup_file, 'r', encoding='utf-8') as f:
    backup_data = json.load(f)

db_employees = backup_data.get('employees', [])

db_active = []
db_inactive = []
for emp in db_employees:
    name = emp.get('name', '')
    if not name: continue
    full_name = str(name).strip().lower()
    
    status = str(emp.get('status', '')).strip().lower()
    if status == 'ativo':
        db_active.append((full_name, emp))
    else:
        db_inactive.append((full_name, emp))

missing_or_inactive_in_db = []
found_and_active = []

for emp in rich_employees:
    name = emp['name']
    name_clean = name.lower()
    
    matched_emp = None
    for db_name, db_emp in db_active:
        if name_clean in db_name or db_name in name_clean:
            matched_emp = db_emp
            break
            
    if not matched_emp:
        is_inactive = False
        for db_name, db_emp in db_inactive:
            if name_clean in db_name or db_name in name_clean:
                is_inactive = True
                break
        
        emp['status'] = "INATIVO" if is_inactive else "NÃO ENCONTRADO"
        missing_or_inactive_in_db.append(emp)
    else:
        found_and_active.append((emp, matched_emp))

# Check for missing info in matched employees
missing_info_alerts = []

for pdf_emp, db_emp in found_and_active:
    missing = []
    
    # check matricula
    if not db_emp.get('registration_number'):
        if pdf_emp['matricula'] != 'N/A':
            missing.append(f"Matrícula (No PDF: {pdf_emp['matricula']})")
    
    # check admission
    if not db_emp.get('admission_date'):
        if pdf_emp['admissao'] != 'N/A':
            missing.append(f"Admissão (No PDF: {pdf_emp['admissao']})")
            
    # check centro custo / obra / empresa
    if not db_emp.get('company_id'):
        missing.append("Empresa")
    if not db_emp.get('cost_center_id'):
        missing.append("Centro de Custo")
    if not db_emp.get('workplace_id'):
        missing.append("Obra / Local de Trabalho")
        
    if missing:
        missing_info_alerts.append(f"- **{pdf_emp['name'].title()}**: Faltando -> {', '.join(missing)}")

md = f"""# Relatório de Análise do Backup (21/07/2026)

> [!NOTE]
> Este relatório compara os colaboradores dos arquivos originais com o backup do banco de dados recém-gerado.

## Resumo
- **Total de colaboradores na lista (PDFs/Imagens)**: {len(rich_employees)}
- **Ainda faltam ser adicionados (ou estão inativos)**: {len(missing_or_inactive_in_db)}
- **Encontrados ativos no banco**: {len(found_and_active)}

"""

if missing_info_alerts:
    md += "## Colaboradores com Informações a Complementar no Banco de Dados\n\n"
    md += "Os colaboradores abaixo estão cadastrados e ATIVOS no banco, mas faltam informações cruciais (como Matrícula, Admissão, Centro de Custo, Obra ou Empresa) quando comparado ao arquivo em PDF.\n\n"
    for alert in sorted(missing_info_alerts):
        md += alert + "\n"
    md += "\n"
else:
    md += "## Informações a Complementar\n\n- Todos os colaboradores encontrados ativos no banco possuem Empresa, Centro de Custo, Obra, Matrícula e Admissão preenchidos!\n\n"

md += "## Lista de Colaboradores Ainda Ausentes / Inativos\n\n"
md += "| Matrícula | Nome | Empresa | Centro de Custo | Obra | Admissão | Status Backup |\n"
md += "|-----------|------|---------|-----------------|------|----------|---------------|\n"

for item in sorted(missing_or_inactive_in_db, key=lambda x: x['name']):
    md += f"| {item['matricula']} | {item['name'].title()} | {item['empresa']} | {item['centro_custo']} | {item['obra']} | {item['admissao']} | {item['status']} |\n"

with open(r'C:\Users\ACPO Empreendimentos\.gemini\antigravity\brain\cdabee16-7d60-4be9-9d46-c848215f92a7\analise_backup_2026_07_21.md', 'w', encoding='utf-8') as f:
    f.write(md)

print("Analysis of backup completed.")
