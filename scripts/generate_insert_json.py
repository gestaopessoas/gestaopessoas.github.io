import json
import uuid

# Reconstruct the json data from our previous python script variables
import pandas as pd
import glob
import os
import unicodedata

def normalize_str(s):
    if pd.isna(s) or not isinstance(s, str): return ""
    s = str(s).strip().upper()
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

manual_data = {
    'ROBSON VIEIRA ABEL': ('19810', '2019-02-25'),
    'ADAO PAULO DA COSTA MAIA': ('19733', '2026-03-16'),
    'RENATO GONCALVES LEMOS': ('19540', '2025-05-05'),
    'HERNANDES LUIS CORREA CAMPOS': ('19397', '2017-08-01'),
    'CLAUDINO MELLO OLIVEIRA': ('19578', '2025-06-04'),
    'FRANCISCO CARLOS DUARTE DE DUARTE': ('19396', '2019-08-08'),
    'IVAN FRANCISCO PEDROSO MATIAS': ('19398', '2022-12-12'),
    'PATRICK MARTINS HERNANDEZ': ('19918', '2026-07-20'),
    'ANNA BEATRIZ PERCEGO': ('19915', '2026-07-15'),
    'CLAUDIO DE SOUZA MORGADO': ('19736', '2026-03-16'),
    'RANIELI FERNANDES PADILHA': ('19689', '2026-01-05'),
    'RICHAR GOMES DUTRA': ('19863', '2026-06-08'),
    'VINICIOS SILVEIRA THURMER': ('19760', '2026-04-27'),
    'JOSE WILIAN DA SILVA CORDEIRO': ('19814', '2024-02-26'),
    'JULIO CEZAR FURTADO DOS SANTOS': ('19868', '2026-06-22'),
    'MARCOS SOTTER VERGARA': ('19904', '2026-07-06'),
    'ROSA MARIA SILVEIRA DOS SANTOS': ('19879', '2026-07-01'),
    'WESLEY MORAES LEITE': ('19914', '2026-07-14'),
    'ANDRE OLIVEIRA DE SOUZA': ('83', '2025-11-18'),
    'ELISANDRO DA ROSA NOGUEZ': ('84', '2025-11-18'),
    'GIOVANA MARTINS DA SILVA': ('77', '2024-12-23'),
    'LUIZ CUNHA FILHO': ('87', '2026-02-18'),
    'ROBERTO CARLOS BARBOSA': ('60', '2024-04-24')
}

db_backup = r"C:\Users\ACPO Empreendimentos\Desktop\Nova pasta (2)\backup_gestaopessoas_2026-07-21.json"
excel_folder = r"C:\Users\ACPO Empreendimentos\Desktop\Nova pasta (2)"

with open(db_backup, 'r', encoding='utf-8') as f:
    db_data = json.load(f)

companies = db_data.get('companies', [])
cost_centers = db_data.get('cost_centers', [])

def get_company_info(name_str):
    name_str = normalize_str(name_str)
    cid = None
    cname = None
    ccid = None
    ccname = None
    
    for c in companies:
        cn = normalize_str(c['name'])
        if "DIRECT" in name_str and "DIRECT" in cn: cid = c['id']; cname = c['name']
        if "JOY" in name_str and "JOY" not in "MOOV" and "LOTEAMENTO" in cn: cid = c['id']; cname = c['name']
        if "LIFE" in name_str and "LIFE" in cn: cid = c['id']; cname = c['name']
        if "CONNECT" in name_str and "CONNECT" in cn: cid = c['id']; cname = c['name']
        if "MOOV" in name_str and "MOOV" in cn: cid = c['id']; cname = c['name']
    
    if not cid:
        for c in companies:
            if "CONSTRUTORA ACPO" in normalize_str(c['name']):
                cid = c['id']
                cname = c['name']
                break
                
    if cname:
        for cc in cost_centers:
            ccn = normalize_str(cc['name'])
            if "DIRECT" in normalize_str(cname) and "DIRECT" in ccn: ccid = cc['id']; ccname = cc['name']
            if "LOTEAMENTO" in normalize_str(cname) and "JOY" in ccn: ccid = cc['id']; ccname = cc['name']
            if "LIFE" in normalize_str(cname) and "LIFE" in ccn: ccid = cc['id']; ccname = cc['name']
            if "CONNECT" in normalize_str(cname) and "CONNECT" in ccn: ccid = cc['id']; ccname = cc['name']
            if "MOOV" in normalize_str(cname) and "MOOV" in ccn and "2 ATO" not in ccn: ccid = cc['id']; ccname = cc['name']
            if "CONSTRUTORA ACPO" in normalize_str(cname) and "MATRIZ" in ccn: ccid = cc['id']; ccname = cc['name']
            
    return cid, cname, ccid, ccname

