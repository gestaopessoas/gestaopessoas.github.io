# Parecer & Avaliação — referências externas (issue #53)

Levantamento de referências para o redesenho da aba "Parecer & Avaliação" do
modal de entrevista. **Passo de pesquisa: nada aqui é decisão nem implementação.**

Data: 21/09/2026 · Issue: #53 · Milestone: Fluxo de recrutamento

---

## 1. O que a tela é hoje

`src/components/CandidateAssessmentTab.tsx` (369 linhas), usada pela aba 2 de
`src/app/dashboard/entrevistas/page.tsx` e pela ficha do candidato.

| Bloco | Como é |
|---|---|
| Hard Skills | 5 sliders fixos 0–5 (Técnico, Experiência, Ferramentas, Planejamento, Visão de Negócio) |
| Soft Skills | 5 sliders fixos 0–5 (Comunicação, Liderança, Int. Emocional, Res. de Problemas, Equipe) |
| Checklist de Prontidão | 3 checkboxes (salário, início, viagem) |
| Senioridade | esperada × percebida, dois `select` |
| Fit Cultural | bandeira 🟢🟡🔴 + uma linha de justificativa |
| Pontos fortes / a desenvolver | 2 listas fixas de 8 checkboxes genéricos |
| Guia do Avaliador | modal à parte (`GuiaAvaliadorButton.tsx`): roteiro STAR, pergunta por competência, e a escala ancorada 0–5 |

Persistência: EAV em `interview_assessments` / `interview_assessment_values`,
convertido por `src/lib/interviewAssessment.mjs`. Tudo volta como string —
daí o `type AssessmentData = any` no topo do componente.

**O que a tela já acerta:** o Guia do Avaliador é bom e raro. Ele tem método
(STAR), pergunta pronta por competência, "ouça por:" e uma escala ancorada com
texto por nota (`0–1 Não evidenciado` … `5 Referência`). Isso é exatamente o que
a literatura chama de BARS, e é a parte de maior valor do que existe hoje.

---

## 2. Referências externas

### Greenhouse — o desenho de scorecard mais documentado do mercado

- **Focus Attributes:** a empresa escolhe, por etapa de entrevista, **3 a 5
  atributos** em que aquele entrevistador deve focar. A recomendação é explícita:
  nunca passar de cinco por entrevista. O objetivo declarado é comparabilidade
  entre candidatos, não riqueza de dados.
- **Escala forçada de 4 pontos:** `Strong No / No / Yes / Strong Yes` — **sem
  meio-termo**. Obriga uma posição.
- **Overall Recommendation** no rodapé de todo scorecard, respondendo
  "o candidato passou nesta entrevista?". Greenhouse afirma que **não** faz média
  aritmética dos atributos para decidir — as notas são insumo de comparação, a
  recomendação é o veredito.
- **Key takeaways:** campo de texto em que o entrevistador resume o que viu.
  Notas > números.
- **Mecânica de adesão:** lembrete por e-mail logo após a entrevista, SLA de
  prazo para envio, e um **Interviewer Calibration Report** que mostra se um
  entrevistador pontua sistematicamente acima ou abaixo dos colegas.

### Ashby

Kits de entrevista amarrados à etapa do funil, e analytics que expõem
**interviewer drift** (desvio do avaliador) em tempo real. A rastreabilidade da
decisão, da triagem à entrevista, é o argumento central do produto.

### Lever

Scorecards flexíveis por etapa + *AI Interview Companion*: transcreve a
entrevista e gera um resumo estruturado, para padronizar o registro sem depender
de o avaliador digitar bem.

### Brasil — Gupy e Sólides

- **Gupy:** score algorítmico (Gaia) que ordena a fila de candidatos; etapas de
  triagem e vídeo também pontuam. É ranqueamento, não parecer.
- **Sólides:** análise comportamental integrada — perfil (Executor, Comunicador,
  Planejador, Analista) confrontado com o perfil desejado do cargo e da cultura.
  É o equivalente mais próximo do nosso teste psicológico + fit cultural, só que
  o match é mostrado contra um alvo do cargo, não em abstrato.

