import { z } from 'zod';

const timeSlotInput = z.object({
  label: z.string().min(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  capacity: z.number().int().min(1),
});

export const createEventSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  location: z.string().min(3),
  imageUrl: z.string().url().optional(),
  bannerUrl: z.string().url().optional(),
  category: z.enum(['CONCERT', 'WORKSHOP', 'FESTIVAL']),
  timeSlots: z.preprocess((val) => {
    try { return typeof val === 'string' ? JSON.parse(val) : val; } catch { return val; }
  }, z.array(timeSlotInput).min(1)),
});

export const updateEventSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(10).optional(),
  location: z.string().min(3).optional(),
  imageUrl: z.string().url().optional().nullable(),
  bannerUrl: z.string().url().optional().nullable(),
  category: z.enum(['CONCERT', 'WORKSHOP', 'FESTIVAL']).optional(),
});

export const eventQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  category: z.enum(['CONCERT', 'WORKSHOP', 'FESTIVAL']).optional(),
  search: z.string().optional(),
  upcoming: z.coerce.boolean().optional(),
  sort: z.enum(['date', 'smart']).optional().default('date'),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type EventQuery = z.infer<typeof eventQuerySchema>;
