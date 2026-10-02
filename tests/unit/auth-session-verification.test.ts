import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TOKEN = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVpZCJ9.fake-signature-not-a-real-token";

/**
 * Locks in the production login contract between the browser and
 * /api/auth/session:
 *  - the request carries `Authorization: Bearer <Firebase ID token>`,
 *  - the token is force-refreshed, never read from a stale cache,
 *  - a rejected service-account credential is classified as a server
 *    configuration failure and never reported as a bad user token,
 *  - no log line ever contains the ID token, the private key or a cookie.
 */

describe("Authorization header handling", () => {
  afterEach(() => { vi.resetModules(); });

  it("describes the header without copying the token", async () => {
    const { describeAuthorization } = await import("@/lib/auth");
    const described = describeAuthorization(`Bearer ${TOKEN}`);
    expect(described).toEqual({ present: true, scheme: "bearer", tokenLength: TOKEN.length });
    expect(JSON.stringify(described)).not.toContain(TOKEN);
    expect(JSON.stringify(described)).not.toContain("fake-signature");
  });

  it("never echoes an unexpected scheme, because that value may be a raw token", async () => {
    const { describeAuthorization } = await import("@/lib/auth");
    const described = describeAuthorization(`Firebase ${TOKEN}`);
    expect(described.scheme).toBe("other");
    expect(JSON.stringify(described)).not.toContain(TOKEN);
    expect(describeAuthorization(null)).toEqual({ present: false, scheme: "missing", tokenLength: 0 });
  });

  it("classifies Admin credential rejection separately from an invalid ID token", async () => {
    const { isAdminCredentialError } = await import("@/lib/auth");
    // The exact error firebase-admin raises for a revoked/deleted service-account
    // key (`invalid_grant`) and for an unauthenticated backend call (gRPC 16).
    for (const error of [{ code: "app/invalid-credential" }, { code: "auth/insufficient-permission" }, { code: 16 }]) expect(isAdminCredentialError(error)).toBe(true);
    for (const error of [{ code: "auth/id-token-expired" }, { code: "auth/argument-error" }, new Error("boom"), null, undefined]) expect(isAdminCredentialError(error)).toBe(false);
  });
});

describe("browser session request", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "test-key";
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "scanly.example.test";
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "restaurant-flow-59183";
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "restaurant-flow-59183.appspot.com";
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "1";
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:1:web:1";
  });

  it("sends a force-refreshed Bearer ID token and logs only the request shape", async () => {
    const getIdToken = vi.fn(async () => TOKEN);
    const currentUser = { uid: "test-uid", getIdToken };
    vi.doMock("@/lib/firebase/client", () => ({
      getFirebaseClient: () => ({ auth: { authStateReady: async () => undefined, currentUser } }),
    }));

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const { createServerSession } = await import("@/lib/firebase/session");
    await createServerSession();

    // #10 — a freshly refreshed token, never a cached one.
    expect(getIdToken).toHaveBeenCalledWith(true);
    // #9 — `Authorization: Bearer <ID token>`, not `Firebase <token>` and not `Bearer undefined`.
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${TOKEN}`);
    expect(init.method).toBe("POST");

    // #1 — the log holds the shape only. No token, ever.
    const logged = consoleInfo.mock.calls.map((call) => JSON.stringify(call)).join("\n");
    expect(logged).toContain('"authorizationHeaderPresent":true');
    expect(logged).toContain(`"idTokenLength":${TOKEN.length}`);
    expect(logged).toContain('"responseStatus":200');
    expect(logged).not.toContain(TOKEN);

    vi.unstubAllGlobals();
    consoleInfo.mockRestore();
  });
});

describe("/api/auth/session verification stage", () => {
  const origin = "https://scanly.example.test";

  async function loadRoute(verifyIdToken: (token: string, checkRevoked?: boolean) => Promise<unknown>) {
    vi.resetModules();
    const logs: unknown[][] = [];
    vi.doMock("@/lib/server-log", () => ({
      serverLog: (...args: unknown[]) => { logs.push(args); },
      logServerError: (...args: unknown[]) => { logs.push(args); },
      errorDetails: (error: unknown) => ({ message: String(error) }),
      scrub: (value: unknown) => String(value),
    }));
    vi.doMock("@/lib/firebase/admin", () => ({
      getAdminAuth: () => ({ verifyIdToken, getUser: async () => ({}) }),
      getAdminDb: () => ({ collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => ({}) }) }) }), runTransaction: async () => undefined }),
    }));
    const { NextRequest } = await import("next/server");
    const { POST } = await import("@/app/api/auth/session/route");
    return { POST, logs, NextRequest };
  }

  it("reports a revoked service account as a server credential failure, not a bad user token", async () => {
    // The exact production failure: firebase-admin cannot exchange the
    // service-account key for an OAuth2 token, so verifyIdToken(checkRevoked)
    // fails before the ID token is ever judged.
    const invalidGrant = Object.assign(new Error("invalid_grant: Invalid JWT Signature"), { code: "app/invalid-credential" });
    const { POST, logs, NextRequest } = await loadRoute(async () => { throw invalidGrant; });

    const response = await POST(new NextRequest(`${origin}/api/auth/session`, {
      method: "POST",
      headers: { origin, "sec-fetch-site": "same-origin", authorization: `Bearer ${TOKEN}` },
    }));

    expect(response.status).toBe(503);
    const payload = await response.text();
    expect(JSON.parse(payload).code).toBe("firebase/admin-credential-invalid");
    expect(payload).not.toContain(TOKEN);

    const serialized = JSON.stringify(logs);
    // #2/#3 — the diagnostic log names both projects, the real error code and the status.
    expect(serialized).toContain("restaurant-flow-59183");
    expect(serialized).toContain("app/invalid-credential");
    expect(serialized).toContain("firebase-admin-credential-rejected");
    expect(serialized).toContain('"httpStatus":503');
    // Never a secret.
    expect(serialized).not.toContain(TOKEN);
  });

  it("keeps an expired ID token a user-facing 401", async () => {
    const expired = Object.assign(new Error("Firebase ID token has expired"), { code: "auth/id-token-expired" });
    const { POST, NextRequest } = await loadRoute(async () => { throw expired; });

    const response = await POST(new NextRequest(`${origin}/api/auth/session`, {
      method: "POST",
      headers: { origin, "sec-fetch-site": "same-origin", authorization: `Bearer ${TOKEN}` },
    }));

    expect(response.status).toBe(401);
    const payload = await response.text();
    expect(JSON.parse(payload).code).toBe("auth/user-token-expired");
    expect(payload).not.toContain(TOKEN);
  });

  it("rejects a missing Authorization header before touching Firebase", async () => {
    const { POST, NextRequest } = await loadRoute(async () => { throw new Error("must not be reached"); });
    const response = await POST(new NextRequest(`${origin}/api/auth/session`, { method: "POST", headers: { origin, "sec-fetch-site": "same-origin" } }));
    expect(response.status).toBe(401);
    expect(JSON.parse(await response.text()).code).toBe("auth/user-token-expired");
  });
});
