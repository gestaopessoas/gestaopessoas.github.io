import json
import re

json_file = r'C:\Users\ACPO Empreendimentos\Desktop\Importar dados\Json Colaboradores\Colaborador_1307182.json'
with open(json_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

html = data.get('html_principal', '')
links = re.findall(r'href=[\"\'](/[^\'\"]+1307182[^\'\"]*)[\"\']', html)
print(set(links))
