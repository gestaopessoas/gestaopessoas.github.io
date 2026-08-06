# Folha salarial e benefícios no cadastro de colaboradores

## Objetivo

Suportar cargos com e sem nível na tabela salarial, aplicar salários de experiência e pós-90 dias, alertar sobre a alteração salarial, padronizar a entrada monetária e corrigir a persistência de VR e Nível no cadastro de colaboradores.

## Tabela salarial

Cada registro de `salary_table` representará uma faixa por cargo e modalidade (CLT ou PJ).

- Cargos com nível mantêm o comportamento atual: Cargo + Modalidade + Nível + Salário Base.
- Cargos sem nível usam: Cargo + Modalidade + Salário de Experiência + Salário Pós-90 dias. O nível do colaborador permanece vazio.
- Uma flag explícita `uses_level` determina o tipo do cargo; nunca se deduz o tipo pela ausência acidental de nível.
- Os valores pós-90 dias podem ficar vazios quando não houver ajuste previsto. Nesse caso, o sistema não gera alerta.
- Registros existentes mantêm compatibilidade: `uses_level` inicia como verdadeiro e o salário atual permanece como salário base.

## Cadastro do colaborador

- Ao escolher Cargo, Modalidade e, quando aplicável, Nível, o sistema sugere o salário da tabela salarial.
- Para cargos sem nível, o campo Nível é desabilitado e limpo; o salário sugerido é o de experiência quando a admissão tem menos de 90 dias e o pós-90 dias depois disso.
- A aba de experiência mostra um aviso a partir de 7 dias antes do 90º dia e no vencimento, somente se houver salário pós-90 dias configurado e `employees.base_salary` ainda corresponder ao salário de experiência.
- O aviso identifica colaborador, cargo, data de mudança e valores atual/pós-90 dias.

## Valores monetários

- Salário Base, Comissão, Variável e os valores da tabela salarial usam entrada brasileira `XX.XXX,XX`.
- A tela guarda o valor como texto durante a edição, converte para número decimal somente ao salvar e formata o número carregado do banco sem perder centavos.
- Campos vazios permanecem `null`; zero permanece `0`.

## VR e Nível

- O Nível passa a integrar a confirmação pós-salvamento do colaborador.
- Ao adicionar/remover um benefício, inclusive VR, a interface exibe o erro real do Supabase e não altera a marcação visual até a operação terminar com sucesso.
- A policy de inserção de `employee_benefits` permite usuários que possam criar **ou editar** colaboradores, alinhando a inclusão de benefício à edição do colaborador existente.

## Banco de dados e segurança

- Migration adiciona `uses_level`, `salary_experience` e `salary_after_probation` a `salary_table`, preservando registros existentes.
- Migration recria apenas a policy `employee_benefits_insert`, para `authenticated`, usando `can_access('colaboradores', 'create') OR can_access('colaboradores', 'edit')`.
- Nenhuma chave de serviço será usada no cliente.

## Testes

- Regras de seleção identificam cargos com e sem nível e escolhem o salário correto antes/depois de 90 dias.
- Alertas aparecem nos dias 83 a 90 quando a troca ainda é necessária e desaparecem após a mudança.
- Conversão monetária aceita `1.234,56`, preserva `0` e rejeita caracteres inválidos.
- Falha no VR é exibida ao usuário e não deixa o checkbox selecionado.
- Nível divergente no retorno do `UPDATE` mantém o formulário aberto.

