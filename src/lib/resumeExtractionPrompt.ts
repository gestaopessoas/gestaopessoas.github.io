// Prompt único de extração de currículo por IA.
//
// Antes existiam três prompts divergentes (dashboard/entrevistas, CandidateProfileModal e
// resumeAI.ts), cada um errando de um jeito. Este é a fonte única: os três chamadores
// montam o prompt daqui e cada um lê só as chaves que lhe interessam — o JSON é superset.
//
// As regras abaixo NÃO são genéricas: foram calibradas lendo os ~40 currículos reais em
// Documents/Curriculos. Cada regra existe porque um currículo daquele conjunto quebrava a
// extração. Não enxugue sem reler aqueles PDFs.

/** Recorte de texto enviado à IA. Currículos do conjunto real cabem folgados em 12k. */
const MAX_RESUME_CHARS = 12000;

// O modelo deixou de ser constante aqui: agora é configurável pelo administrador em
// Configurações › IA. Ver src/lib/resumeModelSettings.ts, que também guarda o padrão usado
// quando ninguém configurou nada.
export { DEFAULT_RESUME_MODEL as GEMINI_MODEL, geminiGenerateUrl } from "./resumeModelSettings";

const OUTPUT_SHAPE = `{
  "name": "Nome completo do candidato",
  "email": "E-mail principal",
  "secondary_email": "E-mail secundário, só se for DIFERENTE do principal",
  "phone": "Telefone principal com DDD",
  "secondary_phone": "Telefone secundário, só se for DIFERENTE do principal",
  "emergency_contact_name": "Nome do contato de recado/emergência",
  "emergency_contact_phone": "Telefone de recado/emergência",
  "age": "Idade só em números (ex: 33)",
  "birth_date": "Data de nascimento em YYYY-MM-DD",
  "cpf": "CPF no formato 000.000.000-00",
  "gender": "Gênero, só se autodeclarado no texto",
  "gender_identity": "Identidade de gênero autodeclarada",
  "sexual_orientation": "Orientação sexual autodeclarada",
  "race_declaration": "Raça/cor autodeclarada",
  "marital_status": "Estado civil (Solteiro, Casado, Divorciado, Viúvo, União Estável)",
  "birthplace": "Naturalidade (cidade/estado de nascimento)",
  "address": "Logradouro, número, complemento e bairro",
  "location": "Cidade de RESIDÊNCIA do candidato no formato 'Cidade - UF'",
  "education": "Escolaridade mais alta, em uma linha (ex: 'Superior incompleto - Engenharia Civil')",
  "professional_summary": "Resumo/perfil profissional, em prosa",
  "experience_summary": "Histórico profissional resumido em texto corrido",
  "salary_expectation": "Pretensão salarial como está no texto (ex: R$ 2.090,00)",
  "has_cnh": true,
  "cnh_category": "Categoria da CNH (ex: B, AB, AE)",
  "languages": "Idiomas e níveis (ex: Inglês Intermediário; Espanhol Básico)",
  "has_dependents": false,
  "dependents_count": 0,
  "dependents_notes": "Nomes/idades dos dependentes",
  "uniform_size": "Tamanho de uniforme (PP, P, M, G, GG, XG)",
  "boot_size": "Número da botina (ex: 42)",
  "courses": "Cursos livres, técnicos e certificações (NRs, SENAI, informática), separados por ';'",
  "academic_list": [
    {
      "course": "Nome do curso ou grau",
      "institution": "Instituição de ensino",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "in_progress": false
    }
  ],
  "experience_list": [
    {
      "role": "Cargo ocupado",
      "company": "Empresa",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "is_current": false,
      "description": "Atividades e realizações"
    }
  ]
}`;

