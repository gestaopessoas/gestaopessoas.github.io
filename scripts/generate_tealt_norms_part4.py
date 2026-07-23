import json
import os

with open("src/data/tealt_norms.json", "r", encoding="utf-8") as f:
    data = json.load(f)

tables = data.get("tables", [])

tables.append({
    "table_number": 73,
    "title": "Normas do TEALT para a população geral de Mato Grosso do Sul por escolaridade",
    "columns": ["Fundamental", "Médio", "Superior"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Fundamental": 0, "Médio": 8, "Superior": 11}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Fundamental": 44, "Médio": 48, "Superior": 59}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Fundamental": 50, "Médio": 66, "Superior": 62}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Fundamental": 57, "Médio": 72, "Superior": 77}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Fundamental": 64, "Médio": 76, "Superior": 83}},
        {"classificacao": "Inferior", "percentil": 25, "scores": {"Fundamental": 67, "Médio": 80, "Superior": 88}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Fundamental": 69, "Médio": 84, "Superior": 92}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Fundamental": 72, "Médio": 88, "Superior": 95}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Fundamental": 74, "Médio": 95, "Superior": 99}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Fundamental": 81, "Médio": 97, "Superior": 101}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Fundamental": 85, "Médio": 100, "Superior": 104}},
        {"classificacao": "Médio", "percentil": 55, "scores": {"Fundamental": 89, "Médio": 102, "Superior": 106}},
        {"classificacao": "Médio", "percentil": 60, "scores": {"Fundamental": 94, "Médio": 106, "Superior": 109}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Fundamental": 98, "Médio": 110, "Superior": 111}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Fundamental": 102, "Médio": 113, "Superior": 115}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Fundamental": 108, "Médio": 117, "Superior": 117}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Fundamental": 118, "Médio": 120, "Superior": 122}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Fundamental": 124, "Médio": 124, "Superior": 124}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Fundamental": 125, "Médio": 125, "Superior": 125}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Fundamental": 126, "Médio": 127, "Superior": 127}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Fundamental": 128, "Médio": 128, "Superior": 128}}
    ]
})

tables.append({
    "table_number": 74,
    "title": "Normas do TEALT para a população geral do Paraná (N = 686)",
    "columns": ["Pontuação no TEALT"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Pontuação no TEALT": -10}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Pontuação no TEALT": 41}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Pontuação no TEALT": 53}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Pontuação no TEALT": 57}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Pontuação no TEALT": 64}},
        {"classificacao": "Inferior", "percentil": 25, "scores": {"Pontuação no TEALT": 71}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Pontuação no TEALT": 74}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Pontuação no TEALT": 78}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Pontuação no TEALT": 81}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Pontuação no TEALT": 85}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Pontuação no TEALT": 89}},
        {"classificacao": "Médio", "percentil": 55, "scores": {"Pontuação no TEALT": 94}},
        {"classificacao": "Médio", "percentil": 60, "scores": {"Pontuação no TEALT": 99}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Pontuação no TEALT": 102}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Pontuação no TEALT": 106}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Pontuação no TEALT": 110}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Pontuação no TEALT": 116}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Pontuação no TEALT": 120}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Pontuação no TEALT": 124}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Pontuação no TEALT": 126}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Pontuação no TEALT": 128}}
    ]
})

