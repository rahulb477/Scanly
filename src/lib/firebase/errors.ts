const messages: Record<string, string> = {
  "auth/invalid-credential": "Invalid email or password.",
  "auth/invalid-login-credentials": "Invalid email or password.",
  "auth/wrong-password": "Invalid email or password.",
  "auth/user-not-found": "No account was found with this email.",
  "auth/user-disabled": "This account has been disabled. Contact support.",
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
  "auth/weak-password": "Password is too weak. Use at least 8 characters and meet the displayed password requirements.",
  "auth/password-does-not-meet-requirements": "Password does not meet this project's requirements. Use the required length, uppercase, lowercase, number and symbol characters.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/missing-password": "Enter your password.",
  "auth/network-request-failed": "Unable to connect to Firebase. Check your internet connection and try again.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
  "auth/operation-not-allowed": "This sign-in method is not enabled. Ask the administrator to enable it in Firebase Authentication.",
  "auth/invalid-api-key": "Firebase configuration is invalid. Ask the administrator to check the Web App API key and redeploy.",
  "auth/app-not-authorized": "This app is not authorized to use Firebase. Check the Web API key's application restrictions.",
  "auth/unauthorized-domain": "This domain is not authorized for Firebase sign-in. Add it to Firebase Authentication Authorized Domains.",
  "auth/configuration-not-found": "Firebase Authentication is not configured. Enable Email/Password in the Firebase Console.",
  "auth/popup-blocked": "Your browser blocked the Google sign-in window. Allow popups and try again.",
  "auth/popup-closed-by-user": "Google sign-in was cancelled.",
  "auth/cancelled-popup-request": "Another sign-in window is already open.",
  "auth/account-exists-with-different-credential": "An account already uses this email with another sign-in method. Sign in using that method first.",
  "auth/requires-recent-login": "Please sign in again before performing this action.",
  "auth/user-token-expired": "Your session expired. Please sign in again.",
  "auth/invalid-user-token": "Your session is no longer valid. Please sign in again.",
  "auth/id-token-revoked": "Your session was signed out. Please sign in again.",
  "firebase/configuration-missing": "Firebase configuration missing. Ask the administrator to configure Firebase and redeploy.",
  "permission-denied": "Access denied. Check your business membership or ask the administrator to deploy the Firestore security rules.",
  "firestore/permission-denied": "Access denied. Ask the administrator to deploy the Firestore security rules.",
  "unavailable": "Firestore is unavailable. Check your internet connection and try again.",
  "firestore/unavailable": "Firestore is unavailable. Check your internet connection and try again.",
  "storage/unauthorized": "You are not authorized to upload to this business. Check membership and Storage rules.",
  "storage/invalid-format": "Choose a JPEG, PNG or WebP image.",
  "storage/quota-exceeded": "Storage quota has been reached. Contact the administrator.",
  "storage/retry-limit-exceeded": "The upload could not finish. Check your connection and try again.",
  "storage/canceled": "Upload cancelled.",
  "storage/unknown": "Storage upload failed. Check the bucket configuration, connection and deployed rules.",
};

export class ClientError extends Error {
  constructor(message: string, public readonly code = "client/error", public readonly status?: number) {
    super(message);
    this.name = "ClientError";
  }
}

export function firebaseErrorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined;
}

export function authErrorMessage(error: unknown): string {
  if (error instanceof ClientError) return error.message;
  const code = firebaseErrorCode(error);
  if (code && messages[code]) return messages[code];
  if (error instanceof TypeError) return "Unable to reach the server. Check your connection and try again.";
  return "The request could not be completed. Please try again or contact the administrator.";
}
