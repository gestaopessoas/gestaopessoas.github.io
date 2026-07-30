import re
from bs4 import BeautifulSoup

path = r'C:\Users\ACPO Empreendimentos\Desktop\Importar dados\Json Colaboradores\pagina_mapeamento.html'
with open(path, encoding='utf-8') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')

print("=== Textos visíveis na página ===")
# Extrai textos maiores que 4 caracteres que não sejam do sidebar
texts = set()
for text in soup.stripped_strings:
    if len(text) > 4:
        texts.add(text)

for t in sorted(list(texts))[:50]:  # mostra alguns para dar uma ideia
    print(t)

print("\n=== Possíveis links/botões de ABAS ===")
# Procura elementos com role="tab" ou class com "tab"
tabs = soup.find_all(lambda tag: tag.has_attr('role') and tag['role'] == 'tab' or 'tab' in tag.get('class', []))
for tab in tabs:
    print(f"TAB: {tab.text.strip()} | Atributos: {tab.attrs}")
