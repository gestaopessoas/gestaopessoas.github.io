import re
from bs4 import BeautifulSoup

path = r'C:\Users\ACPO Empreendimentos\Desktop\Importar dados\Json Colaboradores\pagina_mapeamento.html'
with open(path, encoding='utf-8') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')

print("Title:", soup.title.string)

print("\nBuscando Abas (Tabs)...")
# Procure por itens que pareçam navegação ou abas (ex: div, a, li, button)
for elem in soup.find_all(string=re.compile('PDI|Histórico|Avaliações|Treinamentos|Identificada')):
    parent = elem.parent
    print(f"[{parent.name}] class='{parent.get('class', [])}': {elem.strip()}")
