import json
import os

with open("src/data/teadi_norms.json", "r", encoding="utf-8") as f:
    data = json.load(f)

tables = data.get("tables", [])

tables.append({
    "table_number": 60,
    "title": "Normas do TEADI para a população geral de São Paulo",
    "columns": ["Pontuação no TEADI"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Pontuação no TEADI": 4}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Pontuação no TEADI": 20}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Pontuação no TEADI": 37}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Pontuação no TEADI": 51}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Pontuação no TEADI": 63}},
        {"classificacao": "Médio Inferior", "percentil": 25, "scores": {"Pontuação no TEADI": 73}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Pontuação no TEADI": 79}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Pontuação no TEADI": 86}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Pontuação no TEADI": 92}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Pontuação no TEADI": 96}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Pontuação no TEADI": 101}},
        {"classificacao": "Médio Superior", "percentil": 55, "scores": {"Pontuação no TEADI": 106}},
        {"classificacao": "Médio Superior", "percentil": 60, "scores": {"Pontuação no TEADI": 110}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Pontuação no TEADI": 115}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Pontuação no TEADI": 119}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Pontuação no TEADI": 126}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Pontuação no TEADI": 132}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Pontuação no TEADI": 139}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Pontuação no TEADI": 148}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Pontuação no TEADI": 161}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Pontuação no TEADI": 174}}
    ]
})

tables.append({
    "table_number": 61,
    "title": "Normas do TEADI para a população geral de São Paulo por faixa etária",
    "columns": ["Até 25 anos", "26 a 33 anos", "34 a 39 anos", "40 a 46 anos", "47 anos ou mais"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Até 25 anos": 7, "26 a 33 anos": -9, "34 a 39 anos": -14, "40 a 46 anos": -25, "47 anos ou mais": -36}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Até 25 anos": 33, "26 a 33 anos": 12, "34 a 39 anos": 9, "40 a 46 anos": 4, "47 anos ou mais": 6}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Até 25 anos": 57, "26 a 33 anos": 26, "34 a 39 anos": 23, "40 a 46 anos": 19, "47 anos ou mais": 18}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Até 25 anos": 73, "26 a 33 anos": 37, "34 a 39 anos": 33, "40 a 46 anos": 26, "47 anos ou mais": 23}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Até 25 anos": 82, "26 a 33 anos": 49, "34 a 39 anos": 44, "40 a 46 anos": 38, "47 anos ou mais": 33}},
        {"classificacao": "Médio Inferior", "percentil": 25, "scores": {"Até 25 anos": 89, "26 a 33 anos": 57, "34 a 39 anos": 50, "40 a 46 anos": 44, "47 anos ou mais": 36}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Até 25 anos": 93, "26 a 33 anos": 68, "34 a 39 anos": 63, "40 a 46 anos": 58, "47 anos ou mais": 39}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Até 25 anos": 97, "26 a 33 anos": 74, "34 a 39 anos": 71, "40 a 46 anos": 64, "47 anos ou mais": 44}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Até 25 anos": 100, "26 a 33 anos": 81, "34 a 39 anos": 79, "40 a 46 anos": 75, "47 anos ou mais": 53}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Até 25 anos": 103, "26 a 33 anos": 87, "34 a 39 anos": 84, "40 a 46 anos": 76, "47 anos ou mais": 58}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Até 25 anos": 108, "26 a 33 anos": 94, "34 a 39 anos": 89, "40 a 46 anos": 77, "47 anos ou mais": 72}},
        {"classificacao": "Médio Superior", "percentil": 55, "scores": {"Até 25 anos": 113, "26 a 33 anos": 101, "34 a 39 anos": 93, "40 a 46 anos": 90, "47 anos ou mais": 78}},
        {"classificacao": "Médio Superior", "percentil": 60, "scores": {"Até 25 anos": 116, "26 a 33 anos": 108, "34 a 39 anos": 98, "40 a 46 anos": 94, "47 anos ou mais": 91}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Até 25 anos": 120, "26 a 33 anos": 115, "34 a 39 anos": 104, "40 a 46 anos": 101, "47 anos ou mais": 97}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Até 25 anos": 126, "26 a 33 anos": 118, "34 a 39 anos": 110, "40 a 46 anos": 106, "47 anos ou mais": 100}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Até 25 anos": 132, "26 a 33 anos": 128, "34 a 39 anos": 114, "40 a 46 anos": 112, "47 anos ou mais": 103}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Até 25 anos": 136, "26 a 33 anos": 132, "34 a 39 anos": 117, "40 a 46 anos": 116, "47 anos ou mais": 108}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Até 25 anos": 143, "26 a 33 anos": 144, "34 a 39 anos": 118, "40 a 46 anos": 126, "47 anos ou mais": 117}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Até 25 anos": 152, "26 a 33 anos": 149, "34 a 39 anos": 126, "40 a 46 anos": 130, "47 anos ou mais": 130}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Até 25 anos": 164, "26 a 33 anos": 164, "34 a 39 anos": 133, "40 a 46 anos": 159, "47 anos ou mais": 141}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Até 25 anos": 179, "26 a 33 anos": 171, "34 a 39 anos": 156, "40 a 46 anos": 168, "47 anos ou mais": 149}}
    ]
})

