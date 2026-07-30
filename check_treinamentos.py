import json
from bs4 import BeautifulSoup
import re

json_file = r'C:\Users\ACPO Empreendimentos\Desktop\Importar dados\Json Colaboradores\Colaborador_1307182.json'
with open(json_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

soup = BeautifulSoup(data.get('html_principal', ''), 'html.parser')

print("\n=== Procurando Treinamentos e Testes ===")
for elem in soup.find_all(string=re.compile('Treinamentos|Testes', re.IGNORECASE)):
    parent = elem.parent
    if parent.name not in ['script', 'style', 'title'] and 's-title' not in parent.get('class', []):
        print(f"<{parent.name}> {elem.strip()}")
        # tenta pegar a div vizinha ou pai para ver os dados
        container = parent.find_parent('div', class_='panel')
        if container:
            print("  -> Conteúdo:", container.get_text(separator=' ', strip=True)[:100])
