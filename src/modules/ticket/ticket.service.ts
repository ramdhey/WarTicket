import prisma from '../../lib/prisma';
import { AppError } from '../../middlewares/errorHandler';

export class TicketService {
  /**
   * Verify a ticket (booking ID) — check if it exists and is valid.
   * Returns ticket details for barcode scan display.
   */
  async verifyTicket(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        timeSlot: {
          include: { event: { select: { id: true, title: true, location: true, category: true } } },
        },
      },
    });

    if (!booking) {
      throw new AppError(404, 'Ticket not found. Invalid ticket ID.', 'TICKET_NOT_FOUND');
    }

    const isValid = booking.status === 'CONFIRMED';
    const isCheckedIn = !!booking.checkedInAt;
    const isExpired = new Date(booking.timeSlot.endTime) < new Date();

    return {
      ticketId: booking.id,
      status: booking.status,
      isValid,
      isCheckedIn,
      isExpired,
      checkedInAt: booking.checkedInAt,
      quantity: booking.quantity,
      holder: booking.user,
      event: booking.timeSlot.event,
      slot: {
        id: booking.timeSlot.id,
        label: booking.timeSlot.label,
        startTime: booking.timeSlot.startTime,
        endTime: booking.timeSlot.endTime,
      },
    };
  }

  /**
   * Check-in a ticket — mark as used. Cannot be used again after check-in.
   */
  async checkInTicket(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        timeSlot: {
          include: { event: { select: { id: true, title: true, location: true } } },
        },
      },
    });

    if (!booking) {
      throw new AppError(404, 'Ticket not found. Invalid ticket ID.', 'TICKET_NOT_FOUND');
    }

    if (booking.status !== 'CONFIRMED') {
      throw new AppError(400, `Ticket is ${booking.status}. Only confirmed tickets can be checked in.`, 'TICKET_NOT_CONFIRMED');
    }

    if (booking.checkedInAt) {
      throw new AppError(409, `Ticket already checked in at ${booking.checkedInAt.toISOString()}. Cannot use again.`, 'ALREADY_CHECKED_IN');
    }

    // Mark as checked in
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { checkedInAt: new Date() },
      include: {
        user: { select: { id: true, name: true, email: true } },
        timeSlot: {
          include: { event: { select: { id: true, title: true, location: true } } },
        },
      },
    });

    return {
      message: 'Ticket checked in successfully ✅',
      ticketId: updated.id,
      checkedInAt: updated.checkedInAt,
      quantity: updated.quantity,
      holder: updated.user,
      event: updated.timeSlot.event,
      slot: {
        label: updated.timeSlot.label,
        startTime: updated.timeSlot.startTime,
        endTime: updated.timeSlot.endTime,
      },
    };
  }
}

export const ticketService = new TicketService();