tables.append({
    "table_number": 62,
    "title": "Normas do TEADI para a população geral de São Paulo por escolaridade",
    "columns": ["Fundamental", "Médio", "Superior"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Fundamental": -29, "Médio": 20, "Superior": 26}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Fundamental": 9, "Médio": 39, "Superior": 66}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Fundamental": 20, "Médio": 57, "Superior": 84}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Fundamental": 30, "Médio": 68, "Superior": 89}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Fundamental": 39, "Médio": 71, "Superior": 95}},
        {"classificacao": "Médio Inferior", "percentil": 25, "scores": {"Fundamental": 47, "Médio": 77, "Superior": 98}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Fundamental": 55, "Médio": 80, "Superior": 99}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Fundamental": 58, "Médio": 86, "Superior": 101}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Fundamental": 63, "Médio": 92, "Superior": 104}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Fundamental": 69, "Médio": 95, "Superior": 106}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Fundamental": 75, "Médio": 100, "Superior": 112}},
        {"classificacao": "Médio Superior", "percentil": 55, "scores": {"Fundamental": 83, "Médio": 106, "Superior": 114}},
        {"classificacao": "Médio Superior", "percentil": 60, "scores": {"Fundamental": 88, "Médio": 110, "Superior": 117}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Fundamental": 94, "Médio": 115, "Superior": 119}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Fundamental": 97, "Médio": 117, "Superior": 121}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Fundamental": 104, "Médio": 125, "Superior": 129}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Fundamental": 112, "Médio": 132, "Superior": 134}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Fundamental": 121, "Médio": 144, "Superior": 142}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Fundamental": 128, "Médio": 152, "Superior": 151}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Fundamental": 135, "Médio": 163, "Superior": 162}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Fundamental": 165, "Médio": 179, "Superior": 180}}
    ]
})

tables.append({
    "table_number": 63,
    "title": "Normas do TEADI para a população geral de Sergipe",
    "columns": ["Pontuação no TEADI"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Pontuação no TEADI": -50}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Pontuação no TEADI": 23}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Pontuação no TEADI": 50}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Pontuação no TEADI": 70}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Pontuação no TEADI": 83}},
        {"classificacao": "Médio Inferior", "percentil": 25, "scores": {"Pontuação no TEADI": 92}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Pontuação no TEADI": 100}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Pontuação no TEADI": 106}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Pontuação no TEADI": 112}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Pontuação no TEADI": 119}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Pontuação no TEADI": 124}},
        {"classificacao": "Médio Superior", "percentil": 55, "scores": {"Pontuação no TEADI": 129}},
        {"classificacao": "Médio Superior", "percentil": 60, "scores": {"Pontuação no TEADI": 134}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Pontuação no TEADI": 140}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Pontuação no TEADI": 144}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Pontuação no TEADI": 149}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Pontuação no TEADI": 154}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Pontuação no TEADI": 160}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Pontuação no TEADI": 164}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Pontuação no TEADI": 173}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Pontuação no TEADI": 180}}
    ]
})

data["tables"] = tables

with open("src/data/teadi_norms.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("TEADI norms part 5 saved.")
