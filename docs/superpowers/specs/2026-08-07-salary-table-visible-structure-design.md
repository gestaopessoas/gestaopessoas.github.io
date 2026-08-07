# Estrutura visível da tabela salarial

## Objetivo

Tornar a estrutura salarial perceptível na listagem principal. Hoje os campos para cargos sem nível existem no formulário, mas ficam escondidos atrás de “Gerenciar Níveis”, dando a impressão de que a mudança não foi publicada.

## Comportamento aprovado

- A listagem terá as colunas **Estrutura**, **Experiência**, **Pós-90 dias** e **Ações**.
- Um cargo que contenha ao menos uma faixa `uses_level = false` será identificado como **Sem nível**.
- Para cargos sem nível, a listagem mostrará os salários de experiência e pós-90 dias separados por modalidade (CLT e PJ), com máscara brasileira.
- Para cargos com nível, a estrutura será **Com nível** e as colunas salariais mostrarão uma indicação curta de que os valores estão organizados por nível.
- A ação será contextual: **Gerenciar salários** para cargos sem nível e **Gerenciar níveis** para cargos com nível.
- Os dados existentes serão preservados. Esta mudança não converte, exclui nem consolida automaticamente registros antigos.
- Em cadastros mistos ou inconsistentes, a presença de uma faixa sem nível prevalece na apresentação, enquanto o diálogo continua permitindo inspecionar todas as faixas.

## Arquitetura

A regra de agrupamento e resumo ficará em um módulo JavaScript puro, separado do componente React, para permitir testes com `node:test`. A página continuará buscando `salary_table` no Supabase, mas usará o resumo derivado para renderizar a tabela e escolher os rótulos contextuais.

## Tratamento de estados

- Salário ausente: mostrar `—`, sem inventar valor zero.
- Mais de uma faixa da mesma modalidade: usar a primeira na ordem recebida e preservar todas no diálogo de gerenciamento.
- Busca: continuar filtrando por nome e código.
- Carregamento e lista vazia: ajustar o `colSpan` ao novo número de colunas.

## Verificação

- Teste unitário do resumo para cargos com nível, sem nível, modalidades incompletas e dados mistos.
- TypeScript sem erros.
- ESLint sem novos erros na página alterada.
- Build de produção concluído.
- Validação no site publicado, abrindo a Tabela Salarial e confirmando as novas colunas e rótulos.

## Correção adicional: confirmação visual do VR

O banco normaliza `employee_benefits.benefit_name` para maiúsculas. A tela deve comparar o benefício salvo com o benefício configurado sem diferenciar caixa ou acentos, reconhecer sufixos de nível normalizados e aguardar a releitura do banco antes de concluir a inclusão. Isso evita que um VR já inserido pareça desmarcado e reduz novas inclusões duplicadas, sem excluir registros existentes.
