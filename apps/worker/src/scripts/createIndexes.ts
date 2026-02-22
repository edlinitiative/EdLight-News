/**
 * Creates the required Firestore composite indexes using the service account
 * from .env (no Firebase CLI login required).
 */
import "dotenv/config";
import { GoogleAuth } from "google-auth-library";

const PROJECT = process.env.FIREBASE_PROJECT_ID!;
const DATABASE = "(default)";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DATABASE}/collectionGroups`;

const auth = new GoogleAuth({
  credentials: {
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  projectId: PROJECT,
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

interface IndexField {
  fieldPath: string;
  order?: "ASCENDING" | "DESCENDING";
}

const INDEXES: { collection: string; fields: IndexField[] }[] = [
  {
    collection: "items",
    fields: [
      { fieldPath: "itemType", order: "ASCENDING" },
      { fieldPath: "createdAt", order: "DESCENDING" },
    ],
  },
  {
    collection: "utility_queue",
    fields: [
      { fieldPath: "status", order: "ASCENDING" },
      { fieldPath: "runAt", order: "ASCENDING" },
    ],
  },
];

async function createIndex(collection: string, fields: IndexField[]) {
  const client = await auth.getClient();
  const url = `${BASE}/${collection}/indexes`;
  const body = {
    queryScope: "COLLECTION",
    fields: fields.map((f) => ({
      fieldPath: f.fieldPath,
      order: f.order ?? "ASCENDING",
    })),
  };

  const res = await client.request({ url, method: "POST", data: body });
  return res.data;
}

async function main() {
  for (const idx of INDEXES) {
    try {
      console.log(`Creating index: ${idx.collection}(${idx.fields.map((f) => f.fieldPath).join(", ")}) …`);
      const result = await createIndex(idx.collection, idx.fields);
      console.log("  ✅", (result as any).name ?? "submitted");
    } catch (err: any) {
      if (err?.response?.status === 409) {
        console.log("  ⏭️  Already exists");
      } else {
        console.error("  ❌", err?.response?.data?.error?.message ?? err.message);
      }
    }
  }
  console.log("\nDone. Indexes may take a few minutes to become READY.");
}

main();
