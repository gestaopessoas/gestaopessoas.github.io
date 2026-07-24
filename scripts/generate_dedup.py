import json
import os

path = r'C:\Users\ACPO Empreendimentos\.gemini\antigravity\brain\cdabee16-7d60-4be9-9d46-c848215f92a7\.system_generated\steps\1146\output.txt'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# The MCP tool returned a JSON array as a string, but wrapped inside untrusted-data
start = content.find('[{')
end = content.rfind('}]') + 2
raw_data = content[start:end]

try:
    # it might be escaped like "[{\"json_agg\":"
    if r'\"' in raw_data:
        # It's an escaped JSON string, we can try to json.loads it first
        # Wait, if it's literally [{\"json_agg\"... then it's not a valid JSON string 
        # unless it starts and ends with quotes. But it starts with [{
        # It means the string in output.txt has literal backslashes!
        raw_data = raw_data.replace('\\"', '"')
    
    data = json.loads(raw_data)
except Exception as e:
    print("Failed to parse:", e)
    import sys; sys.exit(1)

records = data[0]['json_agg']

from collections import defaultdict

groups = defaultdict(list)
for r in records:
    groups[r['name']].append(r)

sql = []
merged_count = 0
deleted_count = 0

def merge_records(recs):
    # Base is the one that has the most non-null fields
    recs.sort(key=lambda x: sum(1 for v in x.values() if v is not None), reverse=True)
    base = recs[0].copy()
    
    # Merge others into base
    for other in recs[1:]:
        for k, v in other.items():
            if base.get(k) is None and v is not None:
                base[k] = v
                
    return base, recs[0]['id'], [r['id'] for r in recs[1:]]

summary = []

for name, recs in groups.items():
    if len(recs) > 1:
        merged_count += 1
        deleted_count += len(recs) - 1
        
        base, base_id, delete_ids = merge_records(recs)
        
        # update fields for base
        update_fields = []
        for k, v in base.items():
            if k not in ['id', 'created_at', 'updated_at', 'name']:
                if v is None:
                    # we don't need to set to NULL if we just merged, but to be safe
                    update_fields.append(f"{k} = NULL")
                elif isinstance(v, str):
                    v_esc = v.replace("'", "''")
                    update_fields.append(f"{k} = '{v_esc}'")
                elif isinstance(v, (int, float)):
                    update_fields.append(f"{k} = {v}")
                elif isinstance(v, bool):
                    update_fields.append(f"{k} = {'true' if v else 'false'}")
                elif isinstance(v, dict):
                    v_str = json.dumps(v).replace("'", "''")
                    update_fields.append(f"{k} = '{v_str}'::jsonb")
                    
        if update_fields:
            sql.append(f"UPDATE employees SET {', '.join(update_fields)} WHERE id = '{base_id}';")
            
        # Delete others
        for d_id in delete_ids:
            sql.append(f"DELETE FROM employees WHERE id = '{d_id}';")
            
        summary.append(f"- **{name}**: Mantido 1 registro e excluído(s) {len(delete_ids)} duplicado(s).")

with open('deduplicate.sql', 'w', encoding='utf-8') as f:
    f.write("\n".join(sql))

print(f"Generated {len(sql)} SQL statements to deduplicate {merged_count} groups. Deleting {deleted_count} rows.")

with open('dedup_summary.md', 'w', encoding='utf-8') as f:
    f.write(f"Total de colaboradores com duplicatas encontrados: {merged_count}\n")
    f.write(f"Total de registros a serem excluídos: {deleted_count}\n\n")
    f.write("\n".join(summary))
