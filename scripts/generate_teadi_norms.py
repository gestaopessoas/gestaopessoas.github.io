import json
import os

tables = []

tables.append({
    "table_number": 45,
    "title": "Normas do TEADI para a população geral considerando todos os estados",
    "columns": ["Pontuação no TEADI"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Pontuação no TEADI": -14}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Pontuação no TEADI": 21}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Pontuação no TEADI": 42}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Pontuação no TEADI": 57}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Pontuação no TEADI": 68}},
        {"classificacao": "Médio Inferior", "percentil": 25, "scores": {"Pontuação no TEADI": 77}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Pontuação no TEADI": 86}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Pontuação no TEADI": 94}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Pontuação no TEADI": 99}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Pontuação no TEADI": 105}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Pontuação no TEADI": 110}},
        {"classificacao": "Médio Superior", "percentil": 55, "scores": {"Pontuação no TEADI": 115}},
        {"classificacao": "Médio Superior", "percentil": 60, "scores": {"Pontuação no TEADI": 120}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Pontuação no TEADI": 126}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Pontuação no TEADI": 131}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Pontuação no TEADI": 137}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Pontuação no TEADI": 144}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Pontuação no TEADI": 152}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Pontuação no TEADI": 160}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Pontuação no TEADI": 169}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Pontuação no TEADI": 178}}
    ]
})

tables.append({
    "table_number": 46,
    "title": "Normas do TEADI para a população geral por faixa etária",
    "columns": ["Até 25 anos", "26 a 33 anos", "34 a 39 anos", "40 a 46 anos", "47 anos ou mais"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Até 25 anos": 3, "26 a 33 anos": -10, "34 a 39 anos": -26, "40 a 46 anos": -28, "47 anos ou mais": -67}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Até 25 anos": 43, "26 a 33 anos": 16, "34 a 39 anos": 11, "40 a 46 anos": 9, "47 anos ou mais": 8}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Até 25 anos": 66, "26 a 33 anos": 36, "34 a 39 anos": 26, "40 a 46 anos": 20, "47 anos ou mais": 18}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Até 25 anos": 80, "26 a 33 anos": 54, "34 a 39 anos": 45, "40 a 46 anos": 39, "47 anos ou mais": 26}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Até 25 anos": 90, "26 a 33 anos": 65, "34 a 39 anos": 57, "40 a 46 anos": 46, "47 anos ou mais": 33}},
        {"classificacao": "Médio Inferior", "percentil": 25, "scores": {"Até 25 anos": 95, "26 a 33 anos": 72, "34 a 39 anos": 65, "40 a 46 anos": 52, "47 anos ou mais": 38}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Até 25 anos": 101, "26 a 33 anos": 81, "34 a 39 anos": 71, "40 a 46 anos": 58, "47 anos ou mais": 44}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Até 25 anos": 106, "26 a 33 anos": 88, "34 a 39 anos": 77, "40 a 46 anos": 64, "47 anos ou mais": 51}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Até 25 anos": 110, "26 a 33 anos": 95, "34 a 39 anos": 85, "40 a 46 anos": 69, "47 anos ou mais": 55}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Até 25 anos": 115, "26 a 33 anos": 103, "34 a 39 anos": 89, "40 a 46 anos": 74, "47 anos ou mais": 64}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Até 25 anos": 121, "26 a 33 anos": 108, "34 a 39 anos": 96, "40 a 46 anos": 77, "47 anos ou mais": 72}},
        {"classificacao": "Médio Superior", "percentil": 55, "scores": {"Até 25 anos": 125, "26 a 33 anos": 114, "34 a 39 anos": 101, "40 a 46 anos": 85, "47 anos ou mais": 77}},
        {"classificacao": "Médio Superior", "percentil": 60, "scores": {"Até 25 anos": 129, "26 a 33 anos": 119, "34 a 39 anos": 105, "40 a 46 anos": 93, "47 anos ou mais": 83}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Até 25 anos": 134, "26 a 33 anos": 125, "34 a 39 anos": 111, "40 a 46 anos": 99, "47 anos ou mais": 93}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Até 25 anos": 139, "26 a 33 anos": 130, "34 a 39 anos": 117, "40 a 46 anos": 107, "47 anos ou mais": 99}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Até 25 anos": 144, "26 a 33 anos": 136, "34 a 39 anos": 121, "40 a 46 anos": 112, "47 anos ou mais": 103}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Até 25 anos": 151, "26 a 33 anos": 144, "34 a 39 anos": 130, "40 a 46 anos": 118, "47 anos ou mais": 111}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Até 25 anos": 156, "26 a 33 anos": 150, "34 a 39 anos": 139, "40 a 46 anos": 124, "47 anos ou mais": 119}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Até 25 anos": 163, "26 a 33 anos": 160, "34 a 39 anos": 150, "40 a 46 anos": 142, "47 anos ou mais": 132}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Até 25 anos": 172, "26 a 33 anos": 168, "34 a 39 anos": 161, "40 a 46 anos": 158, "47 anos ou mais": 146}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Até 25 anos": 179, "26 a 33 anos": 177, "34 a 39 anos": 175, "40 a 46 anos": 178, "47 anos ou mais": 172}}
    ]
})

tables.append({
    "table_number": 47,
    "title": "Normas do TEADI para a população geral por escolaridade",
    "columns": ["Fundamental", "Médio", "Superior"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Fundamental": -33, "Médio": -24, "Superior": -16}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Fundamental": 9, "Médio": 29, "Superior": 41}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Fundamental": 23, "Médio": 52, "Superior": 67}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Fundamental": 37, "Médio": 68, "Superior": 82}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Fundamental": 45, "Médio": 77, "Superior": 92}},
        {"classificacao": "Médio Inferior", "percentil": 25, "scores": {"Fundamental": 53, "Médio": 86, "Superior": 99}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Fundamental": 60, "Médio": 93, "Superior": 104}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Fundamental": 67, "Médio": 98, "Superior": 110}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Fundamental": 73, "Médio": 104, "Superior": 115}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Fundamental": 81, "Médio": 109, "Superior": 120}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Fundamental": 89, "Médio": 114, "Superior": 125}},
        {"classificacao": "Médio Superior", "percentil": 55, "scores": {"Fundamental": 94, "Médio": 119, "Superior": 129}},
        {"classificacao": "Médio Superior", "percentil": 60, "scores": {"Fundamental": 99, "Médio": 125, "Superior": 134}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Fundamental": 104, "Médio": 130, "Superior": 139}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Fundamental": 111, "Médio": 135, "Superior": 144}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Fundamental": 116, "Médio": 141, "Superior": 148}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Fundamental": 122, "Médio": 147, "Superior": 155}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Fundamental": 130, "Médio": 154, "Superior": 162}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Fundamental": 139, "Médio": 162, "Superior": 166}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Fundamental": 152, "Médio": 170, "Superior": 173}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Fundamental": 172, "Médio": 178, "Superior": 180}}
    ]
})

with open("src/data/teadi_norms.json", "w", encoding="utf-8") as f:
    json.dump({"test": "TEADI", "tables": tables}, f, ensure_ascii=False, indent=2)

print("TEADI norms saved.")
