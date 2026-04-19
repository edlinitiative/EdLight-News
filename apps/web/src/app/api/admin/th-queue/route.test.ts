import { beforeEach, describe, expect, it, vi } from "vitest";

const setScheduled = vi.fn();
const updateStatus = vi.fn();

vi.mock("@edlight-news/firebase", () => ({
  thQueueRepo: {
    setScheduled,
    updateStatus,
  },
  getDb: vi.fn(),
}));

describe("/api/admin/th-queue PATCH", () => {
  beforeEach(() => {
    setScheduled.mockReset();
    updateStatus.mockReset();
  });

  it("returns 400 when id or action is missing", async () => {
    const { PATCH } = await import("./route");

    const req = new Request("http://localhost/api/admin/th-queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "skip" }),
    });

    const res = await PATCH(req as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toEqual({ error: "Missing id or action" });
  });

  it("schedules immediate publishing when action is publish_now", async () => {
    const { PATCH } = await import("./route");

    const req = new Request("http://localhost/api/admin/th-queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "th-123", action: "publish_now" }),
    });

    const res = await PATCH(req as never);
    const data = (await res.json()) as { ok: boolean; action: string; scheduledFor: string };

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.action).toBe("publish_now");
    expect(typeof data.scheduledFor).toBe("string");
    expect(setScheduled).toHaveBeenCalledTimes(1);
    expect(setScheduled).toHaveBeenCalledWith("th-123", expect.any(String));
  });

  it("requeues failed items", async () => {
    const { PATCH } = await import("./route");

    const req = new Request("http://localhost/api/admin/th-queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "th-456", action: "requeue" }),
    });

    const res = await PATCH(req as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true, action: "requeue" });
    expect(updateStatus).toHaveBeenCalledWith("th-456", "queued", {
      sendRetries: 0,
      error: null,
    });
  });
});
