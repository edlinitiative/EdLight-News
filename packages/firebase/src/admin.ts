import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getFirestore, initializeFirestore, type Firestore } from "firebase-admin/firestore";

let app: App;
let db: Firestore;

export function getApp(): App {
  if (!app) {
    if (getApps().length === 0) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (!projectId || !clientEmail || !privateKey) {
        throw new Error(
          "Missing Firebase credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.",
        );
      }

      // Handle escaped newlines from .env files (dotenv stores \\n literally)
      privateKey = privateKey.replace(/\\n/g, "\n");
      // Strip surrounding quotes that some env-var managers embed in the value
      privateKey = privateKey.replace(/^["']|["']$/g, "");

      app = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
    } else {
      app = getApps()[0]!;
    }
  }
  return app;
}

export function getDb(): Firestore {
  if (!db) {
    // Use initializeFirestore (not getFirestore + settings) so preferRest
    // is wired in before the gRPC channel can be created.
    // gRPC breaks in serverless (Vercel/Node 18+/OpenSSL 3) with:
    //   "DECODER routines::unsupported"
    db = initializeFirestore(getApp(), { preferRest: true });
  }
  return db;
}
