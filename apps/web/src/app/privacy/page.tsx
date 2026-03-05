import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité | EdLight News",
  description: "Politique de confidentialité d'EdLight News.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 prose dark:prose-invert">
      <h1>Privacy Policy / Politique de confidentialité</h1>
      <p className="text-sm text-gray-500">Last updated: March 5, 2026</p>

      <h2>Overview</h2>
      <p>
        EdLight News is a free educational platform that curates scholarships,
        opportunities, and news for Haitian students. This policy explains how we
        handle information in connection with our website and Instagram presence.
      </p>

      <h2>Information We Collect</h2>
      <p>
        EdLight News does <strong>not</strong> require user accounts or collect
        personal data. We do not use cookies for tracking. Basic anonymous
        analytics (page views) may be collected via our hosting provider
        (Vercel).
      </p>

      <h2>Instagram Integration</h2>
      <p>
        We use the Meta/Instagram Graph API solely to publish educational
        carousel posts to our own Instagram Business account. We do not access,
        collect, or store any third-party Instagram user data.
      </p>

      <h2>Data Sharing</h2>
      <p>
        We do not sell, rent, or share any user data with third parties.
      </p>

      <h2>Third-Party Services</h2>
      <ul>
        <li>
          <strong>Vercel</strong> — website hosting (
          <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
            their privacy policy
          </a>
          )
        </li>
        <li>
          <strong>Google Firebase</strong> — content storage (
          <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer">
            their privacy policy
          </a>
          )
        </li>
        <li>
          <strong>Meta Platforms</strong> — Instagram publishing (
          <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">
            their privacy policy
          </a>
          )
        </li>
      </ul>

      <h2>Contact</h2>
      <p>
        For any privacy-related questions, please reach out to{" "}
        <a href="mailto:contact@edlightinitiative.org">
          contact@edlightinitiative.org
        </a>
        .
      </p>

      <hr />

      <h2>Politique de confidentialité (Français)</h2>
      <p>
        EdLight News est une plateforme éducative gratuite destinée aux
        étudiants haïtiens. Nous ne collectons aucune donnée personnelle. Notre
        intégration Instagram sert uniquement à publier du contenu éducatif
        depuis notre propre compte. Nous ne vendons ni ne partageons aucune
        donnée avec des tiers.
      </p>
      <p>
        Pour toute question, contactez-nous à{" "}
        <a href="mailto:contact@edlightinitiative.org">
          contact@edlightinitiative.org
        </a>
        .
      </p>
    </main>
  );
}
