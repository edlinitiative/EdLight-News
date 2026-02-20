import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
let app;
let db;
export function getApp() {
    if (!app) {
        if (getApps().length === 0) {
            const projectId = process.env.FIREBASE_PROJECT_ID;
            const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
            let privateKey = process.env.FIREBASE_PRIVATE_KEY;
            if (!projectId || !clientEmail || !privateKey) {
                throw new Error("Missing Firebase credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.");
            }
            // Handle escaped newlines from .env files (dotenv stores \\n literally)
            privateKey = privateKey.replace(/\\n/g, "\n");
            app = initializeApp({
                credential: cert({ projectId, clientEmail, privateKey }),
            });
        }
        else {
            app = getApps()[0];
        }
    }
    return app;
}
export function getDb() {
    if (!db) {
        db = getFirestore(getApp());
        // Use REST transport instead of gRPC.
        // gRPC requires persistent TLS channels that break in serverless environments
        // (Vercel, Cloud Functions) under Node 18+ / OpenSSL 3 with error:
        //   "Getting metadata from plugin failed: DECODER routines::unsupported"
        // REST uses plain HTTPS, which is reliable in all serverless runtimes.
        db.settings({ preferRest: true });
    }
    return db;
}
//# sourceMappingURL=admin.js.map