# Persistência e horários de colaboradores

## Objetivo

Corrigir a edição de colaboradores para que Cargo, Código do Perfil, Empresa, Obra/Unidade, Estado civil e Status sejam carregados e persistidos sem divergências visuais ou falhas silenciosas. Automatizar a jornada conforme o tipo da Obra/Unidade e remover o ASO duplicado da seção “Documentos e arquivo”.

## Persistência

- Carregar `profile_code` junto com os demais campos editáveis.
- Normalizar o Cargo para maiúsculas, acompanhando o trigger do banco.
- Tratar valores legados de Estado civil e Status sem diferenciar maiúsculas de minúsculas e convertê-los para as opções canônicas do formulário.
- Empresa e Obra/Unidade continuam sendo persistidas pelos respectivos UUIDs; a capitalização do nome exibido não participa da gravação.
- No `UPDATE`, solicitar ao Supabase a linha atualizada com os campos críticos. Zero linhas ou divergência de valores deve produzir erro visível, sem fechar o formulário.

## Preenchimento automático da jornada

Ao selecionar Obra/Unidade, usar `workplaces.type` para aplicar:

- `OBRA`: 07:30–12:00 / 13:15–17:33, 44 horas, Segunda a Sexta.
- `SEDE`, `PLANTÃO DE VENDAS` ou tipo contendo “PLANTÃO/PLANTAO”: 07:45–12:00 / 13:15–17:48, 44 horas, Segunda a Sexta.
- Outros tipos: não alterar a jornada.

O preenchimento acontece a cada alteração explícita de Obra/Unidade. Os campos permanecem editáveis depois da sugestão automática. Abrir um colaborador existente não recalcula nem sobrescreve sua jornada.

## ASO

Remover somente o campo “Data do ASO” da seção “Documentos e arquivo”. O cadastro de ASO em `RelatedRecords` permanece como fonte da interface para essa informação.

## Testes

- Cargo é normalizado conforme o banco.
- Todos os campos editáveis, inclusive Código do Perfil, fazem parte da consulta.
- Valores legados de Estado civil e Status são convertidos para valores canônicos.
- Cada tipo de unidade retorna a jornada esperada e tipos desconhecidos não retornam sugestão.
- A seção “Documentos e arquivo” não contém o campo de ASO duplicado.

