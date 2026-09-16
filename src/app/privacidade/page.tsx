import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CONSENT_VERSION } from "@/components/careers/consent";

export const metadata = {
  title: "Política de Privacidade | ACPO Gestão de Pessoas",
  description: "Como a ACPO Empreendimentos trata os dados pessoais de quem se candidata às suas vagas.",
};

// O texto abaixo é rascunho de base, não parecer jurídico. Ao alterar qualquer
// ponto material, subir CONSENT_VERSION em components/careers/consent.ts — é ela
// que fica gravada junto do aceite de cada candidato.
export default function PrivacidadePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href="/carreiras" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Voltar para as vagas
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Versão {CONSENT_VERSION} · ACPO Empreendimentos
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-medium">Quem trata seus dados</h2>
          <p className="mt-2 text-muted-foreground">
            A ACPO Empreendimentos é a controladora dos dados pessoais informados no portal
            de carreiras. Eles são usados exclusivamente para conduzir processos seletivos
            da própria empresa.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">O que coletamos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li><strong>Identificação e contato:</strong> nome, e-mail, telefone, CPF, data de nascimento, naturalidade, estado civil, endereço e LinkedIn.</li>
            <li><strong>Trajetória profissional:</strong> escolaridade, instituições, experiências, idiomas e pretensão salarial.</li>
            <li><strong>Dados operacionais da contratação:</strong> CNH, tamanho de uniforme e de botina, dependentes.</li>
            <li><strong>Dado pessoal sensível:</strong> autodeclaração de raça, de gênero, orientação sexual e condição de pessoa com deficiência.</li>
            <li><strong>Perfil comportamental:</strong> respostas do questionário Big Five, quando você opta por respondê-lo.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-medium">Por que coletamos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Avaliar sua candidatura e entrar em contato sobre o processo seletivo.</li>
            <li>Cumprir obrigações legais da contratação, incluindo a reserva legal de vagas para pessoas com deficiência.</li>
            <li>Produzir indicadores agregados de diversidade, sem identificar pessoas.</li>
            <li>Dimensionar uniforme e equipamento de proteção, caso você seja contratado.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-medium">Dado sensível é opcional</h2>
          <p className="mt-2 text-muted-foreground">
            Raça, gênero, orientação sexual e condição de PcD são de preenchimento voluntário.
            Deixar esses campos em branco não prejudica sua candidatura e não é considerado na
            avaliação. Eles existem para acompanhamento de diversidade e para a reserva legal
            de vagas.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">Com quem compartilhamos</h2>
          <p className="mt-2 text-muted-foreground">
            Com a equipe de recrutamento e os gestores da área da vaga. Os dados ficam
            armazenados em infraestrutura de nuvem contratada pela ACPO. Não vendemos, alugamos
            nem cedemos seus dados a terceiros para fins comerciais.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">Por quanto tempo guardamos</h2>
          <p className="mt-2 text-muted-foreground">
            Sua candidatura fica no banco de talentos por até 2 anos após o último contato,
            para que você seja considerado em vagas futuras. Depois disso é excluída ou
            anonimizada. Se você for contratado, os dados migram para o cadastro de
            colaborador e passam a seguir os prazos legais da relação de trabalho.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">Seus direitos</h2>
          <p className="mt-2 text-muted-foreground">
            A LGPD garante a você confirmar se tratamos seus dados, acessá-los, corrigi-los,
            pedir anonimização ou exclusão, revogar o consentimento e saber com quem foram
            compartilhados. Revogar o consentimento encerra sua participação nos processos
            seletivos em andamento.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">Como exercer</h2>
          <p className="mt-2 text-muted-foreground">
            Escreva para o setor de Gestão de Pessoas da ACPO Empreendimentos informando seu
            nome completo e o e-mail usado na candidatura. Respondemos em até 15 dias.
          </p>
        </section>
      </div>
    </main>
  );
}
