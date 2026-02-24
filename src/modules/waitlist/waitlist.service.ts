import prisma from '../../lib/prisma';
import { waitlistRepository } from './waitlist.repository';
import { AppError } from '../../middlewares/errorHandler';
import type { JoinWaitlistInput } from './waitlist.schema';

export class WaitlistService {
  async joinWaitlist(userId: string, input: JoinWaitlistInput) {
    return prisma.$transaction(async (tx) => {
      // Check slot exists
      const slot = await tx.timeSlot.findUnique({ where: { id: input.timeSlotId } });
      if (!slot) throw new AppError(404, 'Time slot not found', 'SLOT_NOT_FOUND');

      // Check not already on waitlist
      const existing = await tx.waitlist.findUnique({
        where: { userId_timeSlotId: { userId, timeSlotId: input.timeSlotId } },
      });
      if (existing && existing.status === 'WAITING') {
        throw new AppError(409, 'Already on waitlist for this slot', 'ALREADY_WAITLISTED');
      }

      // Check not already booked
      const existingBooking = await tx.booking.findUnique({
        where: { userId_timeSlotId: { userId, timeSlotId: input.timeSlotId } },
      });
      if (existingBooking && existingBooking.status === 'CONFIRMED') {
        throw new AppError(409, 'Already booked for this slot', 'ALREADY_BOOKED');
      }

      const position = await waitlistRepository.getNextPosition(tx, input.timeSlotId);
      return waitlistRepository.create(tx, {
        userId,
        timeSlotId: input.timeSlotId,
        quantity: input.quantity,
        position,
      });
    });
  }

  async getUserWaitlists(userId: string) {
    return waitlistRepository.findByUser(userId);
  }

  async getSlotWaitlist(timeSlotId: string) {
    return waitlistRepository.findWaitingBySlot(timeSlotId);
  }
}

export const waitlistService = new WaitlistService();
