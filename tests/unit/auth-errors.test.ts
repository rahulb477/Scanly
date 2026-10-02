import { describe, expect, it } from "vitest";
import { authErrorMessage, ClientError } from "@/lib/firebase/errors";
import { firebaseClientConfig, missingFirebaseConfig, FIREBASE_CONFIG_KEYS } from "@/lib/firebase/config";
import { signupSchema, validatedEmail } from "@/lib/firebase/validation";

describe("Firebase configuration and authentication errors", () => {
  it("reports all six required Web configuration names", () => {
    expect(missingFirebaseConfig({})).toEqual([...FIREBASE_CONFIG_KEYS]);
    expect(missingFirebaseConfig({ apiKey: " ", projectId: "demo-scanly" })).toHaveLength(5);
  });
  it("configuration contains only Web identifiers, never Admin credentials", () => {
    expect(Object.keys(firebaseClientConfig()).sort()).toEqual(["apiKey", "appId", "authDomain", "messagingSenderId", "projectId", "storageBucket"]);
  });
  it.each([
    ["auth/invalid-credential", "Invalid email or password"],
    ["auth/wrong-password", "Invalid email or password"],
    ["auth/user-not-found", "No account"],
    ["auth/email-already-in-use", "already exists"],
    ["auth/weak-password", "too weak"],
    ["auth/invalid-email", "valid email"],
    ["auth/network-request-failed", "Unable to connect to Firebase"],
    ["auth/too-many-requests", "Too many attempts"],
    ["auth/operation-not-allowed", "not enabled"],
    ["auth/unauthorized-domain", "Authorized Domains"],
    ["auth/invalid-api-key", "configuration is invalid"],
    ["firebase/configuration-missing", "configuration missing"],
    ["permission-denied", "security rules"],
    ["unavailable", "Firestore is unavailable"],
    ["storage/unauthorized", "not authorized to upload"],
    ["auth/popup-closed-by-user", "cancelled"],
  ])("maps %s to an actionable message", (code, fragment) => { expect(authErrorMessage({ code })).toContain(fragment); });
  it("never leaks unknown SDK error details or credentials", () => {
    expect(authErrorMessage(new Error("sensitive-internal-detail"))).not.toContain("sensitive-internal-detail");
    expect(authErrorMessage(new ClientError("Passwords do not match."))).toBe("Passwords do not match.");
  });
  it("validates names, email, minimum password and confirmation centrally", () => {
    const input = { name: " Owner ", email: " Owner@Example.test ", password: "Secure123!", confirmPassword: "Secure123!" };
    expect(signupSchema.parse(input).name).toBe("Owner");
    expect(validatedEmail(input.email)).toBe("owner@example.test");
    expect(signupSchema.safeParse({ ...input, name: " " }).success).toBe(false);
    expect(signupSchema.safeParse({ ...input, email: "invalid" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...input, password: "short" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...input, confirmPassword: "different" }).success).toBe(false);
    expect(() => validatedEmail("invalid")).toThrow("Enter a valid email");
  });
});
