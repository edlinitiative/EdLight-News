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
// Health check
app.get("/", (_req, res) => {
    res.json({ status: "ok", service: "edlight-news-worker" });
});
// Pipeline endpoint — triggered exclusively by Cloud Scheduler
app.use(tickRouter);
// Fast IG-only endpoint — triggered by admin "Publish Now" action
app.use(processIgNowRouter);
const PORT = parseInt(process.env.PORT ?? "8080", 10);
app.listen(PORT, () => {
    console.log(`[worker] listening on :${PORT} — awaiting Cloud Scheduler /tick`);
    // Pre-load the zero-shot classifier model in the background
    warmUpClassifier();
});
//# sourceMappingURL=index.js.map