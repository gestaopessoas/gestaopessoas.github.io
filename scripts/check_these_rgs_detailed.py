import json
import re
from ocr_data import moov_text, specd_text, life_text, jpeg_data

employees_data = []
missing_cc_alerts = []

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
                
        # Match matricula
        match = re.match(r'^(\d{2,6})\s+([A-Z\s\.]+)', line)
        if match:
            mat = match.group(1)
            raw_name = match.group(2).strip()
            
            # Extract admission date
            admissao = "N/A"
            date_match = re.search(r'(\d{2}/\d{2}/\d{4})', line)
            if date_match:
                admissao = date_match.group(1)
            
            if not centro_custo:
                missing_cc_alerts.append(f"Falta Centro de Custo para: {raw_name} (Empresa: {company})")

            employees_data.append({
                "matricula": mat,
                "raw_name": raw_name,
                "centro_custo": centro_custo if centro_custo else "N/A",
                "obra": obra if obra else "N/A",
                "empresa": company,
                "admissao": admissao,
                "original_line": line
            })

parse_text(moov_text, "SPE MOOV RESIDENCIAL LTDA")
parse_text(specd_text, "SPE CONNECT DUQUE RESIDENCE LTDA")
parse_text(life_text, "ACPO LIFE.RIO GRANDE SPE LTDA")

jpeg_dates = ["18/11/2025", "18/11/2025", "23/12/2024", "18/02/2026", "24/04/2024"]
for i, j in enumerate(jpeg_data):
    missing_cc_alerts.append(f"Falta Centro de Custo e Obra para: {j['nome']} (Origem: Imagem WhatsApp)")
    employees_data.append({
        "matricula": j["mat"],
        "raw_name": j["nome"],
        "centro_custo": "N/A",
        "obra": "N/A",
        "empresa": "N/A",
        "admissao": jpeg_dates[i],
        "original_line": ""
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
            "matricula": "N/A",
            "centro_custo": "N/A",
            "obra": "N/A",
            "empresa": "N/A",
            "admissao": "N/A"
        })

sql_output_file = r"C:\Users\ACPO Empreendimentos\.gemini\antigravity\brain\cdabee16-7d60-4be9-9d46-c848215f92a7\.system_generated\steps\65\output.txt"
with open(sql_output_file, 'r', encoding='utf-8') as f:
    content = f.read()

try:
    json_str_match = re.search(r'<untrusted-data-[^>]+>\n(.*)\n</untrusted-data-', content, re.DOTALL)
    if not json_str_match:
        json_obj = json.loads(content)
        db_employees = json.loads(json_obj['result'])
    else:
        json_str = json_str_match.group(1)
        db_employees = json.loads(json_str)
except:
    try:
        data = json.loads(content)
        result_str = data.get("result", "")
        json_str_match = re.search(r'<untrusted-data-[^>]+>\n(.*)\n</untrusted-data-', result_str, re.DOTALL)
        if json_str_match:
             db_employees = json.loads(json_str_match.group(1))
        else:
             db_employees = []
    except:
        db_employees = []

db_active_names = []
db_inactive_names = []
for emp in db_employees:
    name = emp.get('name', '')
    if not name: continue
    full_name = str(name).strip().lower()
    
    status = str(emp.get('status', '')).strip().lower()
    if status == 'ativo':
        db_active_names.append(full_name)
    else:
        db_inactive_names.append(full_name)

missing_or_inactive_in_db = []
for emp in rich_employees:
    name = emp['name']
    name_clean = name.lower()
    
    matched = False
    for db_name in db_active_names:
        if name_clean in db_name or db_name in name_clean:
            matched = True
            break
            
    if not matched:
        is_inactive = False
        for db_name in db_inactive_names:
            if name_clean in db_name or db_name in name_clean:
                is_inactive = True
                break
        
        emp['status'] = "INATIVO" if is_inactive else "NÃO ENCONTRADO"
        missing_or_inactive_in_db.append(emp)

md = """# Relatório Detalhado de Divergências

> [!NOTE]
> Este relatório exibe os colaboradores listados nos arquivos, mas que constam como inativos ou não encontrados no Supabase.

## Alertas de Informações Faltantes
"""

missing_cc_set = set(missing_cc_alerts)
if missing_cc_set:
    for alert in sorted(list(missing_cc_set)):
        md += f"- {alert}\n"
else:
    md += "- Todos os colaboradores possuem Centro de Custo atribuído.\n"

md += """
> [!WARNING]
> O arquivo `Empregados.pdf LIFE E SOLANAS.pdf` não contém a coluna de Admissão, portanto a admissão aparecerá como N/A para os colaboradores desta empresa.

## Lista de Divergências

| Matrícula | Nome | Empresa | Centro de Custo | Obra | Admissão | Status BD |
|-----------|------|---------|-----------------|------|----------|-----------|
"""

for item in sorted(missing_or_inactive_in_db, key=lambda x: x['name']):
    md += f"| {item['matricula']} | {item['name'].title()} | {item['empresa']} | {item['centro_custo']} | {item['obra']} | {item['admissao']} | {item['status']} |\n"

with open(r'C:\Users\ACPO Empreendimentos\.gemini\antigravity\brain\cdabee16-7d60-4be9-9d46-c848215f92a7\divergencias_arquivos_detalhado.md', 'w', encoding='utf-8') as f:
    f.write(md)

print("Updated artifact successfully.")
