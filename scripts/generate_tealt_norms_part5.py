import json
import os

with open("src/data/tealt_norms.json", "r", encoding="utf-8") as f:
    data = json.load(f)

tables = data.get("tables", [])

tables.append({
    "table_number": 77,
    "title": "Normas do TEALT para a população geral de Santa Catarina (N = 580)",
    "columns": ["Pontuação no TEALT"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Pontuação no TEALT": -60}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Pontuação no TEALT": 51}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Pontuação no TEALT": 58}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Pontuação no TEALT": 64}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Pontuação no TEALT": 68}},
        {"classificacao": "Inferior", "percentil": 25, "scores": {"Pontuação no TEALT": 73}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Pontuação no TEALT": 78}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Pontuação no TEALT": 80}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Pontuação no TEALT": 84}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Pontuação no TEALT": 87}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Pontuação no TEALT": 91}},
        {"classificacao": "Médio", "percentil": 55, "scores": {"Pontuação no TEALT": 96}},
        {"classificacao": "Médio", "percentil": 60, "scores": {"Pontuação no TEALT": 100}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Pontuação no TEALT": 104}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Pontuação no TEALT": 107}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Pontuação no TEALT": 115}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Pontuação no TEALT": 120}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Pontuação no TEALT": 126}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Pontuação no TEALT": 127}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Pontuação no TEALT": 127}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Pontuação no TEALT": 128}}
    ]
})

tables.append({
    "table_number": 78,
    "title": "Normas do TEALT para a população geral de Santa Catarina por faixa etária",
    "columns": ["Até 22 anos", "23 a 30 anos", "31 a 37 anos", "38 a 44 anos", "45 anos ou mais"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Até 22 anos": 13, "23 a 30 anos": 8, "31 a 37 anos": -36, "38 a 44 anos": -118, "45 anos ou mais": -119}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Até 22 anos": 43, "23 a 30 anos": 50, "31 a 37 anos": 48, "38 a 44 anos": 22, "45 anos ou mais": -24}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Até 22 anos": 51, "23 a 30 anos": 64, "31 a 37 anos": 55, "38 a 44 anos": 41, "45 anos ou mais": 18}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Até 22 anos": 64, "23 a 30 anos": 71, "31 a 37 anos": 58, "38 a 44 anos": 49, "45 anos ou mais": 37}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Até 22 anos": 76, "23 a 30 anos": 80, "31 a 37 anos": 59, "38 a 44 anos": 56, "45 anos ou mais": 42}},
        {"classificacao": "Inferior", "percentil": 25, "scores": {"Até 22 anos": 80, "23 a 30 anos": 84, "31 a 37 anos": 60, "38 a 44 anos": 61, "45 anos ou mais": 52}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Até 22 anos": 84, "23 a 30 anos": 88, "31 a 37 anos": 62, "38 a 44 anos": 64, "45 anos ou mais": 59}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Até 22 anos": 88, "23 a 30 anos": 93, "31 a 37 anos": 66, "38 a 44 anos": 68, "45 anos ou mais": 61}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Até 22 anos": 93, "23 a 30 anos": 97, "31 a 37 anos": 70, "38 a 44 anos": 72, "45 anos ou mais": 65}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Até 22 anos": 97, "23 a 30 anos": 99, "31 a 37 anos": 74, "38 a 44 anos": 74, "45 anos ou mais": 70}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Até 22 anos": 104, "23 a 30 anos": 106, "31 a 37 anos": 77, "38 a 44 anos": 78, "45 anos ou mais": 73}},
        {"classificacao": "Médio", "percentil": 55, "scores": {"Até 22 anos": 110, "23 a 30 anos": 115, "31 a 37 anos": 80, "38 a 44 anos": 81, "45 anos ou mais": 75}},
        {"classificacao": "Médio", "percentil": 60, "scores": {"Até 22 anos": 110, "23 a 30 anos": 118, "31 a 37 anos": 82, "38 a 44 anos": 84, "45 anos ou mais": 78}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Até 22 anos": 115, "23 a 30 anos": 122, "31 a 37 anos": 84, "38 a 44 anos": 87, "45 anos ou mais": 83}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Até 22 anos": 118, "23 a 30 anos": 126, "31 a 37 anos": 88, "38 a 44 anos": 88, "45 anos ou mais": 85}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Até 22 anos": 122, "23 a 30 anos": 126, "31 a 37 anos": 91, "38 a 44 anos": 93, "45 anos ou mais": 89}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Até 22 anos": 124, "23 a 30 anos": 127, "31 a 37 anos": 97, "38 a 44 anos": 97, "45 anos ou mais": 92}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Até 22 anos": 125, "23 a 30 anos": 127, "31 a 37 anos": 101, "38 a 44 anos": 101, "45 anos ou mais": 100}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Até 22 anos": 126, "23 a 30 anos": 128, "31 a 37 anos": 110, "38 a 44 anos": 118, "45 anos ou mais": 102}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Até 22 anos": 127, "23 a 30 anos": 128, "31 a 37 anos": 122, "38 a 44 anos": 122, "45 anos ou mais": 106}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Até 22 anos": 128, "23 a 30 anos": 128, "31 a 37 anos": 126, "38 a 44 anos": 127, "45 anos ou mais": 127}}
    ]
})

