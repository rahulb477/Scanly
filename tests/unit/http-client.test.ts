import { afterEach, describe, expect, it, vi } from "vitest";
import { requestJson } from "@/lib/http-client";
afterEach(() => vi.unstubAllGlobals());
describe("HTTP diagnostics (transport-only unit tests)", () => {
  it("distinguishes the exact original HTML/JSON parsing failure from connectivity", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<!DOCTYPE html><html>Import error</html>", { status: 500, headers: { "Content-Type": "text/html" } })));
    await expect(requestJson("/api/example")).rejects.toMatchObject({ code: "client/invalid-response", status: 500 });
  });
  it("preserves useful JSON API errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Server Firebase configuration missing.", code: "firebase/configuration-missing" }, { status: 503 })));
    await expect(requestJson("/api/example")).rejects.toThrow("Server Firebase configuration missing");
  });
  it("handles a genuine disconnected network", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(requestJson("/api/example")).rejects.toMatchObject({ code: "client/network-unavailable" });
  });
  it("returns successful JSON without manufacturing authentication", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ok: true })));
    await expect(requestJson("/api/example")).resolves.toEqual({ ok: true });
  });
});
