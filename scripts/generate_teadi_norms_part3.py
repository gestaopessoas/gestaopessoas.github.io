import json
import os

with open("src/data/teadi_norms.json", "r", encoding="utf-8") as f:
    data = json.load(f)

tables = data.get("tables", [])

tables.append({
    "table_number": 52,
    "title": "Normas do TEADI para a população geral de Mato Grosso do Sul por faixa etária",
    "columns": ["Até 25 anos", "26 a 33 anos", "34 a 39 anos", "40 a 46 anos", "47 anos ou mais"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Até 25 anos": 44, "26 a 33 anos": 20, "34 a 39 anos": 7, "40 a 46 anos": 0, "47 anos ou mais": -3}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Até 25 anos": 77, "26 a 33 anos": 52, "34 a 39 anos": 46, "40 a 46 anos": 19, "47 anos ou mais": 11}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Até 25 anos": 89, "26 a 33 anos": 68, "34 a 39 anos": 66, "40 a 46 anos": 37, "47 anos ou mais": 21}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Até 25 anos": 103, "26 a 33 anos": 81, "34 a 39 anos": 73, "40 a 46 anos": 48, "47 anos ou mais": 33}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Até 25 anos": 108, "26 a 33 anos": 92, "34 a 39 anos": 81, "40 a 46 anos": 52, "47 anos ou mais": 37}},
        {"classificacao": "Médio Inferior", "percentil": 25, "scores": {"Até 25 anos": 112, "26 a 33 anos": 101, "34 a 39 anos": 86, "40 a 46 anos": 56, "47 anos ou mais": 48}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Até 25 anos": 117, "26 a 33 anos": 109, "34 a 39 anos": 89, "40 a 46 anos": 63, "47 anos ou mais": 56}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Até 25 anos": 122, "26 a 33 anos": 114, "34 a 39 anos": 98, "40 a 46 anos": 69, "47 anos ou mais": 65}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Até 25 anos": 125, "26 a 33 anos": 120, "34 a 39 anos": 102, "40 a 46 anos": 76, "47 anos ou mais": 70}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Até 25 anos": 129, "26 a 33 anos": 124, "34 a 39 anos": 106, "40 a 46 anos": 91, "47 anos ou mais": 77}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Até 25 anos": 134, "26 a 33 anos": 129, "34 a 39 anos": 109, "40 a 46 anos": 96, "47 anos ou mais": 84}},
        {"classificacao": "Médio Superior", "percentil": 55, "scores": {"Até 25 anos": 139, "26 a 33 anos": 134, "34 a 39 anos": 113, "40 a 46 anos": 102, "47 anos ou mais": 92}},
        {"classificacao": "Médio Superior", "percentil": 60, "scores": {"Até 25 anos": 145, "26 a 33 anos": 137, "34 a 39 anos": 122, "40 a 46 anos": 108, "47 anos ou mais": 99}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Até 25 anos": 150, "26 a 33 anos": 141, "34 a 39 anos": 124, "40 a 46 anos": 112, "47 anos ou mais": 101}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Até 25 anos": 154, "26 a 33 anos": 146, "34 a 39 anos": 137, "40 a 46 anos": 119, "47 anos ou mais": 111}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Até 25 anos": 158, "26 a 33 anos": 150, "34 a 39 anos": 140, "40 a 46 anos": 125, "47 anos ou mais": 117}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Até 25 anos": 162, "26 a 33 anos": 156, "34 a 39 anos": 147, "40 a 46 anos": 131, "47 anos ou mais": 120}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Até 25 anos": 166, "26 a 33 anos": 163, "34 a 39 anos": 152, "40 a 46 anos": 142, "47 anos ou mais": 123}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Até 25 anos": 172, "26 a 33 anos": 167, "34 a 39 anos": 162, "40 a 46 anos": 147, "47 anos ou mais": 139}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Até 25 anos": 176, "26 a 33 anos": 174, "34 a 39 anos": 167, "40 a 46 anos": 161, "47 anos ou mais": 144}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Até 25 anos": 180, "26 a 33 anos": 179, "34 a 39 anos": 178, "40 a 46 anos": 176, "47 anos ou mais": 170}}
    ]
})

tables.append({
    "table_number": 53,
    "title": "Normas do TEADI para a população geral de Mato Grosso do Sul por escolaridade",
    "columns": ["Fundamental", "Médio", "Superior"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Fundamental": 0, "Médio": 42, "Superior": 54}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Fundamental": 20, "Médio": 69, "Superior": 76}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Fundamental": 35, "Médio": 86, "Superior": 98}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Fundamental": 50, "Médio": 97, "Superior": 109}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Fundamental": 64, "Médio": 105, "Superior": 112}},
        {"classificacao": "Médio Inferior", "percentil": 25, "scores": {"Fundamental": 71, "Médio": 110, "Superior": 115}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Fundamental": 77, "Médio": 115, "Superior": 120}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Fundamental": 89, "Médio": 120, "Superior": 124}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Fundamental": 94, "Médio": 124, "Superior": 128}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Fundamental": 101, "Médio": 129, "Superior": 133}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Fundamental": 107, "Médio": 134, "Superior": 140}},
        {"classificacao": "Médio Superior", "percentil": 55, "scores": {"Fundamental": 112, "Médio": 139, "Superior": 144}},
        {"classificacao": "Médio Superior", "percentil": 60, "scores": {"Fundamental": 117, "Médio": 142, "Superior": 148}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Fundamental": 122, "Médio": 146, "Superior": 153}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Fundamental": 127, "Médio": 151, "Superior": 161}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Fundamental": 134, "Médio": 156, "Superior": 164}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Fundamental": 139, "Médio": 162, "Superior": 166}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Fundamental": 148, "Médio": 166, "Superior": 170}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Fundamental": 156, "Médio": 170, "Superior": 172}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Fundamental": 168, "Médio": 176, "Superior": 177}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Fundamental": 178, "Médio": 179, "Superior": 180}}
    ]
})