const RULES = `REGRAS DE EXTRAÇÃO (siga todas, na ordem):

R0. NUNCA extraia a vaga/cargo pretendido. Esse campo não existe neste JSON e não deve ser
    inventado em nenhuma outra chave. A vaga é escolhida por uma pessoa num dropdown do
    sistema. Textos como "Objetivo", "Cargo(s) de interesse", "Área de Interesse" ou o cargo
    do último emprego servem, no máximo, para "professional_summary" — nunca como cargo alvo.

R1. NÃO INVENTE. Campo ausente no texto = null (ou [] para listas). É sempre melhor devolver
    null do que um palpite. A maioria destes currículos não tem CPF, naturalidade, contato de
    emergência, dependentes, tamanho de uniforme nem número de botina: nesses casos, null.

R2. NÃO INFIRA dados sensíveis. "gender", "gender_identity", "sexual_orientation" e
    "race_declaration" só podem vir de autodeclaração explícita no texto. Nunca deduza a
    partir do nome próprio, de flexão de palavras ou de foto. Sem declaração = null.

R3. IGNORE o nome do arquivo. Ele frequentemente mente (traz o nome de outra pessoa, ou uma
    anotação interna do RH como "- Operacional"). Use só o conteúdo do documento.

R4. PLACEHOLDERS DE TEMPLATE NÃO SÃO DADOS. Alguns currículos são modelos do Canva/Word
    entregues com os campos de exemplo ainda preenchidos. Se o valor for um destes (ou
    parecido), devolva null e NÃO crie a entrada de experiência/formação correspondente:
    "Teu nome", "Seu nome", "CV Seu nome", "Posto de trabalho", "EMPRESA", "ESCOLA",
    "Título", "Titulo", "De - Até", "De", "Até", "Descrição do cargo ocupado",
    "Introduza o seu e-mail", "Introduza o seu facebook", "Introduza o seu linkedin",
    "Sua nacionalidade", "Não informado", "N/A", "N/I", "-".
    Sinal de alerta: quando o nome grande do topo for placeholder, o nome REAL do candidato
    costuma estar logo abaixo, na linha onde normalmente iria o cargo.

R5. DATAS — sempre normalize para ISO "YYYY-MM-DD". Use dia 01 quando só houver mês/ano, e
    01-01 quando só houver ano. Se não conseguir determinar o ano, devolva null (nunca texto
    livre). Formatos que aparecem de verdade neste acervo e como tratar:
      "06/2025 até 09/2025 (3 mes(es))"  -> 2025-06-01 / 2025-09-01 (descarte a duração)
      "ago. 2025 – jul. 2026"            -> 2025-08-01 / 2026-07-01 (meses abreviados)
      "NOVEMBRO 2025 - ABRIL 2026"       -> 2025-11-01 / 2026-04-01 (mês por extenso, caixa alta)
      "Outubro de 2017 a Novembro de 2018." -> 2017-10-01 / 2018-11-01
      "2019- 2022", "2013 -2017", "2021 a 2026" -> 2019-01-01 / 2022-01-01 etc.
      "01/03/2021 A 07/10/2021"          -> 2021-03-01 / 2021-10-01 (dd/mm/aaaa)
      "03/03/14 - 01/11/14"              -> ano de 2 dígitos: 14 = 2014
      "01.05.1995"                       -> 1995-05-01 (separador ponto)
      "Safra 2022"                       -> 2022-01-01
      "Jun./2015 a Jun./2017"            -> 2015-06-01 / 2017-06-01 (mês abreviado com ponto)
      "Set. 2021 até Maio de 2022"       -> 2021-09-01 / 2022-05-01 (abreviado + extenso juntos)
      "Janeiro até Junho de 2017"        -> 2017-01-01 / 2017-06-01 (ano só no fim)
      "2026/1", "conclusão 2026/1"       -> semestre acadêmico: 2026/1 = 2026-01-01, 2026/2 = 2026-07-01
      "1 Ano E 7 Meses"                  -> só duração, sem datas: start_date e end_date null
      "Previsão: dez/2025"               -> end_date 2025-12-01 com in_progress true
      "6º semestre - em andamento", "5° semestre/ano", "Cursando - 3º Semestre"
                                         -> sem data extraível: datas null e in_progress true

R6. EM ANDAMENTO / ATUAL. Marque is_current (experiência) ou in_progress (formação) como true
    quando aparecer "até o momento", "atual", "atualmente", "andamento", "em andamento",
    "cursando", "presente", "hoje", OU quando a data final for posterior a hoje, OU quando a
    descrição estiver no presente do indicativo ("Atuo como...", "Sou responsável por..."​).
    Quando is_current/in_progress for true, end_date deve ser null.

R7. "Ano de conclusão" NO FUTURO vence o rótulo. Vários currículos dizem "Superior Completo"
    com ano de conclusão 2029/2030/2031. Isso é curso EM ANDAMENTO: in_progress = true,
    end_date = null. Confie no ano, não no rótulo.

R8. FORMAÇÃO ACADÊMICA vs CURSO LIVRE. Em "academic_list" entram apenas graus de ensino
    formal: Fundamental, Médio, Técnico (curso técnico regular), Graduação/Superior,
    Tecnólogo, Pós-graduação, Mestrado, Doutorado. NÃO entram em academic_list (vão para
    "courses"): NR-10/11/12/33/35, brigada de incêndio, primeiros socorros, vigilante,
    transporte de valores, operador de empilhadeira, informática/pacote Office, MS-Project,
    treinamentos SENAI/SENAC/SEST-SENAT de curta duração, palestras, prêmios e concursos.
    Currículos deste acervo misturam os dois sob títulos como "FORMAÇÃO E CURSOS" — separe.

R9. INSTITUIÇÃO DE ENSINO NÃO É EMPREGO. Se a "empresa" de uma experiência for uma escola,
    faculdade ou instituto (IFSul, UFPel, UCPel, SENAI, SENAC, "Curso Técnico em...") e a
    atividade for estudar/fazer projeto acadêmico, isso é formação, não experiência — mova
    para academic_list e não crie entrada em experience_list. EXCEÇÃO: estágio, bolsa,
    monitoria e emprego real dentro da instituição SÃO experiência, mesmo que estejam
    listados fora da seção de experiência (ex: sob "Conhecimento Complementar").

R10. CARGO vs EMPRESA não têm posição fixa. Alguns currículos escrevem "Vigilante | MIX
     Portaria", outros "Serralheria RV – Serralheiro". Decida pelo significado: empresa
     costuma ter Ltda/ME/S.A./Supermercado/Comércio/Transportes ou ser nome próprio de
     negócio; cargo é uma ocupação (Auxiliar, Operador, Motorista, Repositor, Pedreiro).
     Nunca troque um pelo outro só pela ordem em que aparecem.

R11. TEXTO EMBARALHADO. Estes PDFs vêm de layout de duas colunas e de exportadores que
     quebram palavras. Você vai encontrar números de página injetados no meio de palavras
     ("s2e / m6anais" = "semanais", "3 / 4" colado no rótulo seguinte) e palavras grudadas
     ("paraexecução", "pisose azulejos"). Descarte a paginação e reconstitua o espaçamento nas
     descrições. Datas podem aparecer órfãs, numa linha separada dos cursos/cargos a que
     pertencem — associe pela ordem, não pela proximidade literal.

R12. CIDADE DE RESIDÊNCIA. "location" é onde o CANDIDATO mora, não a cidade da escola nem a do
     empregador. Cuidado com bairro colado: em "Fragata - Pelotas, RS" a cidade é Pelotas; em
     "Pelotas/Porto - RS" a cidade é Pelotas. Estado sempre como sigla de 2 letras. Se o
     currículo só traz rua e número, preencha "address" e deixe "location" null.

R13. CONTATOS DUPLICADOS. Muitos exportadores repetem o mesmo número em "Telefone" e
     "Celular", e o mesmo e-mail em principal e secundário. Se o secundário for igual ao
     principal, devolva null no secundário. Telefone e e-mail de terceiros só entram em
     emergency_contact_*, nunca como contato do candidato.

R14. NÃO USE A SEÇÃO DE HABILIDADES COMO FONTE DE FATO. Vários candidatos colaram requisitos
     de anúncios de vaga ali ("POSSUIR CNH AB OU ACIMA", "DESEJÁVEL CONHECIMENTO EM..."). Isso
     descreve a vaga, não o candidato: nunca derive has_cnh, cnh_category ou languages daí.
     has_cnh/cnh_category só de declaração direta ("CNH: B", "CNH AD com EAR").

R15. ORDEM CRONOLÓGICA NÃO É CONFIÁVEL. As experiências frequentemente estão fora de ordem.
     Não assuma que a primeira da lista é a atual — decida pelas datas e pelos marcadores.

R16. Duas experiências com descrição idêntica mas períodos diferentes são registros legítimos
     e distintos (mesma pessoa, mesma função, dois contratos). Não deduplique por descrição.
     Uma mesma empresa pode ter várias funções ao longo do tempo: gere uma entrada por função.

R17. CPF só no formato de 11 dígitos (000.000.000-00). Não confunda com CEP (8 dígitos),
     telefone, RG ou PIS.

R18. Preserve as descrições de atividades por completo — elas são o material mais útil para o
     RH. Não resuma nem corte; apenas conserte o espaçamento quebrado pela extração.

R19. SEÇÃO DE REFERÊNCIAS NÃO É O CANDIDATO. Currículos com "REFERÊNCIAS" listam nome, cargo,
     empresa, telefone e e-mail de TERCEIROS — e em layout de duas colunas esse bloco costuma
     sair PRIMEIRO no texto extraído. Nunca use o primeiro nome/telefone/e-mail que aparecer:
     identifique o candidato pelo nome em destaque do cabeçalho e pelo contato da seção
     "CONTATO"/"Dados pessoais" (que pode estar na ÚLTIMA linha do documento). E-mails
     corporativos ao lado de um nome de terceiro são referência, não contato do candidato.

R20. RECONSTITUA O NOME. Templates gráficos espaçam as letras do nome
     ("V I C T O R  H U G O  S .  O L I V E I R A") ou colam nome e sobrenome
     ("DiegoOliveira"). Devolva o nome em forma normal ("Victor Hugo S. Oliveira",
     "Diego Oliveira"). O nome nem sempre está na primeira linha — em alguns arquivos aparece
     no meio do documento, entre experiências.

R21. CNH EM OBTENÇÃO NÃO É CNH. "CNH (categoria B) em processo de obtenção", "CNH em
     andamento", "fazendo a habilitação" => has_cnh = false e cnh_category = null, mesmo que a
     frase contenha a letra da categoria. has_cnh = true só com posse declarada
     ("CNH: B", "Habilitação: Categoria AB", "CNH AD com EAR").

R22. IDADE E DATA DE NASCIMENTO raramente coexistem. Se houver só a data, calcule a idade. Se
     houver só a idade, preencha "age" e deixe "birth_date" null — NUNCA invente uma data de
     nascimento a partir da idade. Cuidado: a data de nascimento costuma vir sem rótulo, logo
     depois do estado civil ("Brasileira, solteira – 03/04/2007"), ou colada ao rótulo
     ("Data de nascimento:19/04/2007"). Não a confunda com início de emprego.

R23. UF SEMPRE COMO SIGLA DE 2 LETRAS. "Rio Grande do Sul" => RS. E bairro não é cidade:
     em "FRAGATA, Pelotas, RS" a cidade é Pelotas. Bairros comuns nesta base que NÃO são
     cidade: Fragata, Areal, Três Vendas, Simões Lopes, Arco Íris, Centro, Porto, São Gonçalo.

R24. RÓTULOS COLADOS AO VALOR. A extração de PDF frequentemente remove o espaço depois dos
     dois-pontos ("Cidade:Pelotas – RS", "E-mail:miguel@hotmail.com", "Estado Civil:solteiro").
     Separe rótulo e valor mesmo sem espaço. O mesmo vale para URLs quebradas em duas linhas e
     para erros de digitação no original ("htps://", "Engenharia Civíl", "TECNICO EM
     EDIFICACAO" sem acento) — corrija a acentuação óbvia nos valores extraídos.`;

/**
 * Monta o prompt de extração. `text` é o texto cru do PDF/TXT do currículo.
 *
 * A resposta esperada é um único objeto JSON. O chamador deve remover cercas de markdown
 * antes de dar JSON.parse — modelos ainda devolvem ```json de vez em quando.
 */
export function buildResumeExtractionPrompt(text: string): string {
  return `Você é um analista de RH extraindo dados de um currículo brasileiro para um sistema de recrutamento.

Responda APENAS com um objeto JSON válido. Sem crases, sem markdown, sem comentários, sem texto antes ou depois.

Formato exato da resposta:
${OUTPUT_SHAPE}

${RULES}

Texto do currículo:
"""
${text.slice(0, MAX_RESUME_CHARS)}
"""`;
}

/** Remove cercas de markdown e devolve o objeto JSON da resposta do modelo. */
export function parseExtractionResponse(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  // Modelos às vezes prefixam uma frase antes do objeto; recorta do primeiro { ao último }.
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("Resposta da IA sem JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}
