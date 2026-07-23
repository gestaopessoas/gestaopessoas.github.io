import json
import os

with open("src/data/teadi_norms.json", "r", encoding="utf-8") as f:
    data = json.load(f)

tables = data.get("tables", [])

tables.append({
    "table_number": 48,
    "title": "Normas do TEADI para a população geral da Bahia",
    "columns": ["Pontuação no TEADI"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Pontuação no TEADI": -26}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Pontuação no TEADI": 38}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Pontuação no TEADI": 49}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Pontuação no TEADI": 63}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Pontuação no TEADI": 72}},
        {"classificacao": "Médio Inferior", "percentil": 25, "scores": {"Pontuação no TEADI": 78}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Pontuação no TEADI": 87}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Pontuação no TEADI": 92}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Pontuação no TEADI": 98}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Pontuação no TEADI": 103}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Pontuação no TEADI": 108}},
        {"classificacao": "Médio Superior", "percentil": 55, "scores": {"Pontuação no TEADI": 112}},
        {"classificacao": "Médio Superior", "percentil": 60, "scores": {"Pontuação no TEADI": 118}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Pontuação no TEADI": 122}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Pontuação no TEADI": 128}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Pontuação no TEADI": 132}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Pontuação no TEADI": 139}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Pontuação no TEADI": 146}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Pontuação no TEADI": 155}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Pontuação no TEADI": 167}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Pontuação no TEADI": 176}}
    ]
})

tables.append({
    "table_number": 49,
    "title": "Normas do TEADI para a população geral da Bahia por faixa etária",
    "columns": ["Até 25 anos", "26 a 33 anos", "34 a 39 anos", "40 a 46 anos", "47 anos ou mais"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Até 25 anos": 9, "26 a 33 anos": 7, "34 a 39 anos": -39, "40 a 46 anos": -48, "47 anos ou mais": -93}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Até 25 anos": 51, "26 a 33 anos": 49, "34 a 39 anos": -9, "40 a 46 anos": -26, "47 anos ou mais": -43}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Até 25 anos": 70, "26 a 33 anos": 59, "34 a 39 anos": 41, "40 a 46 anos": 22, "47 anos ou mais": 12}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Até 25 anos": 79, "26 a 33 anos": 67, "34 a 39 anos": 44, "40 a 46 anos": 25, "47 anos ou mais": 23}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Até 25 anos": 90, "26 a 33 anos": 75, "34 a 39 anos": 52, "40 a 46 anos": 42, "47 anos ou mais": 37}},
        {"classificacao": "Médio Inferior", "percentil": 25, "scores": {"Até 25 anos": 94, "26 a 33 anos": 80, "34 a 39 anos": 64, "40 a 46 anos": 47, "47 anos ou mais": 39}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Até 25 anos": 101, "26 a 33 anos": 85, "34 a 39 anos": 70, "40 a 46 anos": 49, "47 anos ou mais": 40}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Até 25 anos": 105, "26 a 33 anos": 89, "34 a 39 anos": 75, "40 a 46 anos": 53, "47 anos ou mais": 41}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Até 25 anos": 109, "26 a 33 anos": 94, "34 a 39 anos": 83, "40 a 46 anos": 62, "47 anos ou mais": 45}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Até 25 anos": 114, "26 a 33 anos": 101, "34 a 39 anos": 89, "40 a 46 anos": 64, "47 anos ou mais": 49}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Até 25 anos": 119, "26 a 33 anos": 105, "34 a 39 anos": 96, "40 a 46 anos": 65, "47 anos ou mais": 53}},
        {"classificacao": "Médio Superior", "percentil": 55, "scores": {"Até 25 anos": 124, "26 a 33 anos": 112, "34 a 39 anos": 102, "40 a 46 anos": 72, "47 anos ou mais": 63}},
        {"classificacao": "Médio Superior", "percentil": 60, "scores": {"Até 25 anos": 128, "26 a 33 anos": 113, "34 a 39 anos": 110, "40 a 46 anos": 76, "47 anos ou mais": 71}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Até 25 anos": 133, "26 a 33 anos": 118, "34 a 39 anos": 115, "40 a 46 anos": 85, "47 anos ou mais": 73}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Até 25 anos": 138, "26 a 33 anos": 121, "34 a 39 anos": 119, "40 a 46 anos": 95, "47 anos ou mais": 76}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Até 25 anos": 143, "26 a 33 anos": 126, "34 a 39 anos": 124, "40 a 46 anos": 102, "47 anos ou mais": 83}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Até 25 anos": 147, "26 a 33 anos": 130, "34 a 39 anos": 128, "40 a 46 anos": 106, "47 anos ou mais": 99}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Até 25 anos": 153, "26 a 33 anos": 136, "34 a 39 anos": 133, "40 a 46 anos": 117, "47 anos ou mais": 112}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Até 25 anos": 161, "26 a 33 anos": 151, "34 a 39 anos": 146, "40 a 46 anos": 140, "47 anos ou mais": 120}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Até 25 anos": 169, "26 a 33 anos": 166, "34 a 39 anos": 158, "40 a 46 anos": 152, "47 anos ou mais": 140}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Até 25 anos": 177, "26 a 33 anos": 175, "34 a 39 anos": 173, "40 a 46 anos": 170, "47 anos ou mais": 167}}
    ]
})