### O que a pesquisa diz (o que sustenta as escolhas acima)

- Entrevista estruturada tem validade preditiva ~.42–.51 contra ~.38 da não
  estruturada; programas de scorecard de boa qualidade chegam a .45–.62 contra
  .18–.28 de entrevista solta.
- Viés cai pela metade: `d = .59` (não estruturada) → `d = .23` (estruturada).
- **Viés de recência:** esperar até o fim do dia para escrever o parecer produz
  nota que reflete mais o humor do avaliador que a resposta do candidato.
- **Viés de ancoragem:** se um avaliador vê a nota do outro antes de enviar a
  sua, o dado apodrece. **Submissão cega** até todos enviarem é requisito básico.

---

## 3. As lacunas que a comparação expõe

Em ordem de impacto, não de esforço.

**1. Não existe veredito.** A tela produz 10 notas, 3 checkboxes, uma bandeira de
cultura e duas listas de tags — e nenhum campo diz *"contrata ou não"*. Quem lê o
parecer depois precisa inferir. É a diferença mais gritante para todos os ATS
pesquisados, e provavelmente a mudança de maior valor por menor esforço.

**2. As competências são as mesmas para todo cargo.** Dez sliders fixos, de
pedreiro a analista. E o dado do cargo **já existe**: `job_profiles` tem
competências e conhecimentos por cargo, e o `GuiaAvaliadorButton` já os busca
para montar o roteiro. As notas ignoram isso.

**3. Dez notas é o dobro do recomendado.** Greenhouse para em cinco por
entrevista, por comparabilidade. Dez sliders num modal convidam a arrastar tudo
para 3 e seguir a vida.

**4. A escala ancorada está no lugar errado.** O texto que explica o que é um "3"
mora dentro de um modal separado, atrás de um botão. Na hora de pontuar, o
avaliador vê um slider sem rótulo nenhum. A âncora precisa estar no ponto de
decisão.

**5. Não há onde registrar a evidência.** O método é STAR, mas não existe campo
para a situação/tarefa/ação/resultado que o candidato contou. O que sobra são
tags de uma lista fixa de 8 termos genéricos ("Proatividade", "Ansiedade") —
que descrevem o candidato sem provar nada.

**6. O radar é decorativo.** Só aparece em modo leitura, e um pentágono com cinco
eixos de 0 a 5 não distingue dois candidatos bons. Compara mal exatamente onde
comparar importa.

**7. Nada compara avaliadores.** Um candidato com duas entrevistas tem dois
pareceres que ninguém cruza. Sem submissão cega, sem calibração, sem visão
lado a lado.

**8. A aba mistura avaliar com cadastrar.** Teste psicológico, histórico
acadêmico e profissional convivem com as notas. São coisas de natureza
diferente: uma é juízo do avaliador, a outra é dado do candidato.

---

## 4. Decisões tomadas (21/09/2026)

As seis perguntas que mudavam o desenho foram respondidas pelo usuário na mesma
sessão. Ficam registradas aqui; nenhuma foi implementada ainda.

1. ~~**Veredito:** escala forçada de 4 pontos sem meio-termo (estilo Greenhouse),
   ou a bandeira 🟢🟡🔴 que a equipe já entende, promovida a veredito geral?~~
   **Decidido em 21/09/2026: a bandeira.** O vocabulário 🟢🟡🔴 já existe na casa
   (hoje preso ao fit cultural) e é promovido a veredito geral da entrevista, no
   rodapé do parecer, com justificativa obrigatória. A bandeira **não** é média
   das notas — é juízo do avaliador, como o Overall Recommendation do Greenhouse.
   Fica em aberto o que sobra do fit cultural: vira uma das competências
   avaliadas, ou some, já que a bandeira que era dele agora responde pelo todo.

   *Tensão assumida:* a bandeira tem meio-termo (🟡), e a escala de 4 pontos do
   Greenhouse não tem justamente para obrigar uma posição. O 🟡 vai atrair o
   avaliador indeciso. Mitigação possível sem trocar o vocabulário: exigir
   justificativa escrita quando a bandeira for 🟡, e mostrar no relatório quantos
   🟡 cada avaliador emite — quem nunca se decide fica visível.
