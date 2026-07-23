import json
import os

with open("src/data/tealt_norms.json", "r", encoding="utf-8") as f:
    data = json.load(f)

tables = data.get("tables", [])

tables.append({
    "table_number": 81,
    "title": "Normas do TEALT para a população geral de São Paulo por faixa etária",
    "columns": ["Até 22 anos", "23 a 30 anos", "31 a 37 anos", "38 a 44 anos", "45 anos ou mais"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Até 22 anos": 34, "23 a 30 anos": -33, "31 a 37 anos": -86, "38 a 44 anos": -92, "45 anos ou mais": -115}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Até 22 anos": 39, "23 a 30 anos": 34, "31 a 37 anos": 19, "38 a 44 anos": 36, "45 anos ou mais": 8}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Até 22 anos": 51, "23 a 30 anos": 44, "31 a 37 anos": 36, "38 a 44 anos": 46, "45 anos ou mais": 22}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Até 22 anos": 57, "23 a 30 anos": 50, "31 a 37 anos": 46, "38 a 44 anos": 51, "45 anos ou mais": 37}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Até 22 anos": 61, "23 a 30 anos": 55, "31 a 37 anos": 51, "38 a 44 anos": 54, "45 anos ou mais": 43}},
        {"classificacao": "Inferior", "percentil": 25, "scores": {"Até 22 anos": 65, "23 a 30 anos": 59, "31 a 37 anos": 54, "38 a 44 anos": 59, "45 anos ou mais": 48}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Até 22 anos": 70, "23 a 30 anos": 63, "31 a 37 anos": 59, "38 a 44 anos": 61, "45 anos ou mais": 56}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Até 22 anos": 73, "23 a 30 anos": 67, "31 a 37 anos": 61, "38 a 44 anos": 65, "45 anos ou mais": 58}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Até 22 anos": 77, "23 a 30 anos": 73, "31 a 37 anos": 65, "38 a 44 anos": 68, "45 anos ou mais": 61}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Até 22 anos": 80, "23 a 30 anos": 78, "31 a 37 anos": 73, "38 a 44 anos": 71, "45 anos ou mais": 68}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Até 22 anos": 83, "23 a 30 anos": 80, "31 a 37 anos": 76, "38 a 44 anos": 73, "45 anos ou mais": 71}},
        {"classificacao": "Médio", "percentil": 55, "scores": {"Até 22 anos": 87, "23 a 30 anos": 83, "31 a 37 anos": 79, "38 a 44 anos": 75, "45 anos ou mais": 73}},
        {"classificacao": "Médio", "percentil": 60, "scores": {"Até 22 anos": 93, "23 a 30 anos": 87, "31 a 37 anos": 81, "38 a 44 anos": 78, "45 anos ou mais": 75}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Até 22 anos": 97, "23 a 30 anos": 91, "31 a 37 anos": 83, "38 a 44 anos": 80, "45 anos ou mais": 79}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Até 22 anos": 100, "23 a 30 anos": 97, "31 a 37 anos": 86, "38 a 44 anos": 84, "45 anos ou mais": 82}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Até 22 anos": 101, "23 a 30 anos": 100, "31 a 37 anos": 89, "38 a 44 anos": 86, "45 anos ou mais": 84}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Até 22 anos": 102, "23 a 30 anos": 102, "31 a 37 anos": 95, "38 a 44 anos": 92, "45 anos ou mais": 88}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Até 22 anos": 105, "23 a 30 anos": 104, "31 a 37 anos": 98, "38 a 44 anos": 95, "45 anos ou mais": 92}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Até 22 anos": 111, "23 a 30 anos": 108, "31 a 37 anos": 102, "38 a 44 anos": 98, "45 anos ou mais": 98}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Até 22 anos": 113, "23 a 30 anos": 113, "31 a 37 anos": 109, "38 a 44 anos": 102, "45 anos ou mais": 104}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Até 22 anos": 122, "23 a 30 anos": 118, "31 a 37 anos": 116, "38 a 44 anos": 109, "45 anos ou mais": 111}}
    ]
})

tables.append({
    "table_number": 82,
    "title": "Normas do TEALT para a população geral de São Paulo por escolaridade",
    "columns": ["Fundamental", "Médio", "Superior"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Fundamental": -90, "Médio": 3, "Superior": 38}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Fundamental": 20, "Médio": 50, "Superior": 61}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Fundamental": 34, "Médio": 56, "Superior": 73}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Fundamental": 43, "Médio": 64, "Superior": 77}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Fundamental": 47, "Médio": 70, "Superior": 80}},
        {"classificacao": "Inferior", "percentil": 25, "scores": {"Fundamental": 51, "Médio": 74, "Superior": 85}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Fundamental": 55, "Médio": 78, "Superior": 89}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Fundamental": 58, "Médio": 80, "Superior": 91}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Fundamental": 60, "Médio": 84, "Superior": 97}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Fundamental": 63, "Médio": 87, "Superior": 100}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Fundamental": 68, "Médio": 89, "Superior": 102}},
        {"classificacao": "Médio", "percentil": 55, "scores": {"Fundamental": 71, "Médio": 92, "Superior": 104}},
        {"classificacao": "Médio", "percentil": 60, "scores": {"Fundamental": 75, "Médio": 97, "Superior": 107}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Fundamental": 80, "Médio": 101, "Superior": 114}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Fundamental": 84, "Médio": 103, "Superior": 112}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Fundamental": 88, "Médio": 107, "Superior": 114}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Fundamental": 99, "Médio": 112, "Superior": 119}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Fundamental": 102, "Médio": 117, "Superior": 121}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Fundamental": 112, "Médio": 123, "Superior": 122}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Fundamental": 117, "Médio": 126, "Superior": 123}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Fundamental": 126, "Médio": 127, "Superior": 125}}
    ]
})

