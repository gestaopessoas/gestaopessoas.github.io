import re
from bs4 import BeautifulSoup

path = r'C:\Users\ACPO Empreendimentos\Desktop\Importar dados\Json Colaboradores\pagina_mapeamento.html'
with open(path, encoding='utf-8') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')

terms = [
    'Informações do Colaborador', 'PDI (Plano de Desenvolvimento Individual)', 
    'Histórico de Avaliações de Desempenho', 'Pesquisa Identificada', 
    'Documentos', 'Demonstrativos'
]

print("\n=== Atributos das Abas ===")
for term in terms:
    elem = soup.find('a', string=re.compile(term, re.IGNORECASE))
    if elem:
        print(f"ABA: {elem.text.strip()}")
        print(f"HREF: {elem.get('href')}")
        print(f"ID: {elem.get('id')}")
        print(f"ONCLICK: {elem.get('onclick')}")
        print(f"CLASS: {elem.get('class')}")
        print("---")
