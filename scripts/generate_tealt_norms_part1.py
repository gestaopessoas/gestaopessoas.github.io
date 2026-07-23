import json
import os

data = {
    "tables": []
}

os.makedirs("src/data", exist_ok=True)

# Table 65
data["tables"].append({
    "table_number": 65,
    "title": "Normas do TEALT para a população geral (N = 3848)",
    "columns": ["Pontuação no TEALT"],
    "data": [
        {"classificacao": "Inferior", "percentil": 1, "scores": {"Pontuação no TEALT": -44}},
        {"classificacao": "Inferior", "percentil": 5, "scores": {"Pontuação no TEALT": 38}},
        {"classificacao": "Inferior", "percentil": 10, "scores": {"Pontuação no TEALT": 51}},
        {"classificacao": "Inferior", "percentil": 15, "scores": {"Pontuação no TEALT": 58}},
        {"classificacao": "Inferior", "percentil": 20, "scores": {"Pontuação no TEALT": 64}},
        {"classificacao": "Inferior", "percentil": 25, "scores": {"Pontuação no TEALT": 71}},
        {"classificacao": "Médio Inferior", "percentil": 30, "scores": {"Pontuação no TEALT": 75}},
        {"classificacao": "Médio Inferior", "percentil": 35, "scores": {"Pontuação no TEALT": 80}},
        {"classificacao": "Médio Inferior", "percentil": 40, "scores": {"Pontuação no TEALT": 83}},
        {"classificacao": "Médio Inferior", "percentil": 45, "scores": {"Pontuação no TEALT": 88}},
        {"classificacao": "Médio", "percentil": 50, "scores": {"Pontuação no TEALT": 92}},
        {"classificacao": "Médio", "percentil": 55, "scores": {"Pontuação no TEALT": 97}},
        {"classificacao": "Médio", "percentil": 60, "scores": {"Pontuação no TEALT": 100}},
        {"classificacao": "Médio Superior", "percentil": 65, "scores": {"Pontuação no TEALT": 104}},
        {"classificacao": "Médio Superior", "percentil": 70, "scores": {"Pontuação no TEALT": 108}},
        {"classificacao": "Médio Superior", "percentil": 75, "scores": {"Pontuação no TEALT": 112}},
        {"classificacao": "Médio Superior", "percentil": 80, "scores": {"Pontuação no TEALT": 118}},
        {"classificacao": "Superior", "percentil": 85, "scores": {"Pontuação no TEALT": 122}},
        {"classificacao": "Superior", "percentil": 90, "scores": {"Pontuação no TEALT": 126}},
        {"classificacao": "Superior", "percentil": 95, "scores": {"Pontuação no TEALT": 127}},
        {"classificacao": "Superior", "percentil": 99, "scores": {"Pontuação no TEALT": 128}}
    ]
})

with open("src/data/tealt_norms.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("TEALT norms part 1 saved.")
