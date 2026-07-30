import time
from scrapling.fetchers import DynamicSession

def etapa1():
    print("Iniciando navegador...")
    # DynamicSession mantem o navegador aberto para várias interações
    with DynamicSession(headless=False) as session:
        print("Acessando a página...")
        print("ATENCAO: Faca o login manualmente no navegador que acabou de abrir.")
        
        # Carrega a página de login / colaboradores
        session.fetch('https://system.solides.com/pt-BR/crud/colaborador')
        
        print("\n" + "="*60)
        print("QUANDO VOCE TIVER FEITO O LOGIN E A LISTA DE")
        print("COLABORADORES ESTIVER VISIVEL, VOLTE AQUI E APERTE ENTER!")
        print("="*60)
        input("Aperte ENTER para continuar...")
        
        print("\nCapturando a página...")
        
        # Como a página sofreu alterações via Javascript (login e redirecionamento),
        # podemos forçar um recarregamento da mesma URL onde a lista se encontra
        response = session.fetch('https://system.solides.com/pt-BR/crud/colaborador')
        
        # Salva o código fonte (HTML) que o Scrapling obteve
        with open('colaboradores_list.html', 'w', encoding='utf-8') as f:
            f.write(response.text)
            
        print("\n✅ Sucesso! O HTML da página foi salvo no arquivo 'colaboradores_list.html'.")
        # Pequena pausa para o navegador não fechar bruscamente
        time.sleep(2)

if __name__ == "__main__":
    etapa1()
