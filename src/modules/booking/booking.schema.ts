import { z } from 'zod';

export const createBookingSchema = z.object({
  timeSlotId: z.string().uuid(),
  quantity: z.number().int().min(1).max(5),
});

export const cancelBookingSchema = z.object({
  id: z.string().uuid(),
});

export const partialCancelSchema = z.object({
  cancelQuantity: z.number().int().min(1).max(5),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
