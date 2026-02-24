import prisma from '../../lib/prisma';
import type { Prisma } from '@prisma/client';

export class BookingRepository {
  async findByUserAndTimeSlot(userId: string, timeSlotId: string) {
    return prisma.booking.findUnique({
      where: { userId_timeSlotId: { userId, timeSlotId } },
    });
  }

  async findByIdWithSlot(id: string) {
    return prisma.booking.findUnique({
      where: { id },
      include: { timeSlot: { include: { event: true } } },
    });
  }

  async findByUser(userId: string, status?: 'CONFIRMED' | 'CANCELLED') {
    return prisma.booking.findMany({
      where: { userId, ...(status && { status }) },
      include: { timeSlot: { include: { event: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get user's confirmed bookings' time slots to check for conflicts.
   */
  async getUserConfirmedTimeSlots(userId: string) {
    return prisma.booking.findMany({
      where: { userId, status: 'CONFIRMED' },
      include: { timeSlot: { select: { id: true, startTime: true, endTime: true } } },
    });
  }

  /**
   * Row-level locking: SELECT FOR UPDATE on time_slot within a transaction.
   */
  async lockTimeSlotForUpdate(tx: Prisma.TransactionClient, timeSlotId: string) {
    const rows = await tx.$queryRaw<Array<{
      id: string; capacity: number; bookedCount: number;
      startTime: Date; endTime: Date; eventId: string; label: string;
    }>>`
      SELECT id, capacity, "bookedCount", "startTime", "endTime", "eventId", label
      FROM time_slots
      WHERE id = ${timeSlotId}
      FOR UPDATE
    `;
    return rows[0] || null;
  }

  async createBookingInTx(
    tx: Prisma.TransactionClient,
    data: { userId: string; timeSlotId: string; quantity: number },
  ) {
    return tx.booking.create({ data: { ...data, status: 'CONFIRMED' } });
  }

  async incrementBookedCount(tx: Prisma.TransactionClient, timeSlotId: string, quantity: number) {
    return tx.timeSlot.update({
      where: { id: timeSlotId },
      data: { bookedCount: { increment: quantity } },
    });
  }

  async decrementBookedCount(tx: Prisma.TransactionClient, timeSlotId: string, quantity: number) {
    return tx.timeSlot.update({
      where: { id: timeSlotId },
      data: { bookedCount: { decrement: quantity } },
    });
  }

  async cancelBooking(tx: Prisma.TransactionClient, id: string) {
    return tx.booking.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }
}

export const bookingRepository = new BookingRepository();
