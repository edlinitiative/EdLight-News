import { describe, it, expect } from "vitest";
import { rankFeed } from "./ranking";
import type { FeedItem } from "../components/news-feed";

/** Minimal legacy FeedItem (no audienceFitScore → always passes the threshold). */
function item(partial: Partial<FeedItem> & { id: string; title: string }): FeedItem {
  return {
    summary: partial.title,
    body: partial.title,
    status: "published",
    citations: [],
    ...partial,
  } as FeedItem;
}

const OPTS = { audienceFitThreshold: 0.3, publisherCap: 10, topN: 50 };

describe("rankFeed dedup", () => {
  it("merges an evolving news story whose title changed (death toll update)", () => {
    const out = rankFeed(
      [
        item({ id: "a", title: "Double séisme au Venezuela : bilan dépassant 3 000 morts", geoTag: "Global", category: "news" }),
        item({ id: "b", title: "Séismes au Venezuela : bilan dépassant 3 500 morts, des milliers de disparus", geoTag: "Global", category: "news" }),
      ],
      OPTS,
    );
    expect(out).toHaveLength(1);
  });

  it("does NOT merge two distinct scholarships that share common words", () => {
    const out = rankFeed(
      [
        item({ id: "a", title: "Bourse Fulbright Haïti 2026 : master aux États-Unis", vertical: "opportunites", category: "scholarship" }),
        item({ id: "b", title: "Bourse Chevening Haïti 2026 : master au Royaume-Uni", vertical: "opportunites", category: "scholarship" }),
      ],
      OPTS,
    );
    expect(out).toHaveLength(2);
  });

  it("does NOT merge two unrelated Haiti news items", () => {
    const out = rankFeed(
      [
        item({ id: "a", title: "Insécurité à Port-au-Prince : nouveau bilan", geoTag: "HT", category: "local_news" }),
        item({ id: "b", title: "Rentrée scolaire au Cap-Haïtien : les inscriptions ouvrent", geoTag: "HT", category: "local_news" }),
      ],
      OPTS,
    );
    expect(out).toHaveLength(2);
  });
});
