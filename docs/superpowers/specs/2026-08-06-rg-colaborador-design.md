# RG do colaborador

## Objetivo

Permitir RG com até 15 dígitos, sem pontuação, preservando dados legados quando o usuário editar outros campos do colaborador.

## Comportamento

- O campo usa teclado numérico, aceita somente números durante uma alteração explícita e limita o novo valor a 15 dígitos.
- Zeros à esquerda são preservados porque o RG continua armazenado como texto.
- Ao abrir um registro, o valor legado é exibido sem transformação. Salvar outro campo não deve limpar, reformatar ou truncar o RG existente.
- Quando o usuário modificar o próprio RG, pontos, traços, espaços e letras são removidos; permanecem os primeiros 15 dígitos.
- O RG integra a lista de campos críticos conferidos no retorno do Supabase. Divergência mantém o formulário aberto e exibe erro.

## Testes

- Sanitização mantém somente os primeiros 15 dígitos e preserva zeros à esquerda.
- O carregamento do formulário preserva um RG legado sem transformação.
- A conferência pós-salvamento falha quando o RG persistido diverge.
- O campo não usa mais a máscara estadual antiga.

