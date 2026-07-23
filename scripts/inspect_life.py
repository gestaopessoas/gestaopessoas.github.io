import pdfplumber

with pdfplumber.open(r"C:\Users\ACPO Empreendimentos\Desktop\Nova pasta (2)\21072026 Empregados LIFE RIO GRANDE.pdf") as pdf:
    for page in pdf.pages:
        print(page.extract_text()[:500])
        break
