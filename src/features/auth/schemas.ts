import { z } from "zod";

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, "Enter your email or username")
    .max(255),
  password: z.string().min(1, "Enter your password").max(128),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(128),
    newPassword: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .max(128)
      .regex(/[a-z]/, "Use at least one lowercase letter")
      .regex(/[A-Z]/, "Use at least one uppercase letter")
      .regex(/[0-9]/, "Use at least one number")
      .regex(/[^A-Za-z0-9]/, "Use at least one special character"),
    confirmPassword: z.string().min(1, "Confirm your new password").max(128),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
