import json
from bs4 import BeautifulSoup

json_file = r'C:\Users\ACPO Empreendimentos\Desktop\Importar dados\Json Colaboradores\Colaborador_1307182.json'
with open(json_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

soup = BeautifulSoup(data.get('html_principal', ''), 'html.parser')

print("\n--- Procurando Blocos de Informação em html_principal ---")
# Procura elementos com classes como 'col-md-6', 'panel', 'form-group', 'control-label'
for elem in soup.find_all(['label', 'h4', 'th']):
    parent = elem.parent
    text = elem.get_text(strip=True)
    if not text: continue
    # Se for um form group, pega o valor
    val = parent.get_text(separator=' ', strip=True).replace(text, '').strip()
    if val and len(text) > 2:
        print(f"{text} -> {val}")
