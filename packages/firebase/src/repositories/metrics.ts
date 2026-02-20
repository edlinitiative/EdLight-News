import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type { Metric } from "@edlight-news/types";
import { createMetricSchema, type CreateMetric } from "@edlight-news/types";

const COLLECTION = "metrics";

function collection() {
  return getDb().collection(COLLECTION);
}

export async function createMetric(data: CreateMetric): Promise<Metric> {
  const validated = createMetricSchema.parse(data);
  const ref = collection().doc();
  await ref.set(validated);
  const snap = await ref.get();
  return { id: ref.id, ...snap.data() } as Metric;
}

export async function listByContentVersion(
  contentVersionId: string,
): Promise<Metric[]> {
  const snap = await collection()
    .where("contentVersionId", "==", contentVersionId)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Metric);
}

export async function updateMetric(
  id: string,
  data: Partial<Pick<Metric, "views" | "clicks" | "shares">>,
): Promise<void> {
  await collection().doc(id).update(data);
}
