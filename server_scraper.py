import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app) # Permite comunicação entre a extensão do navegador e o localhost

# Diretório onde as extrações serão salvas
DEST_DIR = r"C:\Users\ACPO Empreendimentos\Desktop\Importar dados\Json Colaboradores"
os.makedirs(DEST_DIR, exist_ok=True)

@app.route('/api/save_html', methods=['POST'])
def save_html():
    data = request.json
    html_content = data.get('html', '')
    url = data.get('url', '')
    
    if not html_content:
        return jsonify({"status": "error", "message": "O HTML recebido está vazio!"}), 400
        
    print(f"\n[+] Recebido HTML da URL: {url}")
    
    import time
    timestamp = int(time.time())
    file_path = os.path.join(DEST_DIR, f"pagina_{timestamp}.html")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(html_content)
        
    print(f"[+] HTML salvo com sucesso em: {file_path}")
    return jsonify({"status": "success"})

@app.route('/api/save_colaborador', methods=['POST'])
def save_colaborador():
    colaborador = request.json
    nome = colaborador.get('nome', 'Desconhecido').replace('/', '-').replace('\\', '-')
    
    file_path = os.path.join(DEST_DIR, f"{nome}.json")
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(colaborador, f, ensure_ascii=False, indent=4)
        
    print(f"[+] Dados salvos: {nome}.json")
    return jsonify({"status": "success"})

if __name__ == '__main__':
    print("\n" + "="*70)
    print("SERVIDOR DA EXTENSAO INICIADO")
    print(f"Os arquivos serao salvos em:\n   {DEST_DIR}")
    print("\nAguardando voce clicar no botao da extensao la no Chrome...")
    print("="*70 + "\n")
    # Inicia o servidor na porta 5000
    app.run(host='127.0.0.1', port=5000, debug=False)
