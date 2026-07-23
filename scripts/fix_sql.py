import re

with open('final_update_and_insert.sql', 'r', encoding='utf-8') as f:
    lines = f.readlines()

inserts = [l for l in lines if l.startswith('INSERT')]
fixed_inserts = []
for ins in inserts:
    # replace 'type, external_id' with 'contract_type'
    ins = ins.replace(' type, external_id,', ' contract_type,')
    # find VALUES
    parts = ins.split('VALUES (')
    if len(parts) == 2:
        val_str = parts[1]
        val_str = re.sub(r", 'new_\d+'", "", val_str)
        fixed_inserts.append(parts[0] + 'VALUES (' + val_str)

sql = '''
UPDATE employees SET 
  name = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(INITCAP(name), ' Da ', ' da '), ' De ', ' de '), ' Do ', ' do '), ' Das ', ' das '), ' Dos ', ' dos '), ' E ', ' e '),
  role = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(INITCAP(role), ' Da ', ' da '), ' De ', ' de '), ' Do ', ' do '), ' Das ', ' das '), ' Dos ', ' dos '), ' E ', ' e ');
''' + ''.join(fixed_inserts)

with open('compact_update_and_insert.sql', 'w', encoding='utf-8') as f:
    f.write(sql)
print(f'Wrote compact SQL with fixed inserts.')
