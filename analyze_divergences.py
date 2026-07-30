import os
import json
import pandas as pd
import unicodedata
import re

def normalize(text):
    if pd.isna(text) or text is None:
        return ""
    text = str(text).strip().upper()
    return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

csv_path = r'C:\Users\ACPO Empreendimentos\Desktop\Importar dados\Json Colaboradores\colaboradores_solides.csv'
df = pd.read_csv(csv_path, encoding='utf-8-sig')

supabase_out = r'C:\Users\ACPO Empreendimentos\.gemini\antigravity\brain\81153a33-e7e6-4669-b0aa-c7994ab6c183\.system_generated\steps\255\output.txt'

with open(supabase_out, 'r', encoding='utf-8') as f:
    raw_data = f.read()

try:
    mcp_output = json.loads(raw_data)
    result_str = mcp_output.get("result", "")
    start = result_str.find('[')
    end = result_str.rfind(']')
    if start != -1 and end != -1:
        json_str = result_str[start:end+1]
        db_employees = json.loads(json_str)
    else:
        db_employees = []
except Exception as e:
    db_employees = []

db_map = {normalize(emp['name']): emp for emp in db_employees if emp.get('name')}

report = []
report.append("# Relatório Analítico de Divergências de Cadastro\n")
report.append("Este relatório cruza os dados extraídos da plataforma Sólides com os dados presentes no banco de dados Supabase para os colaboradores correspondentes.\n")

missing_data_db = []
divergences = []

def clean_phone(phone):
    if not phone or pd.isna(phone): return ""
    return re.sub(r'\D', '', str(phone))

def clean_str(val):
    if pd.isna(val) or val is None: return ""
    return str(val).strip().upper()

for idx, row in df.iterrows():
    name_norm = normalize(row.get('NOME_COMPLETO', ''))
    db_emp = db_map.get(name_norm)
    
    if not db_emp:
        continue
    
    emp_name = row.get('NOME_COMPLETO', '')
    
    # Extract CSV fields
    csv_email = clean_str(row.get('EMAIL', ''))
    csv_phone = clean_phone(row.get('TELEFONE', ''))
    csv_role = clean_str(row.get('CARGO_NOME', ''))
    csv_profile = clean_str(row.get('CODIGO_PERFIL', ''))
    csv_mat = clean_str(row.get('MATRÍCULA', ''))
    
    # Extract DB fields
    db_email_corp = clean_str(db_emp.get('email_corporate', ''))
    db_email_pers = clean_str(db_emp.get('email_personal', ''))
    db_phone = clean_phone(db_emp.get('phone', ''))
    db_role = clean_str(db_emp.get('role', ''))
    db_profile = clean_str(db_emp.get('profile_code', ''))
    db_mat = clean_str(db_emp.get('registration_number', ''))
    
    # Checks for missing in DB where CSV has data
    missing_fields = []
    if csv_email and not db_email_corp and not db_email_pers:
        missing_fields.append(f"Email (CSV: {csv_email})")
    if csv_phone and not db_phone:
        missing_fields.append(f"Telefone (CSV: {csv_phone})")
    # if csv_role and not db_role:
    #     missing_fields.append(f"Cargo (CSV: {csv_role})")
    if csv_profile and not db_profile:
        missing_fields.append(f"Perfil (CSV: {csv_profile})")
    # if csv_mat and not db_mat:
    #     missing_fields.append(f"Matrícula (CSV: {csv_mat})")
        
    if missing_fields:
        missing_data_db.append(f"**{emp_name}** - Faltando: " + ", ".join(missing_fields))
        
    # Checks for divergences (both have data but differ)
    div_fields = []
    if csv_email and db_email_corp and db_email_pers:
        if csv_email != db_email_corp and csv_email != db_email_pers:
            div_fields.append(f"Email (DB: {db_email_corp} / {db_email_pers} | CSV: {csv_email})")
    elif csv_email and db_email_corp and csv_email != db_email_corp:
        div_fields.append(f"Email (DB: {db_email_corp} | CSV: {csv_email})")
    elif csv_email and db_email_pers and csv_email != db_email_pers:
        div_fields.append(f"Email (DB: {db_email_pers} | CSV: {csv_email})")
        
    if csv_phone and db_phone and csv_phone != db_phone:
        div_fields.append(f"Telefone (DB: {db_phone} | CSV: {csv_phone})")
    # if csv_role and db_role and csv_role != db_role:
    #     div_fields.append(f"Cargo (DB: {db_role} | CSV: {csv_role})")
    if csv_profile and db_profile and csv_profile != db_profile:
        div_fields.append(f"Perfil (DB: {db_profile} | CSV: {csv_profile})")
    # if csv_mat and db_mat and csv_mat != db_mat:
    #     div_fields.append(f"Matrícula (DB: {db_mat} | CSV: {csv_mat})")
        
    if div_fields:
        divergences.append(f"**{emp_name}**:\n" + "\n".join([f"  - {d}" for d in div_fields]))


report.append(f"## 1. Dados Ausentes no Banco de Dados ({len(missing_data_db)})\n")
report.append("Informações que existem na Sólides (CSV), mas que estão em branco ou nulas no nosso banco de dados Supabase.\n")
if missing_data_db:
    for m in missing_data_db:
        report.append("- " + m)
else:
    report.append("*Nenhum dado ausente.*")
    
report.append(f"\n## 2. Divergências de Informações ({len(divergences)})\n")
report.append("Informações preenchidas em ambos os lugares, porém com valores conflitantes.\n")
if divergences:
    for d in divergences:
        report.append("- " + d)
else:
    report.append("*Nenhuma divergência.*")

with open('report_out.md', 'w', encoding='utf-8') as f:
    f.write("\n".join(report))
