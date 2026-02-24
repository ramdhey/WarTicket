import { z } from 'zod';

export const joinWaitlistSchema = z.object({
  timeSlotId: z.string().uuid(),
  quantity: z.number().int().min(1).max(5),
});

export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;
