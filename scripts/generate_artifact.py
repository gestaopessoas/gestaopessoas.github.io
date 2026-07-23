import json

with open('divergences.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

md = f"""# Relatório de Divergências: Controle RGS vs Banco de Dados

> [!NOTE]
> Este relatório compara os colaboradores que deveriam estar ativos segundo a planilha `Controle RGS.xlsx` (colaboradores que possuem registro de admissão sem demissão posterior) com o status atual na tabela `employees` do banco de dados (Supabase).

## Estatísticas

- **Ativos na Planilha**: {data['stats']['planilha_ativos']}
- **Demitidos na Planilha**: {data['stats']['planilha_demitidos']}
- **Ativos no Banco de Dados**: {data['stats']['db_ativos']}
- **Total de Divergências Encontradas**: {len(data['missing'])}

## Lista de Divergências

Abaixo estão os colaboradores que, segundo a planilha, deveriam estar **ATIVOS**, mas apresentam outro status no banco de dados.

| Nome do Colaborador | Status no Banco de Dados |
|---------------------|--------------------------|
"""

for item in data['missing']:
    md += f"| {item['name']} | {item['status']} |\n"

with open(r'C:\Users\ACPO Empreendimentos\.gemini\antigravity\brain\cdabee16-7d60-4be9-9d46-c848215f92a7\divergencias_rgs.md', 'w', encoding='utf-8') as f:
    f.write(md)

print("Artifact created.")
