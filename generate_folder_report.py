import json

with open("C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/cdabee16-7d60-4be9-9d46-c848215f92a7/scratch/folder_matches.json", "r", encoding="utf-8") as f:
    data = json.load(f)

found = data['found']
not_found = data['not_found']

found.sort(key=lambda x: x[0])
not_found.sort()

md = "# Validação de Pastas de Colaboradores Ativos\n\n"
md += f"Analisamos as pastas em `SEDE/FUNCIONARIOS` e `OBRAS/` para os {len(found) + len(not_found)} colaboradores ativos com cadastro incompleto.\n\n"
md += f"- **Pastas Encontradas:** {len(found)}\n"
md += f"- **Pastas NÃO Encontradas:** {len(not_found)}\n\n"

if len(not_found) > 0:
    md += "### ⚠️ Colaboradores SEM Pasta Encontrada (19)\n\n"
    md += "Para estes, não adiantará buscar documentos nas pastas, pois elas não foram localizadas com os nomes cadastrados:\n\n"
    for name in not_found:
        md += f"- {name}\n"
    
md += "\n---\n\n"

if len(found) > 0:
    md += "### ✅ Colaboradores COM Pasta Encontrada (175)\n\n"
    md += "Temos os caminhos para buscar os documentos destas pessoas. Abaixo uma amostra de onde eles estão localizados:\n\n"
    md += "| Colaborador | Caminho da Pasta |\n|---|---|\n"
    for item in found:
        # short path to fit nicely in markdown
        path_short = item[1].replace("C:\\Users\\ACPO Empreendimentos\\CONSTRUTORA ACPO LTDA\\CLOUD PRIVADO - Documentos\\ACPO\\", "")
        md += f"| {item[0]} | `{path_short}` |\n"

md_file = "C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/cdabee16-7d60-4be9-9d46-c848215f92a7/validacao_pastas_ativos.md"
with open(md_file, "w", encoding="utf-8") as f:
    f.write(md)

print("Markdown generated")