excel_files = glob.glob(os.path.join(excel_folder, "CONTROLE*.xlsx"))
excel_employees = []

for f in excel_files:
    try:
        df_full = pd.read_excel(f, nrows=10, header=None)
        header_row = -1
        for i, row in df_full.iterrows():
            row_str = ' '.join([str(x).lower() for x in row.values])
            if 'mat' in row_str or 'cod' in row_str or 'nome' in row_str:
                header_row = i
                break
        
        if header_row != -1:
            df = pd.read_excel(f, header=header_row)
            company_name_file = str(df_full.iloc[header_row - 1, 0]) if header_row > 0 else str(df_full.iloc[0, 0])
            cid, cname, ccid, ccname = get_company_info(company_name_file)
            
            cod_col = next((c for c in df.columns if 'cod' in str(c).lower() or 'mat' in str(c).lower()), None)
            nome_col = next((c for c in df.columns if 'nome' in str(c).lower()), None)
            adm_col = next((c for c in df.columns if 'admiss' in str(c).lower()), None)
            
            if nome_col and cod_col:
                for _, row in df.iterrows():
                    nome_raw = row[nome_col]
                    if pd.isna(nome_raw): continue
                    nome = normalize_str(str(nome_raw))
                    if not nome or nome == 'NAN': continue
                        
                    cod = str(row[cod_col]).strip()
                    if cod.endswith('.0'): cod = cod[:-2]
                    if cod == 'nan': cod = ""
                    
                    adm = ""
                    adm_raw = row[adm_col] if adm_col else None
                    if not pd.isna(adm_raw):
                        if hasattr(adm_raw, 'strftime'):
                            try:
                                adm = adm_raw.strftime('%Y-%m-%d')
                            except:
                                adm = ""
                        else:
                            try:
                                adm = pd.to_datetime(adm_raw, dayfirst=True).strftime('%Y-%m-%d')
                            except:
                                adm = ""
                    
                    excel_employees.append({
                        'nome': nome,
                        'matricula': cod,
                        'admissao': adm,
                        'company_id': cid,
                        'cost_center_id': ccid,
                    })
    except Exception as e:
        pass

with open("analysis_146.json", "r", encoding="utf-8") as f:
    analysis = json.load(f)
novos = analysis.get("novos", [])

insert_data = []

for n in novos:
    nome = n['nome']
    ex_emp = next((e for e in excel_employees if e['nome'] == nome), None)
    
    if ex_emp:
        matricula = ex_emp['matricula']
        admissao = ex_emp['admissao']
        cid = ex_emp['company_id']
        ccid = ex_emp['cost_center_id']
    else:
        if nome in manual_data:
            matricula, admissao = manual_data[nome]
            cid, _, ccid, _ = get_company_info("CONSTRUTORA ACPO")
        else:
            matricula = None
            admissao = None
            cid, _, ccid, _ = get_company_info("CONSTRUTORA ACPO")
            
    db_name = "CLAUDIA DE SOUZA MORGADO" if nome == "CLAUDIO DE SOUZA MORGADO" else nome
    emp_id = str(uuid.uuid4())
    
    record = {
        "id": emp_id,
        "name": db_name,
        "registration_number": matricula if matricula else None,
        "admission_date": admissao if admissao else None,
        "company_id": cid if cid else None,
        "cost_center_id": ccid if ccid else None,
        "status": "Ativo"
    }
    insert_data.append(record)

with open("insert_141_employees.json", "w", encoding="utf-8") as f:
    json.dump(insert_data, f, ensure_ascii=False, indent=2)

print("Generated JSON data.")
