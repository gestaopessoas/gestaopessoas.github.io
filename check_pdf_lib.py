import os
import json
import re

try:
    import fitz  # PyMuPDF
    has_fitz = True
except ImportError:
    has_fitz = False
    
try:
    import PyPDF2
    has_pypdf2 = True
except ImportError:
    has_pypdf2 = False

print(f"PyMuPDF installed: {has_fitz}")
print(f"PyPDF2 installed: {has_pypdf2}")

with open("C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/cdabee16-7d60-4be9-9d46-c848215f92a7/scratch/folder_matches.json", "r", encoding="utf-8") as f:
    data = json.load(f)

found = data['found']

sample_files = []
for emp_name, folder_path in found:
    if len(sample_files) > 3:
        break
    if os.path.exists(folder_path):
        for root, dirs, files in os.walk(folder_path):
            for file in files:
                name_lower = file.lower()
                if file.endswith('.pdf') and ('contrato' in name_lower or 'ficha' in name_lower or 'registro' in name_lower):
                    sample_files.append(os.path.join(root, file))
                    break

def extract_text_pypdf2(path):
    text = ""
    with open(path, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        for page in reader.pages:
            t = page.extract_text()
            if t: text += t + "\n"
    return text

for path in sample_files:
    print(f"\n--- Extracting: {os.path.basename(path)} ---")
    if has_fitz:
        doc = fitz.open(path)
        text = ""
        for page in doc:
            text += page.get_text()
        print(text[:500])
    elif has_pypdf2:
        print(extract_text_pypdf2(path)[:500])
    else:
        print("No PDF library installed.")
