/**
 * Tests for the social generator schema + adapters.
 *
 * The LLM call itself is not tested here (it requires an API key and is
 * non-deterministic). Instead we test:
 *   - input schema parses a representative article object
 *   - output schema accepts the canonical Erasmus example
 *   - output schema rejects common malformed shapes
 *   - adapters produce well-formed FB / Threads payloads under their
 *     respective length budgets
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  socialArticleInputSchema,
  socialPostsOutputSchema,
  type SocialPostsOutput,
} from "./schema.js";
import { socialToFbPayload, socialToThPayload } from "./adapters.js";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ERASMUS_INPUT = {
  articleId: "art_erasmus_misei_2026",
  url: "https://news.edlight.org/news/art_erasmus_misei_2026",
  category: "Bourses" as const,
  language: "fr" as const,
  title: "Bourse Erasmus Mundus MISEI 2026",
  summary: "Master en IA et données médicales, financé en Europe.",
  body: "Programme Erasmus Mundus MISEI ...",
  publishedAt: "2026-04-15",
  deadline: "2026-05-31",
  country: "Europe (multi-country)",
  institution: "AUF / Erasmus Mundus",
  level: "Master" as const,
  coverage: ["tuition", "stipend", "travel"],
  eligibility: ["Étudiants haïtiens francophones"],
  documents: ["CV", "Lettre de motivation"],
  applicationUrl: "https://example.com/apply",
  imageUrl: null,
};

const ERASMUS_OUTPUT: SocialPostsOutput = {
  instagram: {
    post_type: "carousel",
    carousel_slides: [
      {
        slide_number: 1,
        headline: "Master en IA financé en Europe.",
        subheadline: "Erasmus Mundus MISEI",
        body: "Frais, allocation, voyage couverts. Deadline 31 mai.",
        icon: "GraduationCap",
        background_style: "primary",
        iconNotes: null,
      },
    ],
    caption:
      "[Icon: GraduationCap] Bourse Erasmus Mundus MISEI — deadline 31 mai.\n\nUn Master en IA et données médicales, en Europe, entièrement financé.\n\n[Icon: Wallet] Frais de scolarité couverts\n[Icon: Banknote] Allocation mensuelle\n[Icon: Plane] Mobilité internationale\n\nLien dans la bio.",
    hashtags: [
      "#BoursesHaiti",
      "#EtudiantsHaitiens",
      "#Erasmus",
      "#MasterIA",
      "#EtudierEnEurope",
    ],
    alt_text: "Carrousel sur la bourse Erasmus Mundus MISEI 2026 pour étudiants haïtiens.",
  },
  threads: {
    posts: [
      {
        text: "Bourse Erasmus Mundus MISEI — Master en IA en Europe, entièrement financé. Deadline 31 mai 2026.",
        is_reply_to_previous: false,
      },
      {
        text: "Étudiants haïtiens francophones éligibles. Détails et lien officiel sur news.edlight.org.",
        is_reply_to_previous: true,
      },
    ],
    hashtags: ["#BoursesHaiti", "#Erasmus", "#MasterIA"],
  },
  facebook: {
    post_text:
      "Bourse Erasmus Mundus MISEI 2026 — Master en intelligence artificielle et analyse de données médicales, en Europe, entièrement financé pour les étudiants haïtiens francophones.\n\nCe que la bourse couvre : frais de scolarité complets, allocation mensuelle, et mobilité internationale entre les universités partenaires.\n\nDeadline de candidature : 31 mai 2026. Niveau requis : Master.\n\nDocuments à préparer : CV à jour, lettre de motivation.",
    first_comment: "Tous les détails et le lien officiel : https://news.edlight.org/news/art_erasmus_misei_2026",
    hashtags: ["#BoursesHaiti", "#Erasmus", "#MasterIA", "#Diaspora"],
  },
  shared: {
    primary_cta: "Postule avant le 31 mai 2026.",
    deadline_urgency: "medium",
    best_post_time: null,
  },
};

// ── Input schema ─────────────────────────────────────────────────────────────

test("input schema accepts a complete bourse article", () => {
  const r = socialArticleInputSchema.safeParse(ERASMUS_INPUT);
  assert.equal(r.success, true);
});

test("input schema fills defaults for optional fields", () => {
  const minimal = {
    articleId: "x",
    url: "https://news.edlight.org/news/x",
    category: "Actualités",
    language: "fr",
    title: "T",
    publishedAt: "2026-01-01",
  };
  const r = socialArticleInputSchema.safeParse(minimal);
  assert.equal(r.success, true);
  if (r.success) {
    assert.equal(r.data.deadline, null);
    assert.deepEqual(r.data.coverage, []);
    assert.equal(r.data.summary, "");
  }
});

test("input schema rejects unknown category", () => {
  const r = socialArticleInputSchema.safeParse({
    ...ERASMUS_INPUT,
    category: "Sportifs",
  });
  assert.equal(r.success, false);
});

// ── Output schema ────────────────────────────────────────────────────────────

test("output schema accepts the canonical Erasmus output", () => {
  const r = socialPostsOutputSchema.safeParse(ERASMUS_OUTPUT);
  if (!r.success) console.error(r.error.issues);
  assert.equal(r.success, true);
});

test("output schema rejects an IG caption over 2200 chars", () => {
  const bad: SocialPostsOutput = {
    ...ERASMUS_OUTPUT,
    instagram: {
      ...ERASMUS_OUTPUT.instagram,
      caption: "x".repeat(2201),
    },
  };
  const r = socialPostsOutputSchema.safeParse(bad);
  assert.equal(r.success, false);
});

test("output schema rejects a Threads post over 500 chars", () => {
  const bad: SocialPostsOutput = {
    ...ERASMUS_OUTPUT,
    threads: {
      hashtags: ERASMUS_OUTPUT.threads.hashtags,
      posts: [
        {
          text: "x".repeat(501),
          is_reply_to_previous: false,
        },
      ],
    },
  };
  const r = socialPostsOutputSchema.safeParse(bad);
  assert.equal(r.success, false);
});

test("output schema rejects more than 3 Threads hashtags", () => {
  const bad: SocialPostsOutput = {
    ...ERASMUS_OUTPUT,
    threads: {
      ...ERASMUS_OUTPUT.threads,
      hashtags: ["#a", "#b", "#c", "#d"],
    },
  };
  const r = socialPostsOutputSchema.safeParse(bad);
  assert.equal(r.success, false);
});

test("output schema accepts story_only with empty carousel_slides", () => {
  const story: SocialPostsOutput = {
    ...ERASMUS_OUTPUT,
    instagram: {
      post_type: "story_only",
      carousel_slides: [],
      caption: "[Icon: ScrollText] Histoire d'Haïti — 5 mai.",
      hashtags: ["#HistoireHaiti"],
      alt_text: "Story sur l'histoire d'Haïti du jour.",
    },
  };
  const r = socialPostsOutputSchema.safeParse(story);
  assert.equal(r.success, true);
});

// ── Adapters ─────────────────────────────────────────────────────────────────

test("socialToFbPayload appends hashtags and sets linkUrl", () => {
  const fb = socialToFbPayload(ERASMUS_OUTPUT, {
    articleUrl: "https://news.edlight.org/news/x",
  });
  assert.ok(fb.text.includes("Bourse Erasmus Mundus MISEI 2026"));
  assert.ok(fb.text.endsWith("#BoursesHaiti #Erasmus #MasterIA #Diaspora"));
  assert.equal(fb.linkUrl, "https://news.edlight.org/news/x");
  assert.equal(fb.imageUrl, undefined);
});

test("socialToThPayload stays under 500 chars", () => {
  const th = socialToThPayload(ERASMUS_OUTPUT, {
    articleUrl: "https://news.edlight.org/news/x",
  });
  assert.ok(th.text.length <= 500, `expected ≤500, got ${th.text.length}`);
  assert.ok(th.text.includes("Erasmus"));
  assert.ok(th.text.includes("https://news.edlight.org/news/x"));
});

test("socialToThPayload drops hashtags before truncating lead", () => {
  // Construct a long lead such that lead+URL fits but lead+URL+hashtags does not.
  // lead=460, "\n\n"+URL(28)=30 → 490 (≤500). Adding "\n\n"+tags(16)=18 → 508 (>500).
  // Adapter should drop the hashtag line, keeping the URL and full lead.
  const longLead = "L".repeat(460);
  const out: SocialPostsOutput = {
    ...ERASMUS_OUTPUT,
    threads: {
      hashtags: ["#one", "#two", "#three"],
      posts: [{ text: longLead, is_reply_to_previous: false }],
    },
  };
  const th = socialToThPayload(out, {
    articleUrl: "https://news.edlight.org/n/x",
  });
  assert.ok(th.text.length <= 500, `expected ≤500, got ${th.text.length}`);
  // Hashtags should have been dropped to make room
  assert.equal(th.text.includes("#one"), false);
  // URL must survive
  assert.ok(th.text.includes("https://news.edlight.org/n/x"));
  // Lead should NOT have been truncated (no ellipsis)
  assert.equal(th.text.includes("…"), false);
});

test("socialToThPayload truncates lead when URL alone overflows budget", () => {
  const huge = "X".repeat(700);
  const out: SocialPostsOutput = {
    ...ERASMUS_OUTPUT,
    threads: {
      hashtags: [],
      posts: [{ text: huge, is_reply_to_previous: false }],
    },
  };
  const th = socialToThPayload(out, {
    articleUrl: "https://news.edlight.org/n/x",
  });
  assert.ok(th.text.length <= 500);
  assert.ok(th.text.includes("https://news.edlight.org/n/x"));
  assert.ok(th.text.includes("…"));
});
