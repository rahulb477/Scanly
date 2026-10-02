import { z } from "zod";
import { ClientError } from "./errors";

export const emailSchema = z.string().trim().email("Enter a valid email address.").max(255);
export const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(200),
  email: emailSchema,
  password: z.string().min(8, "Use a password with at least 8 characters.").max(128, "Use a password with no more than 128 characters."),
  confirmPassword: z.string(),
}).refine((input) => input.password === input.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });

export function validatedEmail(email: string) {
  const result = emailSchema.safeParse(email);
  if (!result.success) throw new ClientError(result.error.issues[0].message, "client/invalid-email");
  return result.data.toLowerCase();
}
