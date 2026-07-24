import json
import os

with open("C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/cdabee16-7d60-4be9-9d46-c848215f92a7/scratch/folder_matches.json", "r", encoding="utf-8") as f:
    data = json.load(f)

found = data['found']

extensions = {}
file_names = set()
files_per_folder = []

for emp_name, folder_path in found:
    count = 0
    if os.path.exists(folder_path):
        for root, dirs, files in os.walk(folder_path):
            for file in files:
                count += 1
                ext = os.path.splitext(file)[1].lower()
                extensions[ext] = extensions.get(ext, 0) + 1
                
                if ext == '.pdf':
                    # collect common words in pdf names to find patterns
                    name_lower = file.lower()
                    if 'ficha' in name_lower or 'registro' in name_lower or 'contrato' in name_lower or 'admiss' in name_lower:
                        file_names.add(file)
    files_per_folder.append(count)

print(f"Total folders checked: {len(found)}")
print(f"Average files per folder: {sum(files_per_folder) / len(found) if found else 0:.2f}")
print("File extensions found:")
for ext, count in sorted(extensions.items(), key=lambda x: x[1], reverse=True):
    print(f"  {ext}: {count}")

print("\nSample of interesting PDF names (ficha, registro, contrato, admissão):")
for name in list(file_names)[:20]:
    print(f"  {name}")
