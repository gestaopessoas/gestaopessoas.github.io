import pandas as pd
import unicodedata

def normalize(text):
    if pd.isna(text) or not text:
        return ""
    text = str(text).strip().upper()
    return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

csv_path = r'C:\Users\ACPO Empreendimentos\Desktop\Importar dados\Json Colaboradores\colaboradores_solides.csv'
df = pd.read_csv(csv_path, encoding='utf-8-sig')

names = []
for n in df['NOME_COMPLETO'].dropna():
    names.append(n.replace("'", "''"))

q = "SELECT id, name, email_personal, email_corporate, phone, role, profile_code, registration_number FROM employees WHERE name IN (" + ",".join([f"'{n}'" for n in names]) + ")"

# Let's also include normalized names if some of them have accents in DB and we don't know it, but we already matched them so the exact names will work.
# Wait, for Angelica we matched the normalized version. But in DB it's without accents. So we need to query without accents.
q_names = []
for n in df['NOME_COMPLETO'].dropna():
    q_names.append(normalize(n).replace("'", "''"))

q = "SELECT id, name, email_personal, email_corporate, phone, role, profile_code, registration_number FROM employees WHERE UPPER(name) IN (" + ",".join([f"'{n}'" for n in q_names]) + ")"

with open('query.txt', 'w', encoding='utf-8') as f:
    f.write(q)
