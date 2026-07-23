import json
import os

with open("src/data/teadi_norms.json", "r", encoding="utf-8") as f:
    data = json.load(f)

tables = data.get("tables", [])

tables.append({
    "table_number": 56,
    "title": "Normas do TEADI para a população geral do Paraná por escolaridade",
    "columns": ["Fundamental", "Médio", "Superior"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Fundamental": -35, "Médio": -13, "Superior": 15}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Fundamental": 9, "Médio": 15, "Superior": 56}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Fundamental": 22, "Médio": 32, "Superior": 77}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Fundamental": 32, "Médio": 55, "Superior": 84}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Fundamental": 42, "Médio": 68, "Superior": 97}},
        {"classificacao": "Médio Inferior", "percentil": 25, "scores": {"Fundamental": 51, "Médio": 77, "Superior": 99}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Fundamental": 58, "Médio": 88, "Superior": 106}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Fundamental": 64, "Médio": 95, "Superior": 113}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Fundamental": 72, "Médio": 101, "Superior": 118}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Fundamental": 79, "Médio": 106, "Superior": 126}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Fundamental": 84, "Médio": 114, "Superior": 134}},
        {"classificacao": "Médio Superior", "percentil": 55, "scores": {"Fundamental": 90, "Médio": 120, "Superior": 138}},
        {"classificacao": "Médio Superior", "percentil": 60, "scores": {"Fundamental": 96, "Médio": 124, "Superior": 144}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Fundamental": 103, "Médio": 129, "Superior": 148}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Fundamental": 106, "Médio": 134, "Superior": 154}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Fundamental": 112, "Médio": 139, "Superior": 159}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Fundamental": 118, "Médio": 147, "Superior": 156}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Fundamental": 124, "Médio": 154, "Superior": 164}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Fundamental": 130, "Médio": 162, "Superior": 170}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Fundamental": 148, "Médio": 171, "Superior": 174}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Fundamental": 170, "Médio": 178, "Superior": 180}}
    ]
})

tables.append({
    "table_number": 57,
    "title": "Normas do TEADI para a população geral de Santa Catarina",
    "columns": ["Pontuação no TEADI"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Pontuação no TEADI": -47}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Pontuação no TEADI": 11}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Pontuação no TEADI": 32}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Pontuação no TEADI": 45}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Pontuação no TEADI": 55}},
        {"classificacao": "Médio Inferior", "percentil": 25, "scores": {"Pontuação no TEADI": 65}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Pontuação no TEADI": 72}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Pontuação no TEADI": 79}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Pontuação no TEADI": 88}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Pontuação no TEADI": 95}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Pontuação no TEADI": 101}},
        {"classificacao": "Médio Superior", "percentil": 55, "scores": {"Pontuação no TEADI": 106}},
        {"classificacao": "Médio Superior", "percentil": 60, "scores": {"Pontuação no TEADI": 112}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Pontuação no TEADI": 117}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Pontuação no TEADI": 125}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Pontuação no TEADI": 132}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Pontuação no TEADI": 136}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Pontuação no TEADI": 142}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Pontuação no TEADI": 151}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Pontuação no TEADI": 164}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Pontuação no TEADI": 176}}
    ]
})

