import json
import pandas as pd
import glob
import os
import unicodedata

def normalize_str(s):
    if pd.isna(s) or not isinstance(s, str): return ""
    s = str(s).strip().upper()
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

artifact_folder = r"C:\Users\ACPO Empreendimentos\.gemini\antigravity\brain\cdabee16-7d60-4be9-9d46-c848215f92a7"
db_backup = r"C:\Users\ACPO Empreendimentos\Desktop\Nova pasta (2)\backup_gestaopessoas_2026-07-21.json"
excel_folder = r"C:\Users\ACPO Empreendimentos\Desktop\Nova pasta (2)"

with open(db_backup, 'r', encoding='utf-8') as f:
    db_data = json.load(f)

employees = db_data.get('employees', [])
companies = db_data.get('companies', [])

def get_company_id(name_str):
    name_str = normalize_str(name_str)
    for c in companies:
        c_name = normalize_str(c['name'])
        if "DIRECT" in name_str and "DIRECT" in c_name: return c['id']
        if "JOY" in name_str and "JOY" not in "MOOV" and "LOTEAMENTO" in c_name: return c['id']
        if "LIFE" in name_str and "LIFE" in c_name: return c['id']
        if "CONNECT" in name_str and "CONNECT" in c_name: return c['id']
        if "MOOV" in name_str and "MOOV" in c_name: return c['id']
    return next((c['id'] for c in companies if "CONSTRUTORA ACPO" in normalize_str(c['name'])), None)

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
            company_name = str(df_full.iloc[header_row - 1, 0]) if header_row > 0 else str(df_full.iloc[0, 0])
            company_id = get_company_id(company_name)
            
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
                        'company_id': company_id,
                        'company_name_file': company_name
                    })
    except Exception as e:
        print(f"Error reading {f}: {e}")

missing_data_names = [
    "CLAUDIANE RAFAELA CARVALHO DA ROCHA",
    "DILSILENE ROSA DA FONSECA",
    "EGICLEIDE DIAS SILVA",
    "JOICE PERES RAMOS",
    "LEONARDO MULLING SAINZ",
    "LUCAS MONTANO BOETEGE",
    "MAICON BORGES CARDOSO",
    "MATHEUS VARGAS ZBOROWSKI"
]

sql_statements = []
print("--- 8 ATUALIZACOES ---")
for md_name in missing_data_names:
    norm_md_name = normalize_str(md_name)
    db_emp = next((e for e in employees if normalize_str(e['name']) == norm_md_name), None)
    ex_emp = next((e for e in excel_employees if e['nome'] == norm_md_name), None)
    
    if db_emp and ex_emp:
        emp_id = db_emp['id']
        mat = ex_emp['matricula']
        adm = ex_emp['admissao']
        cid = ex_emp['company_id']
        
        sql = f"UPDATE employees SET registration_number = '{mat}'"
        if adm and adm != 'NaT':
            sql += f", admission_date = '{adm}'"
        if cid:
            sql += f", company_id = '{cid}'"
        sql += f" WHERE id = '{emp_id}';"
        sql_statements.append(sql)
        print(f"Update: {norm_md_name} -> Mat: {mat}, Adm: {adm}, CID: {cid}")
    else:
        print(f"Miss: {norm_md_name}. DB: {bool(db_emp)}, EX: {bool(ex_emp)}")

with open("update_8_employees.sql", "w", encoding="utf-8") as f:
    f.write("\n".join(sql_statements))

# For the 146 names
with open(r"C:\Users\ACPO Empreendimentos\Documents\Github\gestaopessoas.github.io\scripts\employee_list.txt", "r", encoding="utf-8") as f:
    names_178 = [normalize_str(n) for n in f.read().split('\n') if n.strip()]

missing_146 = []
for name in names_178:
    if not name: continue
    db_emp = next((e for e in employees if normalize_str(e['name']) == name), None)
    if not db_emp:
        missing_146.append({'nome': name, 'status': 'Nao encontrado'})
    elif db_emp['status'] != 'Ativo':
        missing_146.append({'nome': name, 'status': 'Inativo'})

reativar = []
novos = []

for m in missing_146:
    name = m['nome']
    status = m['status']
    
    ex_emp = next((e for e in excel_employees if e['nome'] == name), None)
    empresa = "Nao identificada (Usar Construtora)"
    if ex_emp and ex_emp['company_id']:
        comp = next((c for c in companies if c['id'] == ex_emp['company_id']), None)
        if comp: empresa = comp['name']
        
    if status == 'Inativo':
        reativar.append({'nome': name, 'empresa': empresa})
    else:
        novos.append({'nome': name, 'empresa': empresa})

with open("analysis_146.json", "w", encoding="utf-8") as f:
    json.dump({'reativar': reativar, 'novos': novos}, f, indent=2, ensure_ascii=False)

print(f"\nReativar: {len(reativar)}, Novos: {len(novos)}")
