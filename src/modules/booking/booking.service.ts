import prisma from '../../lib/prisma';
import { bookingRepository } from './booking.repository';
import { promotionQueue } from '../../lib/queue';
import { AppError } from '../../middlewares/errorHandler';
import type { CreateBookingInput } from './booking.schema';

const UNDO_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export class BookingService {
  async processBooking(userId: string, input: CreateBookingInput) {
    return prisma.$transaction(async (tx: any) => {
      const slot = await bookingRepository.lockTimeSlotForUpdate(tx, input.timeSlotId);
      if (!slot) throw new AppError(404, 'Time slot not found', 'SLOT_NOT_FOUND');

      const existing = await tx.booking.findUnique({
        where: { userId_timeSlotId: { userId, timeSlotId: input.timeSlotId } },
      });
      if (existing && existing.status === 'CONFIRMED') {
        throw new AppError(409, 'You already have a booking for this slot', 'ALREADY_BOOKED');
      }

      // Conflict detection
      const userBookings = await tx.booking.findMany({
        where: { userId, status: 'CONFIRMED' },
        include: { timeSlot: { select: { startTime: true, endTime: true, id: true } } },
      });

      const hasConflict = userBookings.some((b: any) => {
        if (b.timeSlot.id === input.timeSlotId) return false;
        return b.timeSlot.startTime < slot.endTime && b.timeSlot.endTime > slot.startTime;
      });

      if (hasConflict) {
        throw new AppError(409, 'You have a conflicting booking at the same time. Please cancel the existing booking first.', 'TIME_CONFLICT');
      }

      const available = slot.capacity - slot.bookedCount;
      if (available < input.quantity) {
        const maxPos = await tx.waitlist.aggregate({
          where: { timeSlotId: input.timeSlotId, status: 'WAITING' },
          _max: { position: true },
        });
        const position = (maxPos._max.position ?? 0) + 1;

        const waitlistEntry = await tx.waitlist.create({
          data: { userId, timeSlotId: input.timeSlotId, quantity: input.quantity, position, status: 'WAITING' },
        });

        return { status: 'WAITLISTED' as const, waitlist: waitlistEntry, message: `Slot full. Added to waitlist at position ${position}` };
      }

      let booking;
      if (existing && existing.status === 'CANCELLED') {
        booking = await tx.booking.update({
          where: { id: existing.id },
          data: { status: 'CONFIRMED', quantity: input.quantity, cancelledAt: null },
        });
      } else {
        booking = await bookingRepository.createBookingInTx(tx, { userId, timeSlotId: input.timeSlotId, quantity: input.quantity });
      }

      await bookingRepository.incrementBookedCount(tx, input.timeSlotId, input.quantity);
      return { status: 'CONFIRMED' as const, booking, message: 'Booking confirmed successfully' };
    }, { isolationLevel: 'Serializable' });
  }

  async cancelBooking(userId: string, bookingId: string) {
    const result = await prisma.$transaction(async (tx: any) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { timeSlot: true } });
      if (!booking) throw new AppError(404, 'Booking not found', 'BOOKING_NOT_FOUND');
      if (booking.userId !== userId) throw new AppError(403, 'Not your booking', 'FORBIDDEN');
      if (booking.status === 'CANCELLED') throw new AppError(400, 'Booking already cancelled', 'ALREADY_CANCELLED');

      await tx.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
      await bookingRepository.decrementBookedCount(tx, booking.timeSlotId, booking.quantity);
      return { timeSlotId: booking.timeSlotId, freedQuantity: booking.quantity, bookingId };
    });

    await promotionQueue.add('promote', { timeSlotId: result.timeSlotId, freedQuantity: result.freedQuantity });
    return { message: 'Booking cancelled. Waitlist promotion triggered.', bookingId: result.bookingId };
  }

  async partialCancel(userId: string, bookingId: string, cancelQuantity: number) {
    const result = await prisma.$transaction(async (tx: any) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { timeSlot: true } });
      if (!booking) throw new AppError(404, 'Booking not found', 'BOOKING_NOT_FOUND');
      if (booking.userId !== userId) throw new AppError(403, 'Not your booking', 'FORBIDDEN');
      if (booking.status === 'CANCELLED') throw new AppError(400, 'Booking already cancelled', 'ALREADY_CANCELLED');
      if (cancelQuantity >= booking.quantity) {
        throw new AppError(400, 'Use full cancellation to cancel all spots, or reduce the number', 'INVALID_CANCEL_QUANTITY');
      }

      const newQuantity = booking.quantity - cancelQuantity;
      await tx.booking.update({ where: { id: bookingId }, data: { quantity: newQuantity } });
      await bookingRepository.decrementBookedCount(tx, booking.timeSlotId, cancelQuantity);
      return { timeSlotId: booking.timeSlotId, freedQuantity: cancelQuantity, newQuantity };
    });

    await promotionQueue.add('promote', { timeSlotId: result.timeSlotId, freedQuantity: result.freedQuantity });
    return { message: `Reduced booking by ${cancelQuantity} spot(s). New quantity: ${result.newQuantity}`, newQuantity: result.newQuantity };
  }

  async undoCancellation(userId: string, bookingId: string) {
    return prisma.$transaction(async (tx: any) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { timeSlot: true } });
      if (!booking) throw new AppError(404, 'Booking not found', 'BOOKING_NOT_FOUND');
      if (booking.userId !== userId) throw new AppError(403, 'Not your booking', 'FORBIDDEN');
      if (booking.status !== 'CANCELLED') throw new AppError(400, 'Booking is not cancelled', 'NOT_CANCELLED');

      if (!booking.cancelledAt) throw new AppError(400, 'Undo window expired', 'UNDO_EXPIRED');
      const elapsed = Date.now() - new Date(booking.cancelledAt).getTime();
      if (elapsed > UNDO_WINDOW_MS) {
        throw new AppError(400, 'Undo window expired (5 minutes). Please make a new booking.', 'UNDO_EXPIRED');
      }

      const slot = await bookingRepository.lockTimeSlotForUpdate(tx, booking.timeSlotId);
      if (!slot) throw new AppError(404, 'Time slot not found', 'SLOT_NOT_FOUND');
      if (slot.capacity - slot.bookedCount < booking.quantity) {
        throw new AppError(409, 'Spots are no longer available (may have been filled by waitlist promotion).', 'SPOTS_TAKEN');
      }

      await tx.booking.update({ where: { id: bookingId }, data: { status: 'CONFIRMED', cancelledAt: null } });
      await bookingRepository.incrementBookedCount(tx, booking.timeSlotId, booking.quantity);
      return { message: 'Booking restored successfully', booking };
    }, { isolationLevel: 'Serializable' });
  }

  async getUserBookings(userId: string) {
    const bookings = await bookingRepository.findByUser(userId);
    const now = new Date();

    const addTickets = (b: any) => ({
      ...b,
      tickets: Array.from({ length: b.quantity }, (_, i) => ({
        ticketId: `${b.id}:${i + 1}`,
        ticketNumber: i + 1,
      })),
    });

    return {
      upcoming: bookings.filter((b: any) => b.status === 'CONFIRMED' && new Date(b.timeSlot.endTime) > now).map(addTickets),
      past: bookings.filter((b: any) => b.status === 'CONFIRMED' && new Date(b.timeSlot.endTime) <= now).map(addTickets),
      cancelled: bookings.filter((b: any) => b.status === 'CANCELLED').map(addTickets),
    };
  }

  async getBookingById(userId: string, bookingId: string) {
    const booking = await bookingRepository.findByIdWithSlot(bookingId);
    if (!booking) throw new AppError(404, 'Booking not found', 'BOOKING_NOT_FOUND');
    if (booking.userId !== userId) throw new AppError(403, 'Not your booking', 'FORBIDDEN');

    return {
      ...booking,
      tickets: Array.from({ length: booking.quantity }, (_, i) => ({
        ticketId: `${booking.id}:${i + 1}`,
        ticketNumber: i + 1,
      })),
    };
  }
}

export const bookingService = new BookingService();
