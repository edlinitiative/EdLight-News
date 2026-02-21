import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
// Allow up to 90 seconds for the pipeline to respond
export const maxDuration = 90;

export async function POST() {
  const workerUrl = process.env.WORKER_URL;

  if (!workerUrl) {
    return NextResponse.json(
      { ok: false, error: "WORKER_URL is not configured. Add it to your environment variables." },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${workerUrl}/tick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(85_000), // 85s — just under maxDuration
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const timedOut = message.includes("TimeoutError") || message.includes("timed out");

    return NextResponse.json(
      {
        ok: timedOut, // timeout means it's running, not failed
        timedOut,
        error: timedOut
          ? "Pipeline is running but took longer than 85s to respond. Check the worker logs."
          : message,
      },
      { status: timedOut ? 202 : 502 },
    );
  }
}
