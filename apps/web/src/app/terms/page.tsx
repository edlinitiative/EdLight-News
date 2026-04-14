import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions d'utilisation | EdLight News",
  description: "Conditions d'utilisation d'EdLight News.",
};

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 prose dark:prose-invert">
      <h1>Terms of Service / Conditions d&apos;utilisation</h1>
      <p className="text-sm text-gray-500">Last updated: March 5, 2026</p>

      <h2>About EdLight News</h2>
      <p>
        EdLight News is a free, non-commercial educational platform that
        aggregates scholarships, opportunities, and news for Haitian students.
        The service is provided by EdLight Initiative.
      </p>

      <h2>Use of the Platform</h2>
      <p>
        EdLight News is freely accessible. No account creation is required. By
        using this website or following our Instagram account, you agree to
        these terms.
      </p>

      <h2>Content</h2>
      <p>
        We curate and summarize publicly available scholarship and opportunity
        information. We strive for accuracy but recommend verifying details with
        official sources before applying. EdLight News is not responsible for
        changes made by scholarship providers.
      </p>

      <h2>Instagram Content</h2>
      <p>
        Our Instagram carousel posts are generated from the same curated
        content. They are intended for informational and educational purposes
        only.
      </p>

      <h2>Intellectual Property</h2>
      <p>
        Original content, designs, and branding on EdLight News are the
        property of EdLight Initiative. Scholarship information is attributed to
        its respective sources.
      </p>

      <h2>Limitation of Liability</h2>
      <p>
        EdLight News is provided &quot;as is&quot; without warranties. We are
        not liable for any decisions made based on information published on our
        platform.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Contact us at{" "}
        <a href="mailto:contact@edlightinitiative.org">
          contact@edlightinitiative.org
        </a>
        .
      </p>

      <hr />

      <h2>Conditions d&apos;utilisation (Français)</h2>
      <p>
        EdLight News est une plateforme éducative gratuite et non commerciale
        qui rassemble des bourses, opportunités et actualités pour les étudiants
        haïtiens. Aucun compte n&apos;est requis. Nous nous efforçons d&apos;être
        précis mais recommandons de vérifier les informations auprès des
        sources officielles. Pour toute question, contactez{" "}
        <a href="mailto:contact@edlightinitiative.org">
          contact@edlightinitiative.org
        </a>
        .
      </p>

      <h2>Kondisyon itilizasyon (Kreyòl Ayisyen)</h2>
      <p>
        EdLight News se yon platfòm edikasyon gratis e non-komèsyal ki rasanble
        bous, okazyon ak nouvèl pou elèv ayisyen yo. Pa bezwen kont. Nou fè
        efò pou nou egzak men nou rekòmande pou verifye enfòmasyon yo nan sous
        ofisyèl yo. Pou nenpòt kesyon, kontakte{" "}
        <a href="mailto:contact@edlightinitiative.org">
          contact@edlightinitiative.org
        </a>
        .
      </p>
    </main>
  );
}
