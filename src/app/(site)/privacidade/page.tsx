import type { Metadata } from "next";
import { getPublicStudio } from "@/server/public-data";
import { Container, SectionHeading } from "@/components/site/section";

export const metadata: Metadata = {
  title: "Aviso de privacidade",
  description: "Como o estúdio trata os dados pessoais enviados pelo site.",
  alternates: { canonical: "/privacidade" },
};

export default async function PrivacyPage() {
  const s = await getPublicStudio();
  const contact = s.privacyContactEmail || s.contact.email;
  return (
    <Container className="py-16 md:py-24">
      <SectionHeading as="h1" eyebrow="Privacidade" title="Aviso de privacidade" />
      <div className="mt-14 space-y-10 leading-relaxed text-bone-dim md:ml-[25%] md:max-w-2xl">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-bone">Quem trata seus dados</h2>
          <p>
            {s.name} é responsável pelos dados pessoais enviados por este site, nos termos da Lei Geral de Proteção de Dados
            (Lei nº 13.709/2018).
          </p>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-bone">Quais dados coletamos e para quê</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-bone">Nome, e-mail e/ou telefone</strong>: para responder sua solicitação, confirmar,
              lembrar ou alterar agendamentos.
            </li>
            <li>
              <strong className="text-bone">Descrição da ideia, local do corpo, tamanho e imagens de referência</strong>: para
              avaliar o projeto e preparar o orçamento. As referências não são publicadas.
            </li>
            <li>
              <strong className="text-bone">Data e horário escolhidos e observações</strong>: para organizar a agenda.
            </li>
            <li>
              <strong className="text-bone">Endereço IP (convertido em código irreversível)</strong>: para prevenir abuso e spam nos formulários.
            </li>
          </ul>
          <p className="mt-3">
            A base legal é a execução de procedimentos preliminares e do contrato de prestação de serviço solicitado por você, e o
            legítimo interesse na segurança do site.
          </p>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-bone">Compartilhamento</h2>
          <p>
            Não vendemos dados. Utilizamos fornecedores de infraestrutura para hospedagem, banco de dados, armazenamento de
            imagens e, quando habilitado, envio de e-mails. Eles tratam os dados apenas para prestar esses serviços.
          </p>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-bone">Cookies</h2>
          <p>
            O site público não utiliza cookies de publicidade ou rastreamento. A área administrativa usa apenas um cookie
            essencial de sessão.
          </p>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-bone">Retenção</h2>
          <p>
            Pedidos de orçamento recusados ou arquivados são excluídos automaticamente após o prazo definido pelo estúdio. Os
            demais dados são mantidos enquanto necessários para o atendimento e para obrigações legais.
          </p>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-bone">Seus direitos</h2>
          <p>
            Você pode pedir acesso, correção ou exclusão dos seus dados, além de informações sobre o tratamento.
            {contact ? (
              <>
                {" "}
                Escreva para{" "}
                <a href={`mailto:${contact}`} className="text-bone underline underline-offset-4">
                  {contact}
                </a>
                .
              </>
            ) : (
              " Entre em contato pelos canais oficiais do estúdio."
            )}
          </p>
        </section>
      </div>
    </Container>
  );
}
