import re
from bs4 import BeautifulSoup

path = r'C:\Users\ACPO Empreendimentos\Desktop\Importar dados\Json Colaboradores\pagina_mapeamento.html'
with open(path, encoding='utf-8') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')

print("Title:", soup.title.string if soup.title else "No title")

# Procurar os textos específicos
terms = [
    'Informações', 'PDI', 'Histórico', 'Avaliações', 
    'Pesquisa', 'Documentos', 'Demonstrativos', 'Treinamentos', 'Testes'
]

print("\n=== Procurando elementos relacionados às abas ===")
for term in terms:
    elems = soup.find_all(string=re.compile(term, re.IGNORECASE))
    print(f"\n--- Termo: {term} ({len(elems)} encontrados) ---")
    for elem in elems:
        parent = elem.parent
        # Ignora tags de script/style
        if parent.name in ['script', 'style', 'title']:
            continue
        if len(elem.strip()) > 3:
            print(f"<{parent.name} class='{parent.get('class', [])}'>: {elem.strip()}")