tables.append({
    "table_number": 79,
    "title": "Normas do TEALT para a população geral de Santa Catarina por escolaridade",
    "columns": ["Fundamental", "Médio", "Superior"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Fundamental": -120, "Médio": -9, "Superior": 54}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Fundamental": 14, "Médio": 43, "Superior": 62}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Fundamental": 40, "Médio": 52, "Superior": 69}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Fundamental": 49, "Médio": 64, "Superior": 79}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Fundamental": 53, "Médio": 70, "Superior": 80}},
        {"classificacao": "Inferior", "percentil": 25, "scores": {"Fundamental": 56, "Médio": 75, "Superior": 85}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Fundamental": 59, "Médio": 79, "Superior": 88}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Fundamental": 62, "Médio": 82, "Superior": 93}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Fundamental": 64, "Médio": 86, "Superior": 96}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Fundamental": 67, "Médio": 87, "Superior": 102}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Fundamental": 70, "Médio": 92, "Superior": 104}},
        {"classificacao": "Médio", "percentil": 55, "scores": {"Fundamental": 73, "Médio": 97, "Superior": 105}},
        {"classificacao": "Médio", "percentil": 60, "scores": {"Fundamental": 75, "Médio": 100, "Superior": 107}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Fundamental": 79, "Médio": 104, "Superior": 112}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Fundamental": 83, "Médio": 106, "Superior": 116}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Fundamental": 88, "Médio": 114, "Superior": 120}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Fundamental": 92, "Médio": 118, "Superior": 124}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Fundamental": 98, "Médio": 124, "Superior": 125}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Fundamental": 102, "Médio": 126, "Superior": 126}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Fundamental": 116, "Médio": 127, "Superior": 127}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Fundamental": 126, "Médio": 128, "Superior": 128}}
    ]
})

tables.append({
    "table_number": 80,
    "title": "Normas do TEALT para a população geral de São Paulo (N = 780)",
    "columns": ["Pontuação no TEALT"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Pontuação no TEALT": -27}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Pontuação no TEALT": 40}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Pontuação no TEALT": 51}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Pontuação no TEALT": 58}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Pontuação no TEALT": 64}},
        {"classificacao": "Inferior", "percentil": 25, "scores": {"Pontuação no TEALT": 70}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Pontuação no TEALT": 74}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Pontuação no TEALT": 78}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Pontuação no TEALT": 80}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Pontuação no TEALT": 84}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Pontuação no TEALT": 88}},
        {"classificacao": "Médio", "percentil": 55, "scores": {"Pontuação no TEALT": 91}},
        {"classificacao": "Médio", "percentil": 60, "scores": {"Pontuação no TEALT": 95}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Pontuação no TEALT": 97}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Pontuação no TEALT": 100}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Pontuação no TEALT": 103}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Pontuação no TEALT": 107}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Pontuação no TEALT": 112}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Pontuação no TEALT": 119}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Pontuação no TEALT": 123}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Pontuação no TEALT": 126}}
    ]
})

data["tables"] = tables

with open("src/data/tealt_norms.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("TEALT norms part 5 saved.")
