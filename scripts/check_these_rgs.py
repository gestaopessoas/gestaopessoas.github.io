import json
import re

# Read DB Employees
sql_output_file = r"C:\Users\ACPO Empreendimentos\.gemini\antigravity\brain\cdabee16-7d60-4be9-9d46-c848215f92a7\.system_generated\steps\65\output.txt"
with open(sql_output_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Extract JSON from output
try:
    json_str_match = re.search(r'<untrusted-data-[^>]+>\n(.*)\n</untrusted-data-', content, re.DOTALL)
    if not json_str_match:
        json_obj = json.loads(content)
        db_employees = json.loads(json_obj['result'])
    else:
        json_str = json_str_match.group(1)
        db_employees = json.loads(json_str)
except Exception as e:
    try:
        data = json.loads(content)
        result_str = data.get("result", "")
        json_str_match = re.search(r'<untrusted-data-[^>]+>\n(.*)\n</untrusted-data-', result_str, re.DOTALL)
        if json_str_match:
             db_employees = json.loads(json_str_match.group(1))
        else:
             db_employees = []
    except Exception as e2:
        print("Failed to parse DB employees:", e2)
        exit(1)

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

# Read specific list
with open(r'scripts\employee_list.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    
excel_active = [line.strip() for line in lines if line.strip()]

missing_or_inactive_in_db = []
for name in excel_active:
    name_clean = name.strip().lower()
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
        if is_inactive:
            missing_or_inactive_in_db.append({"name": name.title(), "status": "INATIVO"})
        else:
            missing_or_inactive_in_db.append({"name": name.title(), "status": "NÃO ENCONTRADO"})

# Output missing to markdown
md = """# Relatório de Divergências: Novos Arquivos vs Banco de Dados

> [!NOTE]
> Este relatório compara os colaboradores extraídos dos arquivos enviados (`17072026 Empregados MOOV.pdf`, `17072026 Empregados SPECD.pdf`, `Empregados.pdf LIFE E SOLANAS.pdf` e a imagem de WhatsApp) com o banco de dados (Supabase).

## Estatísticas

- **Total de colaboradores nos arquivos**: {}
- **Divergências Encontradas**: {}

## Lista de Divergências

Estes colaboradores estão listados nos documentos fornecidos mas não estão cadastrados como **Ativos** no banco de dados.

| Nome do Colaborador | Status no Banco de Dados |
|---------------------|--------------------------|
""".format(len(excel_active), len(missing_or_inactive_in_db))

for item in sorted(missing_or_inactive_in_db, key=lambda x: x['name']):
    md += f"| {item['name']} | {item['status']} |\n"

with open(r'C:\Users\ACPO Empreendimentos\.gemini\antigravity\brain\cdabee16-7d60-4be9-9d46-c848215f92a7\divergencias_arquivos.md', 'w', encoding='utf-8') as f:
    f.write(md)

print(f"Encontradas {len(missing_or_inactive_in_db)} divergências.")
