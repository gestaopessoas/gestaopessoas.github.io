import json
import os

with open("src/data/tealt_norms.json", "r", encoding="utf-8") as f:
    data = json.load(f)

tables = data.get("tables", [])

tables.append({
    "table_number": 66,
    "title": "Normas do TEALT para a população geral por faixa etária",
    "columns": ["Até 22 anos", "23 a 30 anos", "31 a 37 anos", "38 a 44 anos", "45 anos ou mais"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Até 22 anos": 24, "23 a 30 anos": -23, "31 a 37 anos": -94, "38 a 44 anos": -98, "45 anos ou mais": -118}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Até 22 anos": 56, "23 a 30 anos": 43, "31 a 37 anos": 25, "38 a 44 anos": 21, "45 anos ou mais": -11}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Até 22 anos": 68, "23 a 30 anos": 54, "31 a 37 anos": 45, "38 a 44 anos": 40, "45 anos ou mais": 26}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Até 22 anos": 76, "23 a 30 anos": 61, "31 a 37 anos": 53, "38 a 44 anos": 48, "45 anos ou mais": 39}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Até 22 anos": 80, "23 a 30 anos": 68, "31 a 37 anos": 58, "38 a 44 anos": 51, "45 anos ou mais": 45}},
        {"classificacao": "Inferior", "percentil": 25, "scores": {"Até 22 anos": 84, "23 a 30 anos": 72, "31 a 37 anos": 61, "38 a 44 anos": 56, "45 anos ou mais": 49}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Até 22 anos": 88, "23 a 30 anos": 78, "31 a 37 anos": 66, "38 a 44 anos": 59, "45 anos ou mais": 54}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Até 22 anos": 92, "23 a 30 anos": 81, "31 a 37 anos": 70, "38 a 44 anos": 63, "45 anos ou mais": 56}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Até 22 anos": 97, "23 a 30 anos": 86, "31 a 37 anos": 73, "38 a 44 anos": 66, "45 anos ou mais": 59}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Até 22 anos": 99, "23 a 30 anos": 88, "31 a 37 anos": 76, "38 a 44 anos": 72, "45 anos ou mais": 64}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Até 22 anos": 102, "23 a 30 anos": 94, "31 a 37 anos": 80, "38 a 44 anos": 75, "45 anos ou mais": 69}},
        {"classificacao": "Médio", "percentil": 55, "scores": {"Até 22 anos": 105, "23 a 30 anos": 98, "31 a 37 anos": 84, "38 a 44 anos": 80, "45 anos ou mais": 72}},
        {"classificacao": "Médio", "percentil": 60, "scores": {"Até 22 anos": 108, "23 a 30 anos": 102, "31 a 37 anos": 89, "38 a 44 anos": 83, "45 anos ou mais": 74}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Até 22 anos": 112, "23 a 30 anos": 105, "31 a 37 anos": 96, "38 a 44 anos": 87, "45 anos ou mais": 78}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Até 22 anos": 118, "23 a 30 anos": 110, "31 a 37 anos": 100, "38 a 44 anos": 91, "45 anos ou mais": 83}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Até 22 anos": 122, "23 a 30 anos": 113, "31 a 37 anos": 104, "38 a 44 anos": 96, "45 anos ou mais": 88}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Até 22 anos": 124, "23 a 30 anos": 119, "31 a 37 anos": 110, "38 a 44 anos": 102, "45 anos ou mais": 92}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Até 22 anos": 125, "23 a 30 anos": 122, "31 a 37 anos": 114, "38 a 44 anos": 110, "45 anos ou mais": 96}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Até 22 anos": 126, "23 a 30 anos": 123, "31 a 37 anos": 118, "38 a 44 anos": 113, "45 anos ou mais": 104}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Até 22 anos": 127, "23 a 30 anos": 126, "31 a 37 anos": 122, "38 a 44 anos": 118, "45 anos ou mais": 111}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Até 22 anos": 128, "23 a 30 anos": 128, "31 a 37 anos": 126, "38 a 44 anos": 122, "45 anos ou mais": 112}}
    ]
})

tables.append({
    "table_number": 67,
    "title": "Normas do TEALT para a população geral por escolaridade",
    "columns": ["Fundamental", "Médio", "Superior"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Fundamental": -110, "Médio": -1, "Superior": -44}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Fundamental": 36, "Médio": 48, "Superior": 61}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Fundamental": 45, "Médio": 57, "Superior": 73}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Fundamental": 50, "Médio": 65, "Superior": 80}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Fundamental": 54, "Médio": 71, "Superior": 86}},
        {"classificacao": "Inferior", "percentil": 25, "scores": {"Fundamental": 57, "Médio": 75, "Superior": 91}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Fundamental": 61, "Médio": 79, "Superior": 97}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Fundamental": 64, "Médio": 82, "Superior": 101}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Fundamental": 69, "Médio": 86, "Superior": 103}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Fundamental": 72, "Médio": 89, "Superior": 106}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Fundamental": 75, "Médio": 93, "Superior": 110}},
        {"classificacao": "Médio", "percentil": 55, "scores": {"Fundamental": 80, "Médio": 98, "Superior": 113}},
        {"classificacao": "Médio", "percentil": 60, "scores": {"Fundamental": 83, "Médio": 101, "Superior": 118}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Fundamental": 87, "Médio": 104, "Superior": 120}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Fundamental": 94, "Médio": 107, "Superior": 122}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Fundamental": 98, "Médio": 112, "Superior": 123}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Fundamental": 103, "Médio": 117, "Superior": 124}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Fundamental": 112, "Médio": 122, "Superior": 125}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Fundamental": 122, "Médio": 126, "Superior": 126}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Fundamental": 127, "Médio": 127, "Superior": 127}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Fundamental": 128, "Médio": 128, "Superior": 128}}
    ]
})

tables.append({
    "table_number": 68,
    "title": "Normas do TEALT para a população geral da Bahia (N = 497)",
    "columns": ["Pontuação no TEALT"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Pontuação no TEALT": -122}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Pontuação no TEALT": -29}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Pontuação no TEALT": 36}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Pontuação no TEALT": 49}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Pontuação no TEALT": 57}},
        {"classificacao": "Inferior", "percentil": 25, "scores": {"Pontuação no TEALT": 66}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Pontuação no TEALT": 72}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Pontuação no TEALT": 77}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Pontuação no TEALT": 82}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Pontuação no TEALT": 86}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Pontuação no TEALT": 92}},
        {"classificacao": "Médio", "percentil": 55, "scores": {"Pontuação no TEALT": 96}},
        {"classificacao": "Médio", "percentil": 60, "scores": {"Pontuação no TEALT": 100}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Pontuação no TEALT": 104}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Pontuação no TEALT": 109}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Pontuação no TEALT": 113}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Pontuação no TEALT": 120}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Pontuação no TEALT": 123}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Pontuação no TEALT": 126}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Pontuação no TEALT": 127}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Pontuação no TEALT": 128}}
    ]
})

data["tables"] = tables

with open("src/data/tealt_norms.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("TEALT norms part 2 saved.")