2. **Competências por cargo: `job_profiles` com fallback padrão.** Cada cargo é
   avaliado pelas competências do seu perfil. Cargo sem perfil cadastrado cai
   para um conjunto padrão de cinco — entrevista nunca trava por falta de
   cadastro. O `GuiaAvaliadorButton` já faz essa busca; a novidade é as notas
   passarem a usá-la.

3. **Histórico: o passado congela.** *(Assumido, não perguntado — o custo de
   errar aqui é baixo e reversível.)* Pareceres antigos continuam sendo lidos
   com as competências que tinham quando foram escritos. O EAV guarda o nome do
   campo em cada linha, então não há migração a fazer: o parecer antigo renderiza
   a régua antiga. O que se perde é comparar candidato de 2026 com candidato de
   2027 por competência — comparação que hoje, com a régua genérica, já era
   ilusória. **Se a decisão for outra, é aqui que muda.**

4. **Evidência: um campo de conclusões por entrevista.** Um texto no rodapé,
   junto da bandeira — o *key takeaways* do Greenhouse. Evidência por competência
   foi descartada por atrito: multiplica a digitação por cinco e o risco real é
   ficar vazio.

5. **Submissão cega: não como regra obrigatória.** O ganho contra viés de
   ancoragem está documentado, mas não vira requisito do desenho. Fica registrado
   aqui para o dia em que o volume de avaliadores por candidato justificar.

6. **Escopo da aba: teste psicológico e históricos saem** para a ficha do
   candidato. O parecer fica só com juízo do avaliador; dado do candidato mora no
   cadastro. É a mesma linha do [ADR 0010](../adr/0010-entrevista-e-evento-com-situacao-propria.md),
   que já tirou o cadastro pessoal de `interviews`.

### O que continua em aberto

- **O que sobra do fit cultural** depois que a bandeira dele virou veredito geral:
  vira uma das competências avaliadas, ou desaparece?
- **Quantas competências por entrevista** quando o perfil do cargo tiver mais que
  cinco — corta nas cinco primeiras, ou o RH marca quais são as de foco?

---

## Fontes

- [Greenhouse — How Focus Attributes improve comparability of interview scorecards](https://www.greenhouse.com/guidance/how-focus-attributes-improve-comparability-of-interview-scorecards)
- [Greenhouse — Tips for improving interview scorecard submission rate](https://www.greenhouse.com/guidance/tips-for-improving-interview-scorecard-submission-rate)
- [Greenhouse — What is an interview scorecard?](https://www.greenhouse.com/resources/glossary/what-is-an-interview-scorecard)
- [Ashby — Building Interviewer Scorecards to Raise Your Talent Bar](https://www.ashbyhq.com/podcast/episodes/building-interviewer-scorecards)
- [Lever — Ashby alternatives (feedback e scorecards)](https://www.lever.co/alternative/ashby-alternatives)
- [Pin — Structured Interviews: How to Run Them and Why They Work](https://www.pin.com/blog/structured-interviews-guide/)
- [ERIC — Exploring Methods for Developing Behaviorally Anchored Rating Scales](https://files.eric.ed.gov/fulltext/EJ1168380.pdf)
- [100hires — Structured interviews: guide + rating scales](https://100hires.com/structured-interviews.html)
- [Gupy — Software de recrutamento e seleção](https://www.gupy.io/software-de-recrutamento-e-selecao)
- [Sólides — ATS de recrutamento e seleção](https://solides.com.br/blog/ats-recrutar-talentos/)
- [Comparativo ATS brasileiros 2026 (Gupy, Kenoby, Sólides, Taqe)](https://cvaudit.com.br/blog/comparativo-ats-brasileiros)
