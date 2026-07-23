import json
import os

with open("src/data/tealt_norms.json", "r", encoding="utf-8") as f:
    data = json.load(f)

tables = data.get("tables", [])

tables.append({
    "table_number": 69,
    "title": "Normas do TEALT para a população geral da Bahia por faixa etária",
    "columns": ["Até 22 anos", "23 a 30 anos", "31 a 37 anos", "38 a 44 anos", "45 anos ou mais"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Até 22 anos": 4, "23 a 30 anos": -22, "31 a 37 anos": -66, "38 a 44 anos": -92, "45 anos ou mais": -136}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Até 22 anos": 50, "23 a 30 anos": 23, "31 a 37 anos": -7, "38 a 44 anos": -14, "45 anos ou mais": -16}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Até 22 anos": 69, "23 a 30 anos": 46, "31 a 37 anos": 18, "38 a 44 anos": -2, "45 anos ou mais": -2}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Até 22 anos": 78, "23 a 30 anos": 54, "31 a 37 anos": 36, "38 a 44 anos": 25, "45 anos ou mais": 1}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Até 22 anos": 82, "23 a 30 anos": 64, "31 a 37 anos": 42, "38 a 44 anos": 25, "45 anos ou mais": 18}},
        {"classificacao": "Inferior", "percentil": 25, "scores": {"Até 22 anos": 84, "23 a 30 anos": 72, "31 a 37 anos": 62, "38 a 44 anos": 55, "45 anos ou mais": 37}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Até 22 anos": 87, "23 a 30 anos": 77, "31 a 37 anos": 66, "38 a 44 anos": 60, "45 anos ou mais": 52}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Até 22 anos": 94, "23 a 30 anos": 86, "31 a 37 anos": 70, "38 a 44 anos": 65, "45 anos ou mais": 55}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Até 22 anos": 98, "23 a 30 anos": 89, "31 a 37 anos": 74, "38 a 44 anos": 69, "45 anos ou mais": 60}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Até 22 anos": 105, "23 a 30 anos": 94, "31 a 37 anos": 79, "38 a 44 anos": 71, "45 anos ou mais": 65}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Até 22 anos": 109, "23 a 30 anos": 100, "31 a 37 anos": 84, "38 a 44 anos": 73, "45 anos ou mais": 69}},
        {"classificacao": "Médio", "percentil": 55, "scores": {"Até 22 anos": 114, "23 a 30 anos": 103, "31 a 37 anos": 92, "38 a 44 anos": 81, "45 anos ou mais": 71}},
        {"classificacao": "Médio", "percentil": 60, "scores": {"Até 22 anos": 118, "23 a 30 anos": 108, "31 a 37 anos": 95, "38 a 44 anos": 88, "45 anos ou mais": 73}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Até 22 anos": 124, "23 a 30 anos": 116, "31 a 37 anos": 107, "38 a 44 anos": 90, "45 anos ou mais": 81}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Até 22 anos": 125, "23 a 30 anos": 121, "31 a 37 anos": 109, "38 a 44 anos": 98, "45 anos ou mais": 88}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Até 22 anos": 126, "23 a 30 anos": 124, "31 a 37 anos": 118, "38 a 44 anos": 111, "45 anos ou mais": 90}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Até 22 anos": 127, "23 a 30 anos": 126, "31 a 37 anos": 124, "38 a 44 anos": 118, "45 anos ou mais": 98}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Até 22 anos": 128, "23 a 30 anos": 127, "31 a 37 anos": 126, "38 a 44 anos": 121, "45 anos ou mais": 109}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Até 22 anos": 128, "23 a 30 anos": 128, "31 a 37 anos": 127, "38 a 44 anos": 124, "45 anos ou mais": 111}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Até 22 anos": 128, "23 a 30 anos": 128, "31 a 37 anos": 127, "38 a 44 anos": 126, "45 anos ou mais": 113}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Até 22 anos": 128, "23 a 30 anos": 128, "31 a 37 anos": 128, "38 a 44 anos": 126, "45 anos ou mais": 113}}
    ]
})

tables.append({
    "table_number": 70,
    "title": "Normas do TEALT para a população geral da Bahia por escolaridade",
    "columns": ["Fundamental", "Médio", "Superior"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Fundamental": -122, "Médio": -120, "Superior": -104}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Fundamental": -112, "Médio": 16, "Superior": 51}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Fundamental": -76, "Médio": 50, "Superior": 74}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Fundamental": -22, "Médio": 60, "Superior": 82}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Fundamental": 29, "Médio": 68, "Superior": 92}},
        {"classificacao": "Inferior", "percentil": 25, "scores": {"Fundamental": 45, "Médio": 72, "Superior": 98}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Fundamental": 48, "Médio": 79, "Superior": 101}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Fundamental": 52, "Médio": 82, "Superior": 103}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Fundamental": 55, "Médio": 84, "Superior": 107}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Fundamental": 59, "Médio": 88, "Superior": 110}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Fundamental": 64, "Médio": 92, "Superior": 114}},
        {"classificacao": "Médio", "percentil": 55, "scores": {"Fundamental": 72, "Médio": 96, "Superior": 118}},
        {"classificacao": "Médio", "percentil": 60, "scores": {"Fundamental": 76, "Médio": 100, "Superior": 120}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Fundamental": 83, "Médio": 104, "Superior": 122}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Fundamental": 90, "Médio": 108, "Superior": 123}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Fundamental": 96, "Médio": 112, "Superior": 124}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Fundamental": 100, "Médio": 117, "Superior": 125}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Fundamental": 108, "Médio": 123, "Superior": 126}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Fundamental": 113, "Médio": 126, "Superior": 127}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Fundamental": 118, "Médio": 127, "Superior": 128}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Fundamental": 128, "Médio": 128, "Superior": 128}}
    ]
})

