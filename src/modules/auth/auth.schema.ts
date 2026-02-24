import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  password: z.string().min(6).max(100),
  timezone: z.string().default('Asia/Jakarta'),
  preferences: z.preprocess((val) => {
    try { return typeof val === 'string' ? JSON.parse(val) : val; } catch { return val; }
  }, z.array(z.enum(['CONCERT', 'WORKSHOP', 'FESTIVAL'])).default([])),
  avatarUrl: z.string().url().optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  timezone: z.string().optional(),
  preferences: z.preprocess((val) => {
    try { return typeof val === 'string' ? JSON.parse(val) : val; } catch { return val; }
  }, z.array(z.enum(['CONCERT', 'WORKSHOP', 'FESTIVAL'])).optional()),
  avatarUrl: z.string().url().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
