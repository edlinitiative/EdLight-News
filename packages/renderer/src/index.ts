/**
 * @edlight-news/renderer
 *
 * Placeholder — will use Playwright to:
 *  1. Load HTML templates
 *  2. Screenshot them into IG carousel / story images
 *  3. Store assets in GCS and write Asset docs
 */

import type { ContentVersion, Asset } from "@edlight-news/types";

export async function renderCarousel(
  _contentVersion: ContentVersion,
): Promise<Omit<Asset, "id" | "createdAt">[]> {
  // TODO: implement Playwright rendering
  throw new Error("renderCarousel not yet implemented");
}

export async function renderStory(
  _contentVersion: ContentVersion,
): Promise<Omit<Asset, "id" | "createdAt"> | null> {
  // TODO: implement Playwright rendering
  throw new Error("renderStory not yet implemented");
}
