-- A nota de soft skill "Comunicação" gravava em `communication`, o mesmo nome do campo de
-- texto legado do parecer (apagado em 20260914230000). Hoje só a nota escreve ali, então
-- isto é clareza de nome: `communication_score` diz que é nota, como o slider (issue #73).
begin;

-- Se por acaso já existir a linha nova para o mesmo parecer, a antiga é a que sai: a
-- unique (assessment_id, field, item_index) recusaria o UPDATE e derrubaria a migração.
delete from public.interview_assessment_values antiga
 where antiga.field = 'communication'
   and exists (
     select 1
       from public.interview_assessment_values nova
      where nova.assessment_id = antiga.assessment_id
        and nova.field = 'communication_score'
        and nova.item_index = antiga.item_index
   );

update public.interview_assessment_values
   set field = 'communication_score'
 where field = 'communication';

commit;
