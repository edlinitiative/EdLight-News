import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPost, isExportReady } from "./engine/buildSlides.js";
import { adaptLegacyPayload } from "./engine/adaptLegacyPayload.js";
import { renderPost } from "./engine/renderSlides.js";
import { closeBrowser } from "../index.js";
import type { IGFormattedPayload, IGQueueItem } from "@edlight-news/types";
import type { ContentIntakeInput, PostCaption, SlideContent } from "./types/post.js";

after(async () => {
  await closeBrowser();
});

function pngDimensions(buffer: Buffer): { width: number; height: number } {
  assert.equal(buffer.toString("ascii", 1, 4), "PNG", "expected a PNG buffer");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

describe("IG Engine production render path", () => {
  it("builds and renders a validated news post at the production canvas size", async () => {
    const intake: ContentIntakeInput = {
      contentTypeHint: "news-carousel",
      topic: "Université d'État annonce un nouveau calendrier d'examens",
      sourceSummary: "Le calendrier précise les dates clés pour les étudiants.",
      category: "news",
      preferredLanguage: "fr",
      sourceNote: "MENFP · Haïti",
    };

    const rawSlides: SlideContent[] = [
      {
        slideNumber: 1,
        layoutVariant: "cover",
        label: "ACTUALITÉ",
        headline: "Nouveau calendrier pour les examens",
        supportLine: "Les étudiants disposent maintenant des dates clés.",
        sourceLine: "MENFP · Haïti",
      },
      {
        slideNumber: 2,
        layoutVariant: "detail",
        headline: "Ce qui change",
        body: "Les inscriptions commencent cette semaine. Les centres publieront les listes finales avant les épreuves.",
        sourceLine: "MENFP · Haïti",
      },
    ];

    const caption: PostCaption = {
      text: "Le nouveau calendrier aide les étudiants à mieux préparer les prochaines étapes.",
      hashtags: ["#Haïti", "#Éducation", "#EdLightNews"],
      cta: "Suivez @edlightnews pour les mises à jour utiles.",
    };

    const { post, overflowWarnings } = buildPost({ intake, rawSlides, caption });

    assert.equal(post.status, "validated");
    assert.equal(isExportReady(post), true);
    assert.deepEqual(overflowWarnings, []);

    const rendered = await renderPost(post, "news", {
      deviceScaleFactor: 1,
      failOnDomOverflow: true,
    });

    assert.equal(rendered.length, 2);
    for (const slide of rendered) {
      assert.deepEqual(pngDimensions(slide.png), { width: 1080, height: 1350 });
      assert.equal(slide.widthPx, 1080);
      assert.equal(slide.heightPx, 1350);
    }
  });

  it("adapts and renders the scholarship flow through the same engine used by publishing", async () => {
    const payload: IGFormattedPayload = {
      slides: [
        {
          heading: "Bourse internationale pour étudiants haïtiens",
          bullets: ["Couverture — frais de scolarité", "Date limite — 15 juin 2026"],
          layout: "headline",
        },
        {
          heading: "Qui peut postuler ?",
          bullets: ["Étudiants haïtiens", "Bon dossier académique", "Dossier soumis en ligne"],
          layout: "explanation",
        },
        {
          heading: "Candidature",
          bullets: ["Préparez relevés et lettre de motivation", "Envoyez le dossier sur le portail officiel"],
          layout: "explanation",
          footer: "Source officielle · 2026",
        },
        {
          heading: "Suivez EdLight News",
          bullets: ["Bourses et opportunités chaque semaine."],
          layout: "cta",
        },
      ],
      caption:
        "Une bourse ouverte aux étudiants haïtiens avec une date limite claire.\n\nDate limite — 15 juin 2026\n\n#Bourse #Haïti #EdLightNews",
    };

    const queueItem = {
      id: "scholarship-preview",
      sourceContentId: "item-1",
      igType: "scholarship",
      score: 95,
      status: "queued",
      reasons: [],
      createdAt: { seconds: 0, nanoseconds: 0 },
      updatedAt: { seconds: 0, nanoseconds: 0 },
    } as unknown as IGQueueItem;

    const { intake, rawSlides, caption, contentType } = adaptLegacyPayload(queueItem, payload);
    const { post, overflowWarnings } = buildPost({ intake, rawSlides, caption });

    assert.equal(contentType, "scholarship");
    assert.equal(post.templateId, "opportunity-carousel");
    assert.equal(post.status, "validated");
    assert.equal(isExportReady(post), true);
    assert.deepEqual(overflowWarnings, []);

    const rendered = await renderPost(post, contentType, {
      deviceScaleFactor: 1,
      failOnDomOverflow: true,
    });

    assert.equal(rendered.length, payload.slides.length);
    assert.deepEqual(pngDimensions(rendered[0]!.png), { width: 1080, height: 1350 });
  });
});
