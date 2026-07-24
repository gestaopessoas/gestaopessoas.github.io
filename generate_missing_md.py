import subprocess
import json
import unicodedata
import re

def normalize(name):
    if not isinstance(name, str): return ""
    n = unicodedata.normalize('NFKD', name).encode('ASCII', 'ignore').decode('utf-8')
    n = n.upper().strip()
    return re.sub(r'\s+', ' ', n)

opts = {'cwd': 'C:\\Users\\ACPO Empreendimentos\\Documents\\Github\\gestaopessoas.github.io'}
cmd = 'npx supabase db query --linked "SELECT name, status FROM employees WHERE status NOT IN (\'Ativo\', \'Férias\', \'Afastado\') AND dismissed_at IS NULL" --output json'
result = subprocess.run(cmd, capture_output=True, text=True, shell=True, encoding="utf-8", errors="replace", **opts)
out = result.stdout
start = out.find('{')
parsed = json.loads(out[start:])
missing = parsed.get('rows', parsed)

missing.sort(key=lambda x: x['name'])

md = f"# Colaboradores Sem Data de Desligamento Encontrada\n\n"
md += f"Tentamos buscar a data de demissão para os {len(missing)} colaboradores desligados/inativos no arquivo `Controle RGS (1).xlsx`.\n"
md += f"No entanto, não encontramos nenhum processo de **'Demissional'** ou **'Desligamento'** para eles nesta planilha.\n\n"
md += f"Por favor, providencie as informações para estes colaboradores:\n\n"

md += "| Nome | Status |\n|---|---|\n"
for m in missing:
    md += f"| {m['name']} | {m['status']} |\n"

md_file = "C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/cdabee16-7d60-4be9-9d46-c848215f92a7/cadastros_nao_encontrados_rgs.md"
with open(md_file, "w", encoding="utf-8") as f:
    f.write(md)

print("Done")
