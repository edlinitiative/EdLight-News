/**
 * Unit tests for the ContentVersion post-processor.
 *
 * Run: npx tsx --test packages/generator/src/postprocess/formatContentVersion.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatContentVersion } from "./formatContentVersion.js";
import type { FormatContentVersionInput } from "./formatContentVersion.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(overrides: Partial<FormatContentVersionInput>) {
  return formatContentVersion({
    lang: "fr",
    title: "Test Title",
    ...overrides,
  });
}

// ── 1. Heading normalisation ────────────────────────────────────────────────

describe("heading normalisation", () => {
  it("removes trailing punctuation from headings", () => {
    const result = fmt({
      sections: [
        { heading: "Contexte:", content: "Some text." },
        { heading: "L'événement.", content: "More text." },
        { heading: "Conséquences;", content: "Even more." },
        { heading: "Pourquoi —", content: "Final." },
      ],
    });
    assert.deepStrictEqual(
      result.sections!.map((s) => s.heading),
      ["Contexte", "L'événement", "Conséquences", "Pourquoi"],
    );
  });

  it("strips leading emoji from headings", () => {
    const result = fmt({
      sections: [
        { heading: "📚 Éducation", content: "text" },
        { heading: "🎓 Diplôme obtenu:", content: "text" },
      ],
    });
    assert.strictEqual(result.sections![0]!.heading, "Éducation");
    assert.strictEqual(result.sections![1]!.heading, "Diplôme obtenu");
  });

  it("collapses extra spaces in headings", () => {
    const result = fmt({
      sections: [{ heading: "  Too   many   spaces  ", content: "text" }],
    });
    assert.strictEqual(result.sections![0]!.heading, "Too many spaces");
  });
});

// ── 2. Paragraph splitting ──────────────────────────────────────────────────

describe("paragraph splitting", () => {
  it("splits paragraphs longer than 450 chars at sentence boundaries", () => {
    // Build a paragraph of ~600 chars (3 sentences of ~200 chars each)
    const sentence =
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco. ";
    const longPara = sentence.repeat(3).trim();
    assert.ok(longPara.length > 450, `Test paragraph must be > 450 chars, got ${longPara.length}`);

    const result = fmt({ body: longPara });
    const paraCount = result.body!.split("\n\n").length;
    assert.ok(paraCount >= 2, `Expected split into ≥2 paragraphs, got ${paraCount}`);
  });

  it("does not split paragraphs under 450 chars", () => {
    const shortPara = "This is a short paragraph. It stays together.";
    const result = fmt({ body: shortPara });
    assert.strictEqual(result.body!.split("\n\n").length, 1);
  });

  it("does not split heading lines", () => {
    const result = fmt({ body: "## This is a heading\n\nContent here." });
    assert.ok(result.body!.includes("## This is a heading"));
  });

  it("does not split bullet lists", () => {
    const bullets = "• Item one is here.\n• Item two is here.\n• Item three.";
    const result = fmt({ body: bullets });
    assert.ok(result.body!.includes("• Item one"));
  });
});

// ── 3. Whitespace normalisation ─────────────────────────────────────────────

describe("whitespace normalisation", () => {
  it("collapses 3+ newlines to 2", () => {
    const result = fmt({ body: "Para one.\n\n\n\n\nPara two." });
    assert.ok(!result.body!.includes("\n\n\n"));
    assert.ok(result.body!.includes("Para one.\n\nPara two."));
  });

  it("collapses multiple spaces to one", () => {
    const result = fmt({ body: "Too   many  spaces   here." });
    assert.strictEqual(result.body!, "Too many spaces here.");
  });

  it("trims trailing whitespace on lines", () => {
    const result = fmt({ body: "Line one.   \nLine two.  " });
    const lines = result.body!.split("\n");
    for (const line of lines) {
      assert.strictEqual(line, line.trimEnd());
    }
  });
});

// ── 4. "À confirmer" normalisation ──────────────────────────────────────────

describe("À confirmer / Pou konfime normalisation", () => {
  it("normalises FR variants to 'À confirmer'", () => {
    const variants = [
      "Date: a confirmer",
      "Date: à Confirmer",
      "Date: A confirmer",
      "Date: A CONFIRMER",
    ];
    for (const v of variants) {
      const result = fmt({ lang: "fr", body: v });
      assert.ok(
        result.body!.includes("À confirmer"),
        `Expected "À confirmer" from "${v}", got "${result.body}"`,
      );
    }
  });

  it("normalises HT variants to 'Pou konfime'", () => {
    const variants = [
      "Dat: a konfime",
      "Dat: pou konfime",
      "Dat: Pou Konfime",
      "Dat: POU KONFIME",
    ];
    for (const v of variants) {
      const result = fmt({ lang: "ht", body: v });
      assert.ok(
        result.body!.includes("Pou konfime"),
        `Expected "Pou konfime" from "${v}", got "${result.body}"`,
      );
    }
  });
});

// ── 5. Month normalisation ──────────────────────────────────────────────────

describe("month normalisation", () => {
  it("lowercases capitalised FR months", () => {
    const result = fmt({ lang: "fr", body: "Le 15 Mars 2026, puis en Avril." });
    assert.ok(result.body!.includes("mars"), `Expected "mars" in "${result.body}"`);
    assert.ok(result.body!.includes("avril"), `Expected "avril" in "${result.body}"`);
  });

  it("lowercases capitalised HT months", () => {
    const result = fmt({ lang: "ht", body: "Nan Mas 2026, epi nan Septanm." });
    assert.ok(result.body!.includes("mas"), `Expected "mas" in "${result.body}"`);
    assert.ok(result.body!.includes("septanm"), `Expected "septanm" in "${result.body}"`);
  });

  it("does not touch already-lowercase months", () => {
    const result = fmt({ lang: "fr", body: "Le 15 mars 2026." });
    assert.ok(result.body!.includes("mars"));
  });

  it("does not touch month substrings in other words", () => {
    const result = fmt({ lang: "fr", body: "Le marsouin nage." });
    assert.ok(result.body!.includes("marsouin"));
  });
});

// ── 6. Number formatting ────────────────────────────────────────────────────

describe("number formatting", () => {
  it("formats large numbers with French spacing", () => {
    const result = fmt({ body: "Il y a 10000 étudiants et 1500000 habitants." });
    assert.ok(result.body!.includes("10 000"), `Expected "10 000" in "${result.body}"`);
    assert.ok(result.body!.includes("1 500 000"), `Expected "1 500 000" in "${result.body}"`);
  });

  it("does not format years (1800-2100)", () => {
    const result = fmt({ body: "En 2026, fondé en 1804." });
    assert.ok(result.body!.includes("2026"), `Year 2026 should stay as-is`);
    assert.ok(result.body!.includes("1804"), `Year 1804 should stay as-is`);
  });

  it("does not format numbers inside URLs", () => {
    const result = fmt({
      body: "Voir https://example.com/page/12345 pour plus d'info.",
    });
    assert.ok(
      result.body!.includes("https://example.com/page/12345"),
      "URL numbers should not be formatted",
    );
  });
});

// ── 7. Source citations ─────────────────────────────────────────────────────

describe("source citations", () => {
  it("deduplicates sources by normalised URL", () => {
    const result = fmt({
      sourceCitations: [
        { name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Haiti" },
        { name: "Wikipedia FR", url: "https://en.wikipedia.org/wiki/Haiti" },
        { name: "Other", url: "https://example.com" },
      ],
    });
    assert.strictEqual(result.sourceCitations!.length, 2);
  });

  it("fills empty source names from domain", () => {
    const result = fmt({
      sourceCitations: [
        { name: "", url: "https://en.wikipedia.org/wiki/Haiti" },
      ],
    });
    assert.ok(result.sourceCitations![0]!.name.length > 0);
    assert.ok(result.sourceCitations![0]!.name.includes("wikipedia"));
  });

  it("normalises URLs without protocol", () => {
    const result = fmt({
      sourceCitations: [
        { name: "Test", url: "example.com/page" },
      ],
    });
    assert.ok(result.sourceCitations![0]!.url.startsWith("https://"));
  });

  it("appends Sources section for non-News series", () => {
    const result = fmt({
      series: "HaitiHistory",
      sections: [{ heading: "L'histoire", content: "Some content." }],
      sourceCitations: [
        { name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Haiti" },
      ],
    });
    const lastSection = result.sections![result.sections!.length - 1]!;
    assert.strictEqual(lastSection.heading, "Sources");
    assert.ok(lastSection.content.includes("Wikipedia"));
  });

  it("does NOT append Sources section for News series", () => {
    const result = fmt({
      series: "News",
      sections: [{ heading: "Résumé", content: "Some content." }],
      sourceCitations: [
        { name: "Le Nouvelliste", url: "https://lenouvelliste.com" },
      ],
    });
    const hasSourcesSection = result.sections!.some(
      (s) => s.heading.toLowerCase() === "sources",
    );
    assert.strictEqual(hasSourcesSection, false);
  });

  it("does NOT duplicate Sources section if already present", () => {
    const result = fmt({
      series: "ScholarshipRadar",
      sections: [
        { heading: "Résumé", content: "Content." },
        { heading: "Sources", content: "• Existing source" },
      ],
      sourceCitations: [
        { name: "New Source", url: "https://example.com" },
      ],
    });
    const sourceSections = result.sections!.filter(
      (s) => s.heading.toLowerCase() === "sources",
    );
    assert.strictEqual(sourceSections.length, 1);
  });

  it("uses 'Sous' heading for HT language", () => {
    const result = fmt({
      lang: "ht",
      series: "HaitiHistory",
      sections: [{ heading: "Istwa", content: "Kontni." }],
      sourceCitations: [
        { name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Haiti" },
      ],
    });
    const lastSection = result.sections![result.sections!.length - 1]!;
    assert.strictEqual(lastSection.heading, "Sous");
  });
});

// ── 8. Title cleanup ────────────────────────────────────────────────────────

describe("title cleanup", () => {
  it("trims whitespace", () => {
    const result = fmt({ title: "  Spaced Title  " });
    assert.strictEqual(result.title, "Spaced Title");
  });

  it("removes trailing punctuation", () => {
    const result = fmt({ title: "Title with period." });
    assert.strictEqual(result.title, "Title with period");
  });

  it("collapses double spaces", () => {
    const result = fmt({ title: "Title  with   spaces" });
    assert.strictEqual(result.title, "Title with spaces");
  });
});

// ── 9. Summary processing ───────────────────────────────────────────────────

describe("summary processing", () => {
  it("applies text normalisations to summary", () => {
    const result = fmt({
      lang: "fr",
      summary: "Date: a confirmer.  Le 15 Mars   2026.",
    });
    assert.ok(result.summary!.includes("À confirmer"));
    assert.ok(result.summary!.includes("mars"));
    assert.ok(!result.summary!.includes("  "));
  });
});

// ── 10. Full integration ────────────────────────────────────────────────────

describe("full integration", () => {
  it("processes a complete content version without error", () => {
    const result = formatContentVersion({
      lang: "fr",
      title: "📚 Bourse d'études — date limite:",
      summary: "Date: a confirmer. Environ 10000 dollars disponibles en Mars 2026.",
      sections: [
        { heading: "🎓 Résumé:", content: "Cette bourse offre 10000 dollars." },
        { heading: "Éligibilité.", content: "Étudiants haïtiens, GPA 3.0 minimum." },
      ],
      body: "Corps de l'article avec 10000 participants attendus en Avril.",
      sourceCitations: [
        { name: "Campus France", url: "https://campusfrance.org/bourses" },
        { name: "", url: "campusfrance.org/bourses" },
      ],
      series: "ScholarshipRadar",
    });

    // Title: emoji stripped, trailing punct stripped
    assert.strictEqual(result.title, "Bourse d'études — date limite");

    // Summary: À confirmer, month normalised, number formatted
    assert.ok(result.summary!.includes("À confirmer"));
    assert.ok(result.summary!.includes("10 000"));
    assert.ok(result.summary!.includes("mars"));

    // Sections: heading normalised
    assert.strictEqual(result.sections![0]!.heading, "Résumé");
    assert.strictEqual(result.sections![1]!.heading, "Éligibilité");

    // Body: number formatted, month normalised
    assert.ok(result.body!.includes("10 000"));
    assert.ok(result.body!.includes("avril"));

    // Sources: deduplicated (campusfrance.org/bourses appears twice)
    assert.strictEqual(result.sourceCitations!.length, 1);

    // Sources section appended (ScholarshipRadar)
    const lastSection = result.sections![result.sections!.length - 1]!;
    assert.strictEqual(lastSection.heading, "Sources");
  });
});
