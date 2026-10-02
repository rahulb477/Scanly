import { describe, expect, it } from "vitest";
import { apiErrorResponse, assertSameOrigin, jsonBody } from "@/lib/api";

const url = "https://scanly.example.test/api/track";
describe("bounded real Request parsing and origin validation", () => {
  it("parses UTF-8 JSON without requiring an announced length", async () => {
    const request = new Request(url, { method: "POST", body: JSON.stringify({ name: "Café 日本語" }) });
    expect(await jsonBody(request)).toEqual({ name: "Café 日本語" });
  });
  it("rejects invalid JSON and empty bodies", async () => {
    for (const request of [new Request(url, { method: "POST", body: "<html>error</html>" }), new Request(url)]) await expect(jsonBody(request)).rejects.toMatchObject({ status: 400, code: "request/invalid-json" });
  });
  it("bounds streamed bodies even if Content-Length is omitted", async () => {
    await expect(jsonBody(new Request(url, { method: "POST", body: JSON.stringify({ value: "x".repeat(70_000) }) }))).rejects.toMatchObject({ status: 413 });
    await expect(jsonBody(new Request(url, { method: "POST", body: "{}", headers: { "Content-Length": "70000" } }))).rejects.toMatchObject({ status: 413 });
  });
  it("requires a valid exact origin, including scheme", () => {
    expect(() => assertSameOrigin(new Request(url, { headers: { Origin: "https://scanly.example.test" } }))).not.toThrow();
    for (const origin of ["null", "invalid", "http://scanly.example.test", "https://other.example.test"]) expect(() => assertSameOrigin(new Request(url, { headers: { Origin: origin } }))).toThrow("Cross-origin");
    expect(() => assertSameOrigin(new Request(url))).toThrow("Cross-origin");
  });
  it("supports the actual trusted proxy host and HTTPS scheme", () => {
    expect(() => assertSameOrigin(new Request("http://internal:3000/api/auth/session", { headers: { Origin: "https://actual-preview.example.test", "X-Forwarded-Host": "actual-preview.example.test", "X-Forwarded-Proto": "https", "Sec-Fetch-Site": "same-origin" } }))).not.toThrow();
  });
  it("distinguishes server IAM/configuration from expired user tokens without leaking SDK errors", async () => {
    const response = apiErrorResponse({ code: "auth/insufficient-permission", message: "must not expose credential details" });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("credential details");
  });
});
