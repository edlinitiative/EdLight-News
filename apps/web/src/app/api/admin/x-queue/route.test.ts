import { beforeEach, describe, expect, it, vi } from "vitest";

const setScheduled = vi.fn();
const updateStatus = vi.fn();

vi.mock("@edlight-news/firebase", () => ({
  xQueueRepo: {
    setScheduled,
    updateStatus,
  },
  getDb: vi.fn(),
}));

describe("/api/admin/x-queue PATCH", () => {
  beforeEach(() => {
    setScheduled.mockReset();
    updateStatus.mockReset();
  });

  it("rejects invalid actions", async () => {
    const { PATCH } = await import("./route");

    const req = new Request("http://localhost/api/admin/x-queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "x-123", action: "invalid" }),
    });

    const res = await PATCH(req as never);
    const data = (await res.json()) as { error: string };

    expect(res.status).toBe(400);
    expect(data.error).toContain("Invalid action 'invalid'");
    expect(setScheduled).not.toHaveBeenCalled();
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("skips queued items", async () => {
    const { PATCH } = await import("./route");

    const req = new Request("http://localhost/api/admin/x-queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "x-456", action: "skip" }),
    });

    const res = await PATCH(req as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true, action: "skip" });
    expect(updateStatus).toHaveBeenCalledWith("x-456", "skipped", {
      reasons: ["Manually skipped via admin"],
    });
  });

  it("publishes now by setting scheduled date", async () => {
    const { PATCH } = await import("./route");

    const req = new Request("http://localhost/api/admin/x-queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "x-789", action: "publish_now" }),
    });

    const res = await PATCH(req as never);
    const data = (await res.json()) as { ok: boolean; action: string; scheduledFor: string };

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.action).toBe("publish_now");
    expect(setScheduled).toHaveBeenCalledWith("x-789", expect.any(String));
  });
});