tables.append({
    "table_number": 50,
    "title": "Normas do TEADI para a população geral da Bahia por escolaridade",
    "columns": ["Fundamental", "Médio", "Superior"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Fundamental": -87, "Médio": 13, "Superior": 52}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Fundamental": 11, "Médio": 49, "Superior": 83}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Fundamental": 31, "Médio": 64, "Superior": 93}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Fundamental": 40, "Médio": 71, "Superior": 100}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Fundamental": 44, "Médio": 77, "Superior": 106}},
        {"classificacao": "Médio Inferior", "percentil": 25, "scores": {"Fundamental": 49, "Médio": 84, "Superior": 114}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Fundamental": 58, "Médio": 88, "Superior": 119}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Fundamental": 63, "Médio": 94, "Superior": 122}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Fundamental": 72, "Médio": 98, "Superior": 124}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Fundamental": 76, "Médio": 103, "Superior": 128}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Fundamental": 86, "Médio": 109, "Superior": 131}},
        {"classificacao": "Médio Superior", "percentil": 55, "scores": {"Fundamental": 94, "Médio": 113, "Superior": 134}},
        {"classificacao": "Médio Superior", "percentil": 60, "scores": {"Fundamental": 99, "Médio": 118, "Superior": 137}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Fundamental": 104, "Médio": 123, "Superior": 141}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Fundamental": 109, "Médio": 128, "Superior": 145}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Fundamental": 112, "Médio": 133, "Superior": 147}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Fundamental": 116, "Médio": 142, "Superior": 155}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Fundamental": 121, "Médio": 151, "Superior": 164}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Fundamental": 132, "Médio": 158, "Superior": 174}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Fundamental": 138, "Médio": 167, "Superior": 176}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Fundamental": 146, "Médio": 175, "Superior": 180}}
    ]
})

tables.append({
    "table_number": 51,
    "title": "Normas do TEADI para a população geral de Mato Grosso do Sul",
    "columns": ["Pontuação no TEADI"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Pontuação no TEADI": 7}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Pontuação no TEADI": 41}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Pontuação no TEADI": 62}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Pontuação no TEADI": 74}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Pontuação no TEADI": 86}},
        {"classificacao": "Médio Inferior", "percentil": 25, "scores": {"Pontuação no TEADI": 94}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Pontuação no TEADI": 102}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Pontuação no TEADI": 108}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Pontuação no TEADI": 113}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Pontuação no TEADI": 119}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Pontuação no TEADI": 123}},
        {"classificacao": "Médio Superior", "percentil": 55, "scores": {"Pontuação no TEADI": 127}},
        {"classificacao": "Médio Superior", "percentil": 60, "scores": {"Pontuação no TEADI": 134}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Pontuação no TEADI": 139}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Pontuação no TEADI": 144}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Pontuação no TEADI": 150}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Pontuação no TEADI": 155}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Pontuação no TEADI": 162}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Pontuação no TEADI": 167}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Pontuação no TEADI": 174}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Pontuação no TEADI": 180}}
    ]
})

data["tables"] = tables

with open("src/data/teadi_norms.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("TEADI norms part 2 saved.")
