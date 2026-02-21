import { initializeApp, cert, getApps } from "firebase-admin/app";
import { initializeFirestore } from "firebase-admin/firestore";
let app;
let db;
export function getApp() {
    if (!app) {
        if (getApps().length === 0) {
            const projectId = process.env.FIREBASE_PROJECT_ID;
            const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
            let privateKey = process.env.FIREBASE_PRIVATE_KEY;
            if (privateKey && clientEmail && projectId) {
                // Explicit service-account credentials (local dev / GitHub Actions)
                // Handle escaped newlines from .env files (dotenv stores \\n literally)
                privateKey = privateKey.replace(/\\n/g, "\n");
                // Strip surrounding quotes that some env-var managers embed in the value
                privateKey = privateKey.replace(/^["']|["']$/g, "");
                app = initializeApp({
                    credential: cert({ projectId, clientEmail, privateKey }),
                });
            }
            else {
                // Application Default Credentials — used on Cloud Run where the
                // service account is attached to the instance directly (no key needed)
                app = initializeApp({ projectId: projectId ?? undefined });
            }
        }
        else {
            app = getApps()[0];
        }
    }
    return app;
}
export function getDb() {
    if (!db) {
        // Use initializeFirestore (not getFirestore + settings) so preferRest
        // is wired in before the gRPC channel can be created.
        // gRPC breaks in serverless (Vercel/Node 18+/OpenSSL 3) with:
        //   "DECODER routines::unsupported"
        db = initializeFirestore(getApp(), { preferRest: true });
    }
    return db;
}
//# sourceMappingURL=admin.js.map