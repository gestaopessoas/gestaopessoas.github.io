# Memória operacional do projeto

## Planos de desenvolvimento

Sempre que o usuário pedir um plano para este projeto:

1. Começar por otimizações de contexto e economia de tokens.
2. Informar as skills escolhidas, a etapa de uso e o motivo.
3. Organizar o trabalho como workflow autônomo com diagnóstico, implementação, validação e handoff.
4. Manter o plano ativo entre 3 e 5 passos.
5. Aplicar solução mínima, reutilizar o que já existe e evitar refatoração especulativa.
6. Registrar riscos, limites de autonomia, critérios de aceite e melhorias fora do escopo.
7. Consultar a referência canônica em `G:\Meu Drive\0.Auditoria\gestaopessoas.github.io\PLANO_DESENVOLVIMENTO_AUTONOMO.md`.
8. Usar Context Mode para recuperar memória e analisar saídas extensas sem ocupar a janela principal.

## Contexto obrigatório

Antes de alterar código, consultar:

1. `CONTEXT.md`.
2. ADRs em `docs/adr/`.
3. Issue relacionada no GitHub.
4. Documentação local em `node_modules/next/dist/docs/` quando a tarefa tocar o Next.js.

Se `CONTEXT.md` ou a issue ainda não existirem, registrar a lacuna e trabalhar com o menor conjunto de evidências disponível.
