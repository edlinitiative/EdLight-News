import { describe, expect, it } from "vitest";
import { withLangParam } from "./utils";

describe("withLangParam", () => {
  it("adds Haitian Creole to internal links", () => {
    expect(withLangParam("/news", "ht")).toBe("/news?lang=ht");
    expect(withLangParam("/news?mode=all", "ht")).toBe("/news?mode=all&lang=ht");
  });

  it("removes lang for French links", () => {
    expect(withLangParam("/news?mode=all&lang=ht", "fr")).toBe("/news?mode=all");
  });

  it("leaves external links untouched", () => {
    expect(withLangParam("https://example.com/article", "ht")).toBe("https://example.com/article");
  });
});
