import json
from bs4 import BeautifulSoup
import os

json_file = r'C:\Users\ACPO Empreendimentos\Desktop\Importar dados\Json Colaboradores\Colaborador_1307182.json'
with open(json_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

nome = data.get('nome', 'Desconhecido')
id_colab = data.get('id', 'N/A')

soup_princ = BeautifulSoup(data.get('html_principal', ''), 'html.parser')
soup_docs = BeautifulSoup(data.get('html_documentos', ''), 'html.parser')
soup_hist = BeautifulSoup(data.get('html_historico', ''), 'html.parser')

# Tentativa de extração de campos (heurística baseada em spans/divs com textos chave)
def extract_key_value(soup, keys):
    result = {}
    for key in keys:
        # Busca um elemento que tenha o texto do campo (ex: 'Cargo:')
        label = soup.find(string=lambda t: t and key.lower() in t.lower())
        if label:
            # O valor costuma ser o próximo irmão, ou estar dentro de um elemento vizinho
            parent = label.parent
            # A heurística mais simples é pegar o texto do parent e de seus irmãos
            full_text = parent.parent.get_text(separator=' ', strip=True) if parent.parent else ""
            result[key] = full_text.replace(label.strip(), '').strip()
    return result

# Vamos extrair todos os textos para formar um MD legível para o usuário validar
md_content = f"# Teste de Extração: {nome} (ID: {id_colab})\n\n"

md_content += "## Informações Principais\n"
# Pega o cabeçalho do perfil, geralmente tem h1, h2, h3, h4
for header in soup_princ.find_all(['h1', 'h2', 'h3', 'h4', 'h5']):
    text = header.get_text(strip=True)
    if text and text.lower() not in ['sólides', 'sólides profiler', 'ajuda', 'notificações', 'pesquisar', 'opções']:
        md_content += f"- **{header.name.upper()}**: {text}\n"

md_content += "\n## Documentos Encontrados\n"
docs = soup_docs.find_all('a')
doc_count = 0
for doc in docs:
    text = doc.get_text(strip=True)
    if text and len(text) > 4:
        md_content += f"- {text}\n"
        doc_count += 1
if doc_count == 0:
    md_content += "*(Nenhum documento ou não foi possível mapear com a regra atual)*\n"

md_content += "\n## Histórico de Avaliações Encontrado\n"
# Tenta pegar tabelas ou divs com listagens
tables = soup_hist.find_all('table')
if tables:
    for tr in tables[0].find_all('tr')[:5]: # pega os primeiros 5 pra nao poluir
        tds = [td.get_text(strip=True) for td in tr.find_all(['th', 'td'])]
        if tds:
            md_content += f"- {' | '.join(tds)}\n"
else:
    # Fallback: pega parágrafos
    for p in soup_hist.find_all('p')[:10]:
        t = p.get_text(strip=True)
        if t: md_content += f"- {t}\n"

with open('teste_extracao.md', 'w', encoding='utf-8') as f:
    f.write(md_content)
    
print("MD gerado.")
