import prisma from '../../lib/prisma';
import { AppError } from '../../middlewares/errorHandler';

/**
 * Parse ticket ID which may be in format "bookingId:ticketNumber" or plain "bookingId".
 */
function parseTicketId(ticketId: string): { bookingId: string; ticketNumber: number } {
  const parts = ticketId.split(':');
  if (parts.length === 2 && !isNaN(Number(parts[1]))) {
    return { bookingId: parts[0], ticketNumber: Number(parts[1]) };
  }
  return { bookingId: ticketId, ticketNumber: 1 };
}

export class TicketService {
  async verifyTicket(rawTicketId: string) {
    const { bookingId, ticketNumber } = parseTicketId(rawTicketId);

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

    if (ticketNumber < 1 || ticketNumber > booking.quantity) {
      throw new AppError(404, `Ticket #${ticketNumber} not found. This booking has ${booking.quantity} ticket(s).`, 'TICKET_NOT_FOUND');
    }

    const isValid = booking.status === 'CONFIRMED';
    const isCheckedIn = !!booking.checkedInAt;
    const isExpired = new Date(booking.timeSlot.endTime) < new Date();

    return {
      ticketId: rawTicketId,
      bookingId: booking.id,
      ticketNumber,
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

  async checkInTicket(rawTicketId: string) {
    const { bookingId, ticketNumber } = parseTicketId(rawTicketId);

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

    if (ticketNumber < 1 || ticketNumber > booking.quantity) {
      throw new AppError(404, `Ticket #${ticketNumber} not found. This booking has ${booking.quantity} ticket(s).`, 'TICKET_NOT_FOUND');
    }

    if (booking.status !== 'CONFIRMED') {
      throw new AppError(400, `Ticket is ${booking.status}. Only confirmed tickets can be checked in.`, 'TICKET_NOT_CONFIRMED');
    }

    if (booking.checkedInAt) {
      throw new AppError(409, `Ticket already checked in at ${booking.checkedInAt.toISOString()}. Cannot use again.`, 'ALREADY_CHECKED_IN');
    }

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
      message: `Ticket #${ticketNumber} checked in successfully`,
      ticketId: rawTicketId,
      bookingId: updated.id,
      ticketNumber,
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
