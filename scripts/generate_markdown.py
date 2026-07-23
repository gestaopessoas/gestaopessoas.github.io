import json
import pandas as pd
import glob
import os
import unicodedata

def normalize_str(s):
    if pd.isna(s) or not isinstance(s, str): return ""
    s = str(s).strip().upper()
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

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
            if "DIRECT" in normalize_str(cname) and "DIRECT" in ccn: ccname = cc['name']
            if "LOTEAMENTO" in normalize_str(cname) and "JOY" in ccn: ccname = cc['name']
            if "LIFE" in normalize_str(cname) and "LIFE" in ccn: ccname = cc['name']
            if "CONNECT" in normalize_str(cname) and "CONNECT" in ccn: ccname = cc['name']
            if "MOOV" in normalize_str(cname) and "MOOV" in ccn and "2 ATO" not in ccn: ccname = cc['name']
            if "CONSTRUTORA ACPO" in normalize_str(cname) and "MATRIZ" in ccn: ccname = cc['name']
            
    return cname, ccname

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
            cname, ccname = get_company_info(company_name_file)
            
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
                        'company_name': cname,
                        'cost_center_name': ccname
                    })
    except Exception as e:
        pass

with open("analysis_146.json", "r", encoding="utf-8") as f:
    analysis = json.load(f)
novos = analysis.get("novos", [])

md_lines = []
md_lines.append("# Revisão de Colaboradores Ausentes - Detalhado")
md_lines.append("\nConforme solicitado, adicionei as colunas de **Centro de Custo**, **Data de Admissão** e **Matrícula** para a sua revisão final.")
md_lines.append("\n> [!WARNING]")
md_lines.append("> **Atenção aos 24 colaboradores marcados com (FALTAM DADOS):** Eles constam nas imagens/PDFs (ex: Matriz WhatsApp) mas **não estão** nas planilhas de Controle Excel. Por isso, não consegui extrair as datas de admissão e matrículas deles. Eles serão inseridos sem essas informações, a menos que você queira atualizar depois.\n")
md_lines.append("| Nome | Empresa | Centro de Custo | Matrícula | Admissão |")
md_lines.append("|---|---|---|---|---|")

for n in novos:
    nome = n['nome']
    ex_emp = next((e for e in excel_employees if e['nome'] == nome), None)
    
    if ex_emp:
        mat = ex_emp['matricula'] or 'N/A'
        adm = ex_emp['admissao'] or 'N/A'
        emp = ex_emp['company_name'] or 'N/A'
        cc = ex_emp['cost_center_name'] or 'N/A'
        md_lines.append(f"| {nome} | {emp} | {cc} | {mat} | {adm} |")
    else:
        # We know they are from Matriz or missing
        md_lines.append(f"| {nome} **(FALTAM DADOS)** | CONSTRUTORA ACPO | CONSTRUTORA MATRIZ | N/A | N/A |")

with open("novos_colaboradores_aprovacao.md", "w", encoding="utf-8") as f:
    f.write("\n".join(md_lines))
