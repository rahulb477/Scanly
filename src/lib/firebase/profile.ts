"use client";

import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirebaseClient } from "./client";
import { firebaseErrorCode } from "./errors";

/**
 * Keeps users/{uid} in sync with the signed-in Firebase Auth user.
 *
 * This is the only direct Firestore write the browser performs, so it is the only
 * place that can surface a raw `permission-denied` during login. POST
 * /api/auth/session performs the same create/repair with the Admin SDK after a
 * verified ID token, so this call is an optimisation, not the source of truth:
 * a rules rejection must never block a legitimate sign-in.
 *
 * @returns true when the client write succeeded, false when rules rejected it.
 */
export async function ensureUserProfile(user: User): Promise<boolean> {
  const { db } = getFirebaseClient();
  const ref = doc(db, "users", user.uid);
  try {
    await runTransaction(db, async (transaction) => {
      const profile = await transaction.get(ref);
      const identity = { uid: user.uid, name: user.displayName || "", email: user.email || "", photoURL: user.photoURL || null, updatedAt: serverTimestamp() };
      if (profile.exists()) {
        // Do not let a sign-in overwrite the user's own edited profile or role.
        transaction.update(ref, { uid: user.uid, email: identity.email, updatedAt: serverTimestamp() });
      } else {
        transaction.set(ref, { ...identity, role: "user", createdAt: serverTimestamp() });
      }
    });
    return true;
  } catch (error) {
    if (firebaseErrorCode(error) !== "permission-denied") throw error;
    // The deployed firestore.rules are stale or stricter than this client write.
    // The token-verified server route repairs the profile, so sign-in continues.
    console.warn("[Scanly Firebase] users/%s was not writable from the browser; the server session route will create or repair the profile. Deploy firestore.rules with: firebase deploy --only firestore:rules", user.uid);
    return false;
  }
}
