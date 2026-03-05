import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Deletion | EdLight News",
  description: "Request data deletion from EdLight News.",
};

export default function DataDeletionPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 prose dark:prose-invert">
      <h1>Data Deletion / Suppression des données</h1>
      <p className="text-sm text-gray-500">Last updated: March 5, 2026</p>

      <h2>We don&apos;t store your data</h2>
      <p>
        EdLight News does <strong>not</strong> collect, store, or process any
        personal user data. We do not require accounts, logins, or any form of
        registration. Our Instagram integration is used solely to publish
        educational content from our own account — we never access third-party
        user data.
      </p>

      <h2>Facebook / Instagram Login</h2>
      <p>
        If you logged into our app via Facebook during development or testing
        and would like to revoke access:
      </p>
      <ol>
        <li>
          Go to your{" "}
          <a
            href="https://www.facebook.com/settings?tab=applications"
            target="_blank"
            rel="noopener noreferrer"
          >
            Facebook App Settings
          </a>
        </li>
        <li>Find &quot;EdLight News&quot; in the list</li>
        <li>Click &quot;Remove&quot; to revoke all access</li>
      </ol>

      <h2>Request Deletion</h2>
      <p>
        If you believe we hold any of your data and would like it deleted,
        please email us at{" "}
        <a href="mailto:contact@edlightinitiative.org">
          contact@edlightinitiative.org
        </a>{" "}
        and we will respond within 30 days.
      </p>

      <hr />

      <h2>Suppression des données (Français)</h2>
      <p>
        EdLight News ne collecte ni ne stocke aucune donnée personnelle. Si
        vous avez connecté votre compte Facebook à notre application et
        souhaitez révoquer l&apos;accès, rendez-vous dans vos{" "}
        <a
          href="https://www.facebook.com/settings?tab=applications"
          target="_blank"
          rel="noopener noreferrer"
        >
          paramètres d&apos;applications Facebook
        </a>
        . Pour toute demande de suppression, contactez{" "}
        <a href="mailto:contact@edlightinitiative.org">
          contact@edlightinitiative.org
        </a>
        .
      </p>
    </main>
  );
}
