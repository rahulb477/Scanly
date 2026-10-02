"use client";

import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { getFirebaseClient, getFirebaseStorage } from "./client";
import { ClientError } from "./errors";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export function validateImage(file: Pick<File, "size" | "type">) {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) throw new ClientError("Choose a JPEG, PNG or WebP image. SVG and executable files are not allowed.", "storage/invalid-format");
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) throw new ClientError("Image must be between 1 byte and 5 MB.", "storage/invalid-size");
}

export async function uploadBusinessImage(businessId: string, kind: "logos" | "covers" | "menu", file: File, onProgress?: (percent: number) => void): Promise<string> {
  validateImage(file);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(businessId)) throw new ClientError("Invalid business identifier.");
  const { auth } = getFirebaseClient();
  await auth.authStateReady();
  if (!auth.currentUser) throw new ClientError("Sign in before uploading an image.", "auth/user-token-expired");
  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
  const destination = ref(getFirebaseStorage(), `businesses/${businessId}/${kind}/${crypto.randomUUID()}.${extension}`);
  const task = uploadBytesResumable(destination, file, { contentType: file.type, cacheControl: "public,max-age=3600" });
  return new Promise((resolve, reject) => {
    task.on("state_changed", (snapshot) => onProgress?.(Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100)), reject, async () => {
      try { resolve(await getDownloadURL(task.snapshot.ref)); } catch (error) { reject(error); }
    });
  });
}