tables.append({
    "table_number": 83,
    "title": "Normas do TEALT para a população geral de Sergipe (N = 390)",
    "columns": ["Pontuação no TEALT"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Pontuação no TEALT": -84}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Pontuação no TEALT": 63}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Pontuação no TEALT": 77}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Pontuação no TEALT": 86}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Pontuação no TEALT": 93}},
        {"classificacao": "Inferior", "percentil": 25, "scores": {"Pontuação no TEALT": 98}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Pontuação no TEALT": 104}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Pontuação no TEALT": 107}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Pontuação no TEALT": 111}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Pontuação no TEALT": 115}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Pontuação no TEALT": 118}},
        {"classificacao": "Médio", "percentil": 55, "scores": {"Pontuação no TEALT": 119}},
        {"classificacao": "Médio", "percentil": 60, "scores": {"Pontuação no TEALT": 120}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Pontuação no TEALT": 121}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Pontuação no TEALT": 122}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Pontuação no TEALT": 123}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Pontuação no TEALT": 124}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Pontuação no TEALT": 125}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Pontuação no TEALT": 126}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Pontuação no TEALT": 127}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Pontuação no TEALT": 128}}
    ]
})

tables.append({
    "table_number": 84,
    "title": "Normas do TEALT para a população geral de Sergipe por faixa etária",
    "columns": ["Até 22 anos", "23 a 30 anos", "31 a 37 anos", "38 a 44 anos", "45 anos ou mais"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Até 22 anos": -12, "23 a 30 anos": -18, "31 a 37 anos": -60, "38 a 44 anos": 60, "45 anos ou mais": 20}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Até 22 anos": 69, "23 a 30 anos": 64, "31 a 37 anos": -25, "38 a 44 anos": 62, "45 anos ou mais": 23}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Até 22 anos": 98, "23 a 30 anos": 77, "31 a 37 anos": 30, "38 a 44 anos": 66, "45 anos ou mais": 24}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Até 22 anos": 107, "23 a 30 anos": 83, "31 a 37 anos": 62, "38 a 44 anos": 68, "45 anos ou mais": 29}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Até 22 anos": 104, "23 a 30 anos": 88, "31 a 37 anos": 71, "38 a 44 anos": 76, "45 anos ou mais": 40}},
        {"classificacao": "Inferior", "percentil": 25, "scores": {"Até 22 anos": 111, "23 a 30 anos": 94, "31 a 37 anos": 83, "38 a 44 anos": 83, "45 anos ou mais": 52}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Até 22 anos": 116, "23 a 30 anos": 97, "31 a 37 anos": 88, "38 a 44 anos": 87, "45 anos ou mais": 58}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Até 22 anos": 118, "23 a 30 anos": 101, "31 a 37 anos": 93, "38 a 44 anos": 89, "45 anos ou mais": 67}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Até 22 anos": 120, "23 a 30 anos": 104, "31 a 37 anos": 108, "38 a 44 anos": 94, "45 anos ou mais": 87}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Até 22 anos": 122, "23 a 30 anos": 108, "31 a 37 anos": 110, "38 a 44 anos": 104, "45 anos ou mais": 96}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Até 22 anos": 123, "23 a 30 anos": 112, "31 a 37 anos": 115, "38 a 44 anos": 106, "45 anos ou mais": 104}},
        {"classificacao": "Médio", "percentil": 55, "scores": {"Até 22 anos": 124, "23 a 30 anos": 116, "31 a 37 anos": 117, "38 a 44 anos": 109, "45 anos ou mais": 110}},
        {"classificacao": "Médio", "percentil": 60, "scores": {"Até 22 anos": 125, "23 a 30 anos": 119, "31 a 37 anos": 119, "38 a 44 anos": 114, "45 anos ou mais": 111}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Até 22 anos": 126, "23 a 30 anos": 120, "31 a 37 anos": 121, "38 a 44 anos": 116, "45 anos ou mais": 112}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Até 22 anos": 126, "23 a 30 anos": 121, "31 a 37 anos": 122, "38 a 44 anos": 117, "45 anos ou mais": 114}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Até 22 anos": 127, "23 a 30 anos": 122, "31 a 37 anos": 124, "38 a 44 anos": 119, "45 anos ou mais": 117}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Até 22 anos": 127, "23 a 30 anos": 123, "31 a 37 anos": 126, "38 a 44 anos": 121, "45 anos ou mais": 121}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Até 22 anos": 127, "23 a 30 anos": 124, "31 a 37 anos": 126, "38 a 44 anos": 123, "45 anos ou mais": 122}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Até 22 anos": 128, "23 a 30 anos": 125, "31 a 37 anos": 126, "38 a 44 anos": 124, "45 anos ou mais": 124}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Até 22 anos": 128, "23 a 30 anos": 126, "31 a 37 anos": 127, "38 a 44 anos": 126, "45 anos ou mais": 125}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Até 22 anos": 128, "23 a 30 anos": 128, "31 a 37 anos": 127, "38 a 44 anos": 127, "45 anos ou mais": 126}}
    ]
})

data["tables"] = tables

with open("src/data/tealt_norms.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("TEALT norms part 6 saved.")
