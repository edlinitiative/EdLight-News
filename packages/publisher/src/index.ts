/**
 * @edlight-news/publisher
 *
 * Placeholder — will publish content to:
 *  1. Instagram (via Graph API)
 *  2. WhatsApp (via Cloud API)
 *
 * Processes entries from the publish_queue collection.
 */

import type { PublishQueueEntry } from "@edlight-news/types";

export async function publishToInstagram(
  _entry: PublishQueueEntry,
): Promise<void> {
  // TODO: implement IG Graph API publishing
  throw new Error("publishToInstagram not yet implemented");
}

export async function publishToWhatsApp(
  _entry: PublishQueueEntry,
): Promise<void> {
  // TODO: implement WhatsApp Cloud API publishing
  throw new Error("publishToWhatsApp not yet implemented");
}
