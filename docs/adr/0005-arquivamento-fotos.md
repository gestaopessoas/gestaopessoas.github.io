# 5. Fotos com mais de 30 dias são arquivadas no Google Drive, com link público (não-adivinhável) salvo no banco

Data: 2026-09-01

## Status

Rejeitado (2026-09-01, mesmo dia). Ao checar o uso real do Storage no Supabase, o total
usado por todos os buckets do projeto era ~280 KB — a economia que motivava a feature não
existe na prática hoje. Decisão: manter tudo no Supabase e não arquivar fora dele por
enquanto. Tabela `employee_photo_archives` foi removida (nunca chegou a ser usada em
produção) e o código de mesclagem de fontes em `EmployeePhotoLinks` foi revertido. Este
registro fica como referência caso o uso de Storage cresça no futuro e a pergunta "dá pra
arquivar fora do Supabase" volte a aparecer — os trade-offs abaixo (SharePoint exige admin
M365; Google Drive não exige admin mas não tem link restrito à empresa sem Workspace com
domínio próprio; sem servidor não há como esconder chave de criptografia) continuam válidos.

## Contexto

O bucket `employee-photos` no Supabase Storage guarda as fotos de aniversário/admissão
enviadas pelos colaboradores via link público (`/enviar-foto`, issue #46). Para reduzir o
uso de storage do Supabase, fotos com mais de 30 dias precisam sair de lá — mas continuar
visíveis no dashboard do RH (`RelatedRecords.tsx`).

O site é 100% estático (`next.config.ts` com `output: "export"`, deploy no GitHub Pages,
sem servidor). Isso descarta qualquer solução que dependa de um backend rodando em produção,
e também descarta criptografia real do lado do cliente: **qualquer chave de
descriptografia usada no navegador acaba embutida no JavaScript público do site** — não há
onde guardar um segredo do lado do servidor. Criptografar o arquivo e ainda assim publicar a
chave junto daria uma falsa sensação de segurança.

A primeira tentativa foi SharePoint via Microsoft Graph API (upload direto + link
`scope: organization`, sem exigir segundo login), documentada e implementada, mas
descartada porque **o registro do aplicativo no Azure AD exige um administrador do
Microsoft 365 da empresa**, que o usuário não é e não tem como conseguir rapidamente.
Considerou-se também rodar o script direto na máquina onde a pasta do SharePoint já está
sincronizada via OneDrive, mas essa máquina não é a mesma onde o Claude Code / o
repositório rodam — o script não teria como alcançar aquela pasta.

Google Drive resolve o bloqueio de acesso: uma conta de serviço num projeto Google Cloud
próprio (gratuito, qualquer conta Google cria) recebe acesso a uma pasta específica do Drive
do mesmo jeito que se compartilha com uma pessoa comum — sem aprovação de administrador.
Em troca, perde-se a opção "só quem é da empresa acessa sem login" (que exigiria Google
Workspace com domínio próprio, incerto neste caso) — o link fica "qualquer pessoa com o link
pode ver". O usuário optou explicitamente por essa simplicidade em vez de exigir login para
ver cada foto.

## Decisão

Um script (`scripts/archive-old-photos.mjs`, rodado manualmente ou agendado no computador do
RH) baixa a foto do Supabase Storage, faz upload para uma pasta do Google Drive (via conta de
serviço, API do Drive), marca o arquivo como "qualquer pessoa com o link pode ver", grava a
linha em `public.employee_photo_archives` (colunas `archive_file_id`/`archive_url`,
deliberadamente genéricas — não amarradas a "SharePoint" nem "Drive" no nome, para não
repetir esse custo de renomear numa próxima troca de provedor) e só então remove o arquivo
do bucket `employee-photos`. `EmployeePhotoLinks` (`RelatedRecords.tsx`) busca as duas fontes
(Storage + `employee_photo_archives`) em paralelo e mescla a lista por finalidade
(aniversário/admissão).

Sem criptografia. A mitigação real de privacidade é dupla: (1) o ID do arquivo no Drive é
uma string longa gerada pelo Google, não-adivinhável — ninguém acha por acaso, só quem tem o
link específico; (2) a página `/enviar-foto` agora avisa explicitamente ao colaborador que a
foto ficará armazenada e pode ter a exclusão solicitada a qualquer momento (consentimento e
transparência, no espírito da LGPD, ainda que sem um fluxo de auto-exclusão — pedidos são
tratados manualmente pelo RH por enquanto).

## Consequências

- Qualquer pessoa que descubra o link de uma foto arquivada (por exemplo, se ele vazar por
  engano) consegue abri-la sem precisar de conta nem login — não há controle de acesso real
  além do link ser difícil de adivinhar.
- Não existe expiração nem revogação automática do link; remover o acesso depois exige apagar
  o arquivo do Drive ou trocar a permissão manualmente lá.
- Um pedido de exclusão do colaborador hoje é 100% manual (RH apaga o arquivo do Drive e a
  linha da tabela à mão) — não há um botão de autoatendimento.
- Se a empresa migrar para Google Workspace com domínio próprio, ou se algum dia alguém com
  acesso admin ao Microsoft 365 aparecer, esta decisão pode ser revisitada em favor de um link
  restrito à organização (menos exposto que "qualquer um com o link").
