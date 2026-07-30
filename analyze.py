import re
import json

path = r'C:\Users\ACPO Empreendimentos\Desktop\Importar dados\Json Colaboradores\pagina_mapeamento.html'
with open(path, encoding='utf-8') as f:
    html = f.read()

# Find all hrefs
links = re.findall(r'href=[\"\'](.*?)[\"\']', html)
colab_links = [l for l in links if 'colaborador' in l.lower()]
print("Links de colaborador encontrados:")
for l in set(colab_links):
    print(l)

# Let's also look for possible employee names
# React apps usually have JSON data embedded or simple row structures
print("\nBuscando nomes que pareçam colaboradores...")
# Just as a heuristic, find things inside <td>
td_texts = re.findall(r'<td[^>]*>(.*?)</td>', html)
for text in td_texts[:10]:
    # clean HTML inside td
    clean_text = re.sub(r'<[^>]+>', '', text).strip()
    if clean_text:
        print("TD:", clean_text)