tables.append({
    "table_number": 71,
    "title": "Normas do TEALT para a população geral de Mato Grosso do Sul (N = 915)",
    "columns": ["Pontuação no TEALT"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Pontuação no TEALT": 0}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Pontuação no TEALT": 40}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Pontuação no TEALT": 51}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Pontuação no TEALT": 57}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Pontuação no TEALT": 63}},
        {"classificacao": "Inferior", "percentil": 25, "scores": {"Pontuação no TEALT": 69}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Pontuação no TEALT": 73}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Pontuação no TEALT": 78}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Pontuação no TEALT": 81}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Pontuação no TEALT": 85}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Pontuação no TEALT": 89}},
        {"classificacao": "Médio", "percentil": 55, "scores": {"Pontuação no TEALT": 95}},
        {"classificacao": "Médio", "percentil": 60, "scores": {"Pontuação no TEALT": 98}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Pontuação no TEALT": 100}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Pontuação no TEALT": 104}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Pontuação no TEALT": 109}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Pontuação no TEALT": 112}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Pontuação no TEALT": 119}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Pontuação no TEALT": 122}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Pontuação no TEALT": 126}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Pontuação no TEALT": 128}}
    ]
})

tables.append({
    "table_number": 72,
    "title": "Normas do TEALT para a população geral de Mato Grosso do Sul por faixa etária",
    "columns": ["Até 22 anos", "23 a 30 anos", "31 a 37 anos", "38 a 44 anos", "45 anos ou mais"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Até 22 anos": 31, "23 a 30 anos": 2, "31 a 37 anos": 0, "38 a 44 anos": 0, "45 anos ou mais": -2}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Até 22 anos": 50, "23 a 30 anos": 44, "31 a 37 anos": 39, "38 a 44 anos": 35, "45 anos ou mais": 19}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Até 22 anos": 69, "23 a 30 anos": 58, "31 a 37 anos": 55, "38 a 44 anos": 45, "45 anos ou mais": 36}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Até 22 anos": 74, "23 a 30 anos": 64, "31 a 37 anos": 58, "38 a 44 anos": 50, "45 anos ou mais": 40}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Até 22 anos": 81, "23 a 30 anos": 72, "31 a 37 anos": 61, "38 a 44 anos": 52, "45 anos ou mais": 45}},
        {"classificacao": "Inferior", "percentil": 25, "scores": {"Até 22 anos": 84, "23 a 30 anos": 77, "31 a 37 anos": 67, "38 a 44 anos": 56, "45 anos ou mais": 47}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Até 22 anos": 88, "23 a 30 anos": 80, "31 a 37 anos": 69, "38 a 44 anos": 58, "45 anos ou mais": 52}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Até 22 anos": 95, "23 a 30 anos": 83, "31 a 37 anos": 72, "38 a 44 anos": 62, "45 anos ou mais": 56}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Até 22 anos": 98, "23 a 30 anos": 88, "31 a 37 anos": 74, "38 a 44 anos": 64, "45 anos ou mais": 58}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Até 22 anos": 100, "23 a 30 anos": 90, "31 a 37 anos": 76, "38 a 44 anos": 68, "45 anos ou mais": 61}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Até 22 anos": 102, "23 a 30 anos": 95, "31 a 37 anos": 80, "38 a 44 anos": 71, "45 anos ou mais": 63}},
        {"classificacao": "Médio", "percentil": 55, "scores": {"Até 22 anos": 104, "23 a 30 anos": 98, "31 a 37 anos": 84, "38 a 44 anos": 75, "45 anos ou mais": 66}},
        {"classificacao": "Médio", "percentil": 60, "scores": {"Até 22 anos": 108, "23 a 30 anos": 100, "31 a 37 anos": 89, "38 a 44 anos": 82, "45 anos ou mais": 72}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Até 22 anos": 112, "23 a 30 anos": 103, "31 a 37 anos": 96, "38 a 44 anos": 85, "45 anos ou mais": 76}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Até 22 anos": 116, "23 a 30 anos": 105, "31 a 37 anos": 99, "38 a 44 anos": 88, "45 anos ou mais": 80}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Até 22 anos": 120, "23 a 30 anos": 110, "31 a 37 anos": 102, "38 a 44 anos": 91, "45 anos ou mais": 86}},
        {"classificacao": "Superior", "percentil": 80, "scores": {"Até 22 anos": 123, "23 a 30 anos": 116, "31 a 37 anos": 110, "38 a 44 anos": 93, "45 anos ou mais": 89}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Até 22 anos": 124, "23 a 30 anos": 124, "31 a 37 anos": 113, "38 a 44 anos": 101, "45 anos ou mais": 96}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Até 22 anos": 126, "23 a 30 anos": 126, "31 a 37 anos": 120, "38 a 44 anos": 109, "45 anos ou mais": 100}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Até 22 anos": 127, "23 a 30 anos": 127, "31 a 37 anos": 125, "38 a 44 anos": 124, "45 anos ou mais": 111}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Até 22 anos": 128, "23 a 30 anos": 128, "31 a 37 anos": 127, "38 a 44 anos": 127, "45 anos ou mais": 123}}
    ]
})

data["tables"] = tables

with open("src/data/tealt_norms.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("TEALT norms part 3 saved.")