tables.append({
    "table_number": 58,
    "title": "Normas do TEADI para a população geral de Santa Catarina por faixa etária",
    "columns": ["Até 25 anos", "26 a 33 anos", "34 a 39 anos", "40 a 46 anos", "47 anos ou mais"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Até 25 anos": -15, "26 a 33 anos": -47, "34 a 39 anos": -20, "40 a 46 anos": -27, "47 anos ou mais": -98}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Até 25 anos": 34, "26 a 33 anos": 10, "34 a 39 anos": -15, "40 a 46 anos": -6, "47 anos ou mais": -69}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Até 25 anos": 53, "26 a 33 anos": 15, "34 a 39 anos": 19, "40 a 46 anos": 13, "47 anos ou mais": -39}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Até 25 anos": 68, "26 a 33 anos": 25, "34 a 39 anos": 25, "40 a 46 anos": 24, "47 anos ou mais": 16}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Até 25 anos": 79, "26 a 33 anos": 36, "34 a 39 anos": 35, "40 a 46 anos": 37, "47 anos ou mais": 25}},
        {"classificacao": "Médio Inferior", "percentil": 25, "scores": {"Até 25 anos": 90, "26 a 33 anos": 54, "34 a 39 anos": 44, "40 a 46 anos": 41, "47 anos ou mais": 26}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Até 25 anos": 97, "26 a 33 anos": 60, "34 a 39 anos": 46, "40 a 46 anos": 46, "47 anos ou mais": 35}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Até 25 anos": 102, "26 a 33 anos": 65, "34 a 39 anos": 50, "40 a 46 anos": 50, "47 anos ou mais": 44}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Até 25 anos": 105, "26 a 33 anos": 69, "34 a 39 anos": 53, "40 a 46 anos": 53, "47 anos ou mais": 50}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Até 25 anos": 110, "26 a 33 anos": 73, "34 a 39 anos": 57, "40 a 46 anos": 57, "47 anos ou mais": 56}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Até 25 anos": 115, "26 a 33 anos": 82, "34 a 39 anos": 66, "40 a 46 anos": 66, "47 anos ou mais": 66}},
        {"classificacao": "Médio Superior", "percentil": 55, "scores": {"Até 25 anos": 118, "26 a 33 anos": 90, "34 a 39 anos": 69, "40 a 46 anos": 69, "47 anos ou mais": 74}},
        {"classificacao": "Médio Superior", "percentil": 60, "scores": {"Até 25 anos": 125, "26 a 33 anos": 93, "34 a 39 anos": 74, "40 a 46 anos": 74, "47 anos ou mais": 82}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Até 25 anos": 131, "26 a 33 anos": 103, "34 a 39 anos": 79, "40 a 46 anos": 79, "47 anos ou mais": 89}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Até 25 anos": 135, "26 a 33 anos": 108, "34 a 39 anos": 83, "40 a 46 anos": 83, "47 anos ou mais": 94}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Até 25 anos": 140, "26 a 33 anos": 113, "34 a 39 anos": 88, "40 a 46 anos": 88, "47 anos ou mais": 105}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Até 25 anos": 143, "26 a 33 anos": 126, "34 a 39 anos": 92, "40 a 46 anos": 92, "47 anos ou mais": 125}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Até 25 anos": 150, "26 a 33 anos": 132, "34 a 39 anos": 109, "40 a 46 anos": 109, "47 anos ou mais": 129}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Até 25 anos": 158, "26 a 33 anos": 136, "34 a 39 anos": 122, "40 a 46 anos": 122, "47 anos ou mais": 155}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Até 25 anos": 168, "26 a 33 anos": 142, "34 a 39 anos": 153, "40 a 46 anos": 153, "47 anos ou mais": 164}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Até 25 anos": 178, "26 a 33 anos": 170, "34 a 39 anos": 162, "40 a 46 anos": 162, "47 anos ou mais": 176}}
    ]
})

tables.append({
    "table_number": 59,
    "title": "Normas do TEADI para a população geral de Santa Catarina por escolaridade",
    "columns": ["Fundamental", "Médio", "Superior"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Fundamental": -88, "Médio": -15, "Superior": -1}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Fundamental": -13, "Médio": 21, "Superior": 29}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Fundamental": 11, "Médio": 45, "Superior": 56}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Fundamental": 24, "Médio": 59, "Superior": 67}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Fundamental": 33, "Médio": 66, "Superior": 72}},
        {"classificacao": "Médio Inferior", "percentil": 25, "scores": {"Fundamental": 42, "Médio": 77, "Superior": 83}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Fundamental": 48, "Médio": 83, "Superior": 98}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Fundamental": 54, "Médio": 90, "Superior": 106}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Fundamental": 62, "Médio": 96, "Superior": 114}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Fundamental": 69, "Médio": 103, "Superior": 119}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Fundamental": 72, "Médio": 107, "Superior": 122}},
        {"classificacao": "Médio Superior", "percentil": 55, "scores": {"Fundamental": 77, "Médio": 112, "Superior": 125}},
        {"classificacao": "Médio Superior", "percentil": 60, "scores": {"Fundamental": 86, "Médio": 117, "Superior": 128}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Fundamental": 92, "Médio": 126, "Superior": 130}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Fundamental": 96, "Médio": 132, "Superior": 134}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Fundamental": 102, "Médio": 137, "Superior": 139}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Fundamental": 112, "Médio": 141, "Superior": 144}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Fundamental": 117, "Médio": 147, "Superior": 153}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Fundamental": 127, "Médio": 156, "Superior": 164}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Fundamental": 142, "Médio": 167, "Superior": 172}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Fundamental": 176, "Médio": 176, "Superior": 180}}
    ]
})

data["tables"] = tables

with open("src/data/teadi_norms.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("TEADI norms part 4 saved.")
