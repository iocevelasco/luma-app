import { z } from 'zod';

/**
 * Schemas zod compartidos. La API los usa para validar el body (el errorHandler
 * traduce un ZodError a 400 con `details`), y el frontend los usa como resolver
 * de React Hook Form. Una sola definición, dos usos.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'El email es obligatorio')
  .email('Email inválido');

export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña es demasiado larga');

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres')
  .max(80, 'El nombre es demasiado largo');

export const userRoleSchema = z.enum(['admin', 'user']);

export const loginCredentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'La contraseña es obligatoria'),
  recaptchaToken: z.string().optional(),
});

export const registerCredentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  recaptchaToken: z.string().optional(),
});

export const forgotPasswordRequestSchema = z.object({
  email: emailSchema,
  recaptchaToken: z.string().optional(),
});

export const resetPasswordRequestSchema = z.object({
  token: z.string().min(1, 'Token inválido'),
  password: passwordSchema,
});

export const setPasswordRequestSchema = resetPasswordRequestSchema;

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, 'La contraseña actual es obligatoria'),
  newPassword: passwordSchema,
});

export const changeEmailRequestSchema = z.object({
  newEmail: emailSchema,
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

export type LoginCredentialsInput = z.infer<typeof loginCredentialsSchema>;
export type RegisterCredentialsInput = z.infer<typeof registerCredentialsSchema>;
export type ForgotPasswordRequestInput = z.infer<typeof forgotPasswordRequestSchema>;
export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>;
export type ChangePasswordRequestInput = z.infer<typeof changePasswordRequestSchema>;
export type ChangeEmailRequestInput = z.infer<typeof changeEmailRequestSchema>;

export * from './project.js';
export * from './activity.js';
export * from './material.js';
