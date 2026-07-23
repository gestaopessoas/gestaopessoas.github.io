import re

with open('insert_141_employees.sql', 'r', encoding='utf-8') as f:
    lines = f.readlines()

missing = []
for line in lines:
    if "VALUES (" in line:
        # e.g., VALUES ('id', 'name', '', NULL, NULL, NULL, 'Ativo')
        if ", ''," in line or ", NULL," in line:
            name_match = re.search(r"VALUES \('[^']+', '([^']+)'", line)
            if name_match:
                missing.append(name_match.group(1))

print(f"Total missing details: {len(missing)}")
for m in missing:
    print(m)