tables.append({
    "table_number": 54,
    "title": "Normas do TEADI para a população geral do Paraná",
    "columns": ["Pontuação no TEADI"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Pontuação no TEADI": -8}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Pontuação no TEADI": 15}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Pontuação no TEADI": 32}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Pontuação no TEADI": 49}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Pontuação no TEADI": 61}},
        {"classificacao": "Médio Inferior", "percentil": 25, "scores": {"Pontuação no TEADI": 72}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Pontuação no TEADI": 79}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Pontuação no TEADI": 88}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Pontuação no TEADI": 96}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Pontuação no TEADI": 100}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Pontuação no TEADI": 106}},
        {"classificacao": "Médio Superior", "percentil": 55, "scores": {"Pontuação no TEADI": 112}},
        {"classificacao": "Médio Superior", "percentil": 60, "scores": {"Pontuação no TEADI": 118}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Pontuação no TEADI": 123}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Pontuação no TEADI": 127}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Pontuação no TEADI": 134}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Pontuação no TEADI": 141}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Pontuação no TEADI": 151}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Pontuação no TEADI": 158}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Pontuação no TEADI": 168}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Pontuação no TEADI": 177}}
    ]
})

tables.append({
    "table_number": 55,
    "title": "Normas do TEADI para a população geral do Paraná por faixa etária",
    "columns": ["Até 25 anos", "26 a 33 anos", "34 a 39 anos", "40 a 46 anos", "47 anos ou mais"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Até 25 anos": -10, "26 a 33 anos": -20, "34 a 39 anos": -27, "40 a 46 anos": -32, "47 anos ou mais": -44}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Até 25 anos": 26, "26 a 33 anos": 16, "34 a 39 anos": 9, "40 a 46 anos": 2, "47 anos ou mais": -10}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Até 25 anos": 61, "26 a 33 anos": 23, "34 a 39 anos": 16, "40 a 46 anos": 13, "47 anos ou mais": 9}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Até 25 anos": 77, "26 a 33 anos": 34, "34 a 39 anos": 29, "40 a 46 anos": 24, "47 anos ou mais": 16}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Até 25 anos": 86, "26 a 33 anos": 41, "34 a 39 anos": 36, "40 a 46 anos": 32, "47 anos ou mais": 23}},
        {"classificacao": "Médio Inferior", "percentil": 25, "scores": {"Até 25 anos": 94, "26 a 33 anos": 58, "34 a 39 anos": 49, "40 a 46 anos": 44, "47 anos ou mais": 33}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Até 25 anos": 97, "26 a 33 anos": 68, "34 a 39 anos": 57, "40 a 46 anos": 54, "47 anos ou mais": 48}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Até 25 anos": 105, "26 a 33 anos": 77, "34 a 39 anos": 64, "40 a 46 anos": 57, "47 anos ou mais": 52}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Até 25 anos": 111, "26 a 33 anos": 93, "34 a 39 anos": 70, "40 a 46 anos": 61, "47 anos ou mais": 54}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Até 25 anos": 115, "26 a 33 anos": 99, "34 a 39 anos": 74, "40 a 46 anos": 71, "47 anos ou mais": 60}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Até 25 anos": 121, "26 a 33 anos": 104, "34 a 39 anos": 80, "40 a 46 anos": 77, "47 anos ou mais": 69}},
        {"classificacao": "Médio Superior", "percentil": 55, "scores": {"Até 25 anos": 125, "26 a 33 anos": 110, "34 a 39 anos": 85, "40 a 46 anos": 83, "47 anos ou mais": 77}},
        {"classificacao": "Médio Superior", "percentil": 60, "scores": {"Até 25 anos": 129, "26 a 33 anos": 115, "34 a 39 anos": 91, "40 a 46 anos": 87, "47 anos ou mais": 80}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Até 25 anos": 133, "26 a 33 anos": 118, "34 a 39 anos": 97, "40 a 46 anos": 90, "47 anos ou mais": 85}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Até 25 anos": 138, "26 a 33 anos": 124, "34 a 39 anos": 101, "40 a 46 anos": 99, "47 anos ou mais": 96}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Até 25 anos": 144, "26 a 33 anos": 127, "34 a 39 anos": 105, "40 a 46 anos": 103, "47 anos ou mais": 101}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Até 25 anos": 151, "26 a 33 anos": 135, "34 a 39 anos": 114, "40 a 46 anos": 106, "47 anos ou mais": 109}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Até 25 anos": 156, "26 a 33 anos": 148, "34 a 39 anos": 122, "40 a 46 anos": 111, "47 anos ou mais": 117}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Até 25 anos": 162, "26 a 33 anos": 160, "34 a 39 anos": 144, "40 a 46 anos": 124, "47 anos ou mais": 121}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Até 25 anos": 171, "26 a 33 anos": 170, "34 a 39 anos": 155, "40 a 46 anos": 134, "47 anos ou mais": 134}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Até 25 anos": 178, "26 a 33 anos": 176, "34 a 39 anos": 165, "40 a 46 anos": 154, "47 anos ou mais": 150}}
    ]
})

data["tables"] = tables

with open("src/data/teadi_norms.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("TEADI norms part 3 saved.")
