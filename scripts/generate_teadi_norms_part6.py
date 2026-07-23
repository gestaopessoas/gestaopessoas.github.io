import json
import os

with open("src/data/teadi_norms.json", "r", encoding="utf-8") as f:
    data = json.load(f)

tables = data.get("tables", [])

tables.append({
    "table_number": 64,
    "title": "Normas do TEADI para a população geral de Sergipe por faixa etária",
    "columns": ["Até 25 anos", "26 a 33 anos", "34 a 39 anos", "40 a 46 anos", "47 anos ou mais"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Até 25 anos": -10, "26 a 33 anos": -56, "34 a 39 anos": -59, "40 a 46 anos": -59, "47 anos ou mais": -59}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Até 25 anos": 46, "26 a 33 anos": 3, "34 a 39 anos": -50, "40 a 46 anos": -59, "47 anos ou mais": -59}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Até 25 anos": 74, "26 a 33 anos": 29, "34 a 39 anos": -17, "40 a 46 anos": 17, "47 anos ou mais": -59}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Até 25 anos": 84, "26 a 33 anos": 49, "34 a 39 anos": 31, "40 a 46 anos": 22, "47 anos ou mais": -50}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Até 25 anos": 93, "26 a 33 anos": 68, "34 a 39 anos": 46, "40 a 46 anos": 26, "47 anos ou mais": -31}},
        {"classificacao": "Médio Inferior", "percentil": 25, "scores": {"Até 25 anos": 101, "26 a 33 anos": 75, "34 a 39 anos": 59, "40 a 46 anos": 50, "47 anos ou mais": -8}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Até 25 anos": 106, "26 a 33 anos": 83, "34 a 39 anos": 65, "40 a 46 anos": 55, "47 anos ou mais": -8}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Até 25 anos": 113, "26 a 33 anos": 94, "34 a 39 anos": 91, "40 a 46 anos": 61, "47 anos ou mais": 10}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Até 25 anos": 119, "26 a 33 anos": 101, "34 a 39 anos": 95, "40 a 46 anos": 65, "47 anos ou mais": 13}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Até 25 anos": 124, "26 a 33 anos": 107, "34 a 39 anos": 101, "40 a 46 anos": 70, "47 anos ou mais": 16}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Até 25 anos": 128, "26 a 33 anos": 125, "34 a 39 anos": 112, "40 a 46 anos": 78, "47 anos ou mais": 23}},
        {"classificacao": "Médio Superior", "percentil": 55, "scores": {"Até 25 anos": 132, "26 a 33 anos": 130, "34 a 39 anos": 117, "40 a 46 anos": 82, "47 anos ou mais": 34}},
        {"classificacao": "Médio Superior", "percentil": 60, "scores": {"Até 25 anos": 136, "26 a 33 anos": 138, "34 a 39 anos": 120, "40 a 46 anos": 91, "47 anos ou mais": 45}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Até 25 anos": 141, "26 a 33 anos": 141, "34 a 39 anos": 131, "40 a 46 anos": 104, "47 anos ou mais": 61}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Até 25 anos": 146, "26 a 33 anos": 145, "34 a 39 anos": 141, "40 a 46 anos": 109, "47 anos ou mais": 80}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Até 25 anos": 150, "26 a 33 anos": 147, "34 a 39 anos": 147, "40 a 46 anos": 110, "47 anos ou mais": 99}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Até 25 anos": 156, "26 a 33 anos": 153, "34 a 39 anos": 152, "40 a 46 anos": 115, "47 anos ou mais": 106}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Até 25 anos": 162, "26 a 33 anos": 158, "34 a 39 anos": 158, "40 a 46 anos": 124, "47 anos ou mais": 109}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Até 25 anos": 169, "26 a 33 anos": 163, "34 a 39 anos": 162, "40 a 46 anos": 133, "47 anos ou mais": 111}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Até 25 anos": 175, "26 a 33 anos": 171, "34 a 39 anos": 168, "40 a 46 anos": 142, "47 anos ou mais": 112}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Até 25 anos": 180, "26 a 33 anos": 177, "34 a 39 anos": 169, "40 a 46 anos": 142, "47 anos ou mais": 112}}
    ]
})

data["tables"] = tables

with open("src/data/teadi_norms.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("TEADI norms part 6 saved.")
