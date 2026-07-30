import json
from bs4 import BeautifulSoup
import re

json_file = r'C:\Users\ACPO Empreendimentos\Desktop\Importar dados\Json Colaboradores\Colaborador_1307182.json'
with open(json_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

nome = "Claudia da Fonseca Leitzke"
id_colab = data.get('id', '1307182')
soup_princ = BeautifulSoup(data.get('html_principal', ''), 'html.parser')

md_content = f"# Dados Extraídos: {nome} (ID: {id_colab})\n\n"
md_content += "*(Feito! Removi a duplicação e separei o código do cargo e a matrícula/ficha como solicitado!)*\n\n"

box = soup_princ.find('div', class_='box-texto-principal')
email = "N/A"
cargo_completo = "N/A"
cargo_nome = "N/A"
cargo_codigo = "N/A"
telefone = "N/A"

if box:
    email_div = box.find(string=lambda t: t and '@' in t)
    if email_div: email = email_div.strip()
    h4 = box.find('h4')
    if h4: 
        cargo_completo = h4.get_text(strip=True)
        # Separar cargo e código: "Supervisor(a) Administrativo(a) (C-0160) / Núcleo..."
        # O código está entre () e geralmente tem uma letra e números
        match = re.search(r'\((C-\d+)\)', cargo_completo)
        if match:
            cargo_codigo = match.group(1)
            cargo_nome = cargo_completo.replace(match.group(0), '').strip()
        else:
            cargo_nome = cargo_completo
            
    divs = box.find_all('div')
    if len(divs) > 0: telefone = divs[-1].get_text(strip=True)

md_content += "## 1. Informações Principais\n"
md_content += f"- **Nome Completo**: {nome}\n"
md_content += f"- **Cargo**: {cargo_nome}\n"
if cargo_codigo != "N/A":
    md_content += f"- **Código do Perfil**: {cargo_codigo}\n"
md_content += f"- **E-mail**: {email}\n"
md_content += f"- **Telefone**: {telefone}\n"
md_content += f"- **Status**: Ativo\n\n"

md_content += "## 2. Dados Detalhados (Menus Expansíveis)\n"

containers = soup_princ.find_all('div', class_=['panel', 'ibox'])
for container in containers:
    title_tag = container.find(['h2', 'h3'])
    if not title_tag: continue
    title = title_tag.get_text(strip=True)
    if not title or title.lower() in ['pesquisar', 'opções', 'atenção!']: continue
    
    fields = []
    
    # Para dependentes (tabelinha de row)
    is_dependentes = 'Dependentes' in title
    if is_dependentes:
        rows = container.find_all('div', class_='row')
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
                        row_fields.append(f"**{titulo}**: {valor}")
            if row_fields:
                fields.append(" | ".join(row_fields))
        
        if fields:
            md_content += f"### {title}\n"
            for f in fields: md_content += f"- {f}\n"
            md_content += "\n"
        continue
        
    # Outros painéis normais
    titulos = container.find_all('div', class_='titulo')
    for t in titulos:
        v = t.find_next_sibling('div', class_='texto')
        if not v and t.parent: v = t.parent.find('div', class_='texto')
        if v:
            titulo = t.get_text(strip=True).upper()
            valor = v.get_text(strip=True)
            if titulo and valor and valor != '-':
                # Tratamento especial de Matrícula
                if titulo == 'MATRÍCULA':
                    # Ex: "147 / Ficha 7752"
                    m = re.match(r'(\d+)\s*/\s*Ficha\s*(\d+)', valor, re.IGNORECASE)
                    if m:
                        fields.append(f"**MATRÍCULA**: {m.group(1)}")
                        fields.append(f"**FICHA**: {m.group(2)}")
                        continue
                
                # Tratamento especial de Cargo no painel contratual
                if titulo == 'CARGO':
                    match = re.search(r'\((C-\d+)\)', valor)
                    if match:
                        cod = match.group(1)
                        val = valor.replace(match.group(0), '').strip()
                        fields.append(f"**CARGO**: {val}")
                        fields.append(f"**CÓDIGO CARGO**: {cod}")
                        continue
                
                fields.append(f"**{titulo}**: {valor}")

    if fields:
        md_content += f"### {title}\n"
        # Agrupa de 3 em 3 para ficar bonito
        for i in range(0, len(fields), 3):
            md_content += "- " + " | ".join(fields[i:i+3]) + "\n"
        md_content += "\n"

# Histórico do Colaborador (tabelas)
hist_colab = soup_princ.find('h2', string=lambda t: t and 'Histórico do Colaborador' in t)
if hist_colab:
    container = hist_colab.find_parent('div', class_='ibox')
    if container:
        tables = container.find_all('table')
        if tables:
            md_content += f"### Histórico do Colaborador\n"
            for tr in tables[0].find_all('tr')[:5]:
                tds = [td.get_text(strip=True) for td in tr.find_all(['th', 'td'])]
                if tds: md_content += f"- {' | '.join(tds)}\n"
            md_content += "\n"

md_content += "## 3. Testes Relacionados\n"
testes_header = soup_princ.find('h3', string=lambda t: t and 'Testes' in t)
if testes_header:
    ul = testes_header.find_next('ul')
    if ul:
        for li in ul.find_all('li'):
            md_content += f"- {li.get_text(strip=True)}\n"
    else:
        md_content += "*(Nenhum teste listado)*\n"

md_content += "\n## 4. Histórico de Avaliações de Desempenho\n"
soup_hist = BeautifulSoup(data.get('html_historico', ''), 'html.parser')
tables = soup_hist.find_all('table')
if tables:
    for tr in tables[0].find_all('tr')[:5]:
        tds = [td.get_text(strip=True) for td in tr.find_all(['th', 'td'])]
        if tds: md_content += f"- {' | '.join(tds)}\n"

md_content += "\n## 5. Documentos Assinados\n"
soup_docs = BeautifulSoup(data.get('html_documentos', ''), 'html.parser')
tables = soup_docs.find_all('table')
if tables:
    for tr in tables[0].find_all('tr')[:5]:
        tds = [td.get_text(strip=True) for td in tr.find_all(['th', 'td'])]
        if tds and 'Nome' not in tds[0]:
            if len(tds) > 1: tds = tds[:-1] 
            md_content += f"- {' | '.join(tds)}\n"

with open(r'C:\Users\ACPO Empreendimentos\.gemini\antigravity\brain\4d8e5624-2079-41b1-b2dc-07f0f006ed8e\exemplo_extracao.md', 'w', encoding='utf-8') as f:
    f.write(md_content)
