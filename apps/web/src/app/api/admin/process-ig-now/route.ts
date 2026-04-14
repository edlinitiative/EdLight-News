import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
// IG processing (render + upload + publish) can take up to 2 minutes
export const maxDuration = 150;

/**
 * POST /api/admin/process-ig-now
 *
 * Proxies to the worker's fast /process-ig-now endpoint which ONLY runs
 * processIgScheduled() — no ingest/process/generate overhead.
 * Completes in seconds-to-minutes instead of the 5-10 min full /tick pipeline.
 */
export async function POST() {
  const workerUrl = process.env.WORKER_URL;

  if (!workerUrl) {
    return NextResponse.json(
      { ok: false, error: "WORKER_URL is not configured." },
      { status: 503 },
    );
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const apiKey = process.env.WORKER_API_KEY;
    if (apiKey) headers["x-api-key"] = apiKey;

    const response = await fetch(`${workerUrl}/process-ig-now`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(140_000), // just under maxDuration
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const timedOut = message.includes("TimeoutError") || message.includes("timed out");

    return NextResponse.json(
      {
        ok: timedOut,
        timedOut,
        error: timedOut
          ? "IG processing is running but took longer than expected. Check worker logs."
          : message,
      },
      { status: timedOut ? 202 : 502 },
    );
  }
}
