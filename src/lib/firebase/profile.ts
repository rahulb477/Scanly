"use client";

import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirebaseClient } from "./client";

export async function ensureUserProfile(user: User) {
  const { db } = getFirebaseClient();
  const ref = doc(db, "users", user.uid);
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
}