tables.append({
    "table_number": 75,
    "title": "Normas do TEALT para a população geral do Paraná por faixa etária",
    "columns": ["Até 22 anos", "23 a 30 anos", "31 a 37 anos", "38 a 44 anos", "45 anos ou mais"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Até 22 anos": 23, "23 a 30 anos": -14, "31 a 37 anos": -23, "38 a 44 anos": -32, "45 anos ou mais": -61}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Até 22 anos": 61, "23 a 30 anos": 45, "31 a 37 anos": 46, "38 a 44 anos": 39, "45 anos ou mais": -2}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Até 22 anos": 73, "23 a 30 anos": 56, "31 a 37 anos": 49, "38 a 44 anos": 47, "45 anos ou mais": 20}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Até 22 anos": 77, "23 a 30 anos": 60, "31 a 37 anos": 56, "38 a 44 anos": 50, "45 anos ou mais": 25}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Até 22 anos": 80, "23 a 30 anos": 67, "31 a 37 anos": 59, "38 a 44 anos": 53, "45 anos ou mais": 42}},
        {"classificacao": "Inferior", "percentil": 25, "scores": {"Até 22 anos": 84, "23 a 30 anos": 72, "31 a 37 anos": 61, "38 a 44 anos": 57, "45 anos ou mais": 49}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Até 22 anos": 88, "23 a 30 anos": 78, "31 a 37 anos": 65, "38 a 44 anos": 59, "45 anos ou mais": 52}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Até 22 anos": 92, "23 a 30 anos": 80, "31 a 37 anos": 66, "38 a 44 anos": 61, "45 anos ou mais": 57}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Até 22 anos": 97, "23 a 30 anos": 83, "31 a 37 anos": 72, "38 a 44 anos": 64, "45 anos ou mais": 60}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Até 22 anos": 100, "23 a 30 anos": 86, "31 a 37 anos": 74, "38 a 44 anos": 69, "45 anos ou mais": 66}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Até 22 anos": 102, "23 a 30 anos": 88, "31 a 37 anos": 78, "38 a 44 anos": 73, "45 anos ou mais": 69}},
        {"classificacao": "Médio", "percentil": 55, "scores": {"Até 22 anos": 106, "23 a 30 anos": 93, "31 a 37 anos": 85, "38 a 44 anos": 75, "45 anos ou mais": 72}},
        {"classificacao": "Médio", "percentil": 60, "scores": {"Até 22 anos": 108, "23 a 30 anos": 100, "31 a 37 anos": 94, "38 a 44 anos": 80, "45 anos ou mais": 74}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Até 22 anos": 111, "23 a 30 anos": 104, "31 a 37 anos": 99, "38 a 44 anos": 83, "45 anos ou mais": 77}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Até 22 anos": 117, "23 a 30 anos": 108, "31 a 37 anos": 101, "38 a 44 anos": 88, "45 anos ou mais": 79}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Até 22 anos": 119, "23 a 30 anos": 112, "31 a 37 anos": 104, "38 a 44 anos": 93, "45 anos ou mais": 82}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Até 22 anos": 122, "23 a 30 anos": 117, "31 a 37 anos": 107, "38 a 44 anos": 102, "45 anos ou mais": 86}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Até 22 anos": 125, "23 a 30 anos": 120, "31 a 37 anos": 112, "38 a 44 anos": 109, "45 anos ou mais": 91}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Até 22 anos": 126, "23 a 30 anos": 124, "31 a 37 anos": 117, "38 a 44 anos": 116, "45 anos ou mais": 94}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Até 22 anos": 127, "23 a 30 anos": 125, "31 a 37 anos": 122, "38 a 44 anos": 122, "45 anos ou mais": 102}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Até 22 anos": 128, "23 a 30 anos": 127, "31 a 37 anos": 126, "38 a 44 anos": 126, "45 anos ou mais": 120}}
    ]
})

tables.append({
    "table_number": 76,
    "title": "Normas do TEALT para a população geral do Paraná por escolaridade",
    "columns": ["Fundamental", "Médio", "Superior"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Fundamental": -33, "Médio": 4, "Superior": 18}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Fundamental": 22, "Médio": 53, "Superior": 57}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Fundamental": 35, "Médio": 61, "Superior": 70}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Fundamental": 46, "Médio": 69, "Superior": 80}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Fundamental": 52, "Médio": 74, "Superior": 83}},
        {"classificacao": "Inferior", "percentil": 25, "scores": {"Fundamental": 55, "Médio": 77, "Superior": 86}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Fundamental": 57, "Médio": 81, "Superior": 89}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Fundamental": 61, "Médio": 85, "Superior": 98}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Fundamental": 63, "Médio": 88, "Superior": 101}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Fundamental": 68, "Médio": 93, "Superior": 104}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Fundamental": 72, "Médio": 97, "Superior": 108}},
        {"classificacao": "Médio", "percentil": 55, "scores": {"Fundamental": 75, "Médio": 101, "Superior": 111}},
        {"classificacao": "Médio", "percentil": 60, "scores": {"Fundamental": 77, "Médio": 105, "Superior": 115}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Fundamental": 80, "Médio": 107, "Superior": 118}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Fundamental": 84, "Médio": 110, "Superior": 120}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Fundamental": 87, "Médio": 114, "Superior": 122}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Fundamental": 93, "Médio": 118, "Superior": 123}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Fundamental": 101, "Médio": 122, "Superior": 124}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Fundamental": 106, "Médio": 125, "Superior": 125}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Fundamental": 118, "Médio": 126, "Superior": 127}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Fundamental": 125, "Médio": 127, "Superior": 128}}
    ]
})

data["tables"] = tables

with open("src/data/tealt_norms.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("TEALT norms part 4 saved.")
