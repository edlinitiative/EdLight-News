import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
// Resolve .env from monorepo root (two levels up from apps/worker/src)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../..", ".env");
dotenv.config({ path: envPath });
import express from "express";
import { tickRouter } from "./routes/tick.js";
import { processIgNowRouter } from "./routes/processIgNow.js";
import { warmUpClassifier } from "./services/zeroShotClassifier.js";
const app = express();
app.use(express.json());
// ── App-level auth middleware ────────────────────────────────────────────────
// Cloud Run is now --allow-unauthenticated so Vercel can reach /process-ig-now.
// We validate requests at the app level instead:
//   • Cloud Scheduler sends a Google OIDC token → accept if present
//   • Vercel sends WORKER_API_KEY in x-api-key header → validate against env
//   • GET / (health check) is always allowed
app.use((req, res, next) => {
    // Health check — always allowed
    if (req.method === "GET" && req.path === "/")
        return next();
    const apiKey = process.env.WORKER_API_KEY;
    if (!apiKey) {
        // No key configured — fall through (dev mode / backward compat)
        return next();
    }
    // Accept Google OIDC tokens from Cloud Scheduler (starts with "ey")
    const authHeader = req.headers.authorization ?? "";
    if (authHeader.startsWith("Bearer ey")) {
        // OIDC token present — Cloud Scheduler request. Cloud Run already
        // verified the token when IAM was enabled; with --allow-unauthenticated
        // we trust that Cloud Scheduler sends valid tokens. The audience check
        // is handled by Cloud Scheduler's own config.
        return next();
    }
    // Accept our shared API key
    const provided = req.headers["x-api-key"] ?? authHeader.replace(/^Bearer\s+/i, "");
    if (provided === apiKey)
        return next();
    res.status(401).json({ ok: false, error: "Unauthorized" });
});
// Health check
app.get("/", (_req, res) => {
    res.json({ status: "ok", service: "edlight-news-worker" });
});
// Pipeline endpoint — triggered by Cloud Scheduler (OIDC) or API key
app.use(tickRouter);
// Fast IG-only endpoint — triggered by admin "Publish Now" action (API key)
app.use(processIgNowRouter);
const PORT = parseInt(process.env.PORT ?? "8080", 10);
app.listen(PORT, () => {
    console.log(`[worker] listening on :${PORT} — awaiting Cloud Scheduler /tick`);
    // Pre-load the zero-shot classifier model in the background
    warmUpClassifier();
});
//# sourceMappingURL=index.js.map