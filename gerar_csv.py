import os
import json
import re
import pandas as pd
from bs4 import BeautifulSoup

def process_file(json_file):
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Some JSONs might lack 'id' or other things, let's extract from filename if needed
    filename = os.path.basename(json_file)
    id_match = re.search(r'Colaborador_(\d+)\.json', filename)
    id_colab = id_match.group(1) if id_match else data.get('id', '')

    soup_princ = BeautifulSoup(data.get('html_principal', ''), 'html.parser')
    
    # Initialize dictionary for this employee
    emp_data = {
        'ID_Sistemas': id_colab,
    }
    
    # Info Principais
    box = soup_princ.find('div', class_='box-texto-principal')
    if box:
        h2 = box.find('h2')
        if h2:
            nome_div = h2.find('div', class_='texto-nome')
            if nome_div:
                emp_data['NOME_COMPLETO'] = nome_div.get_text(strip=True)
            else:
                span = h2.find('span')
                if span:
                    span.extract()
                status_div = h2.find('div', class_='status')
                if status_div:
                    status_div.extract()
                emp_data['NOME_COMPLETO'] = h2.get_text(strip=True)
            
        email_div = box.find(string=lambda t: t and '@' in t)
        if email_div:
            emp_data['EMAIL'] = email_div.strip()
            
        h4 = box.find('h4')
        if h4: 
            cargo_completo = h4.get_text(strip=True)
            match = re.search(r'\((C-\d+)\)', cargo_completo)
            if match:
                emp_data['CODIGO_PERFIL'] = match.group(1)
                emp_data['CARGO_NOME'] = cargo_completo.replace(match.group(0), '').strip()
            else:
                emp_data['CARGO_NOME'] = cargo_completo
                
        divs = box.find_all('div')
        if len(divs) > 0:
            telefone_text = divs[-1].get_text(strip=True)
            if any(char.isdigit() for char in telefone_text): # simplistic check for phone
                 emp_data['TELEFONE'] = telefone_text

    # Menus Expansíveis
    containers = soup_princ.find_all('div', class_=['panel', 'ibox'])
    for container in containers:
        title_tag = container.find(['h2', 'h3'])
        if not title_tag: continue
        title = title_tag.get_text(strip=True)
        if not title or title.lower() in ['pesquisar', 'opções', 'atenção!']: continue
        
        is_dependentes = 'Dependentes' in title
        if is_dependentes:
            rows = container.find_all('div', class_='row')
            deps = []
            for row in rows:
                row_fields = []
                titulos = row.find_all('div', class_='titulo')
                for t in titulos:
                    v = t.find_next_sibling('div', class_='texto')
                    if not v and t.parent: v = t.parent.find('div', class_='texto')
                    if v:
                        titulo = t.get_text(strip=True)
                        valor = v.get_text(strip=True)
                        if titulo and valor and valor != '-':
                            row_fields.append(f"{titulo}: {valor}")
                if row_fields:
                    deps.append(" | ".join(row_fields))
            if deps:
                emp_data['DEPENDENTES'] = "\n".join(deps)
            continue
            
        titulos = container.find_all('div', class_='titulo')
        for t in titulos:
            v = t.find_next_sibling('div', class_='texto')
            if not v and t.parent: v = t.parent.find('div', class_='texto')
            if v:
                titulo = t.get_text(strip=True).upper()
                valor = v.get_text(strip=True)
                if titulo and valor and valor != '-':
                    if titulo == 'MATRÍCULA':
                        m = re.match(r'(\d+)\s*/\s*Ficha\s*(\d+)', valor, re.IGNORECASE)
                        if m:
                            emp_data['MATRÍCULA'] = m.group(1)
                            emp_data['FICHA'] = m.group(2)
                            continue
                    if titulo == 'CARGO':
                        match = re.search(r'\((C-\d+)\)', valor)
                        if match:
                            emp_data['CÓDIGO CARGO (CONTRATUAL)'] = match.group(1)
                            emp_data['CARGO (CONTRATUAL)'] = valor.replace(match.group(0), '').strip()
                            continue
                    
                    emp_data[titulo] = valor

    # Histórico do Colaborador
    hist_colab = soup_princ.find('h2', string=lambda t: t and 'Histórico do Colaborador' in t)
    if hist_colab:
        container = hist_colab.find_parent('div', class_='ibox')
        if container:
            tables = container.find_all('table')
            if tables:
                hist_linhas = []
                for tr in tables[0].find_all('tr'):
                    tds = [td.get_text(strip=True) for td in tr.find_all(['th', 'td'])]
                    if tds: hist_linhas.append(" | ".join(tds))
                if hist_linhas:
                    emp_data['HISTÓRICO_COLABORADOR'] = "\n".join(hist_linhas)

    # Testes Relacionados
    testes_header = soup_princ.find('h3', string=lambda t: t and 'Testes' in t)
    if testes_header:
        ul = testes_header.find_next('ul')
        if ul:
            testes = []
            for li in ul.find_all('li'):
                testes.append(li.get_text(strip=True))
            if testes:
                emp_data['TESTES'] = "\n".join(testes)

    # Histórico de Avaliações de Desempenho
    soup_hist = BeautifulSoup(data.get('html_historico', ''), 'html.parser')
    tables = soup_hist.find_all('table')
    if tables:
        aval_linhas = []
        for tr in tables[0].find_all('tr'):
            tds = [td.get_text(strip=True) for td in tr.find_all(['th', 'td'])]
            if tds: aval_linhas.append(" | ".join(tds))
        if aval_linhas:
            emp_data['AVALIACOES_DESEMPENHO'] = "\n".join(aval_linhas)

    # Documentos Assinados
    soup_docs = BeautifulSoup(data.get('html_documentos', ''), 'html.parser')
    tables = soup_docs.find_all('table')
    if tables:
        doc_linhas = []
        for tr in tables[0].find_all('tr'):
            tds = [td.get_text(strip=True) for td in tr.find_all(['th', 'td'])]
            if tds and 'Nome' not in tds[0]:
                if len(tds) > 1: tds = tds[:-1] 
                doc_linhas.append(" | ".join(tds))
        if doc_linhas:
            emp_data['DOCUMENTOS_ASSINADOS'] = "\n".join(doc_linhas)
            
    return emp_data

def main():
    directory = r'C:\Users\ACPO Empreendimentos\Desktop\Importar dados\Json Colaboradores'
    
    all_data = []
    
    for filename in os.listdir(directory):
        if filename.endswith(".json") and filename.startswith("Colaborador_"):
            filepath = os.path.join(directory, filename)
            try:
                emp_data = process_file(filepath)
                all_data.append(emp_data)
                print(f"Processed: {filename}")
            except Exception as e:
                print(f"Error processing {filename}: {e}")
                
    if all_data:
        df = pd.DataFrame(all_data)
        out_csv = os.path.join(directory, 'colaboradores_solides.csv')
        out_xlsx = os.path.join(directory, 'colaboradores_solides.xlsx')
        
        df.to_csv(out_csv, index=False, encoding='utf-8-sig')
        df.to_excel(out_xlsx, index=False)
        
        print(f"\nSuccessfully exported {len(all_data)} records to:")
        print(out_csv)
        print(out_xlsx)
    else:
        print("No data extracted.")

if __name__ == '__main__':
    main()
