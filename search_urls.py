import re
path = r'C:\Users\ACPO Empreendimentos\Desktop\Importar dados\Json Colaboradores\pagina_mapeamento.html'
with open(path, encoding='utf-8') as f:
    html = f.read()

# search for anything looking like an API URL for the grid/list
urls = re.findall(r'/[\w\-]+(?:/[\w\-]+)*', html)
api_urls = set([u for u in urls if 'api' in u.lower() or 'colaborador' in u.lower() or 'grid' in u.lower()])
print("Found URLs:")
for u in list(api_urls)[:30]:
    print(u)
