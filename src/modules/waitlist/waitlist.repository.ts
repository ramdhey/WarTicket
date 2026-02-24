import prisma from '../../lib/prisma';
import type { Prisma } from '@prisma/client';

export class WaitlistRepository {
  async findByUserAndSlot(userId: string, timeSlotId: string) {
    return prisma.waitlist.findUnique({
      where: { userId_timeSlotId: { userId, timeSlotId } },
    });
  }

  async findWaitingBySlot(timeSlotId: string) {
    return prisma.waitlist.findMany({
      where: { timeSlotId, status: 'WAITING' },
      orderBy: { position: 'asc' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async findByUser(userId: string) {
    return prisma.waitlist.findMany({
      where: { userId },
      include: { timeSlot: { include: { event: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getNextPosition(tx: Prisma.TransactionClient, timeSlotId: string): Promise<number> {
    const result = await tx.waitlist.aggregate({
      where: { timeSlotId, status: 'WAITING' },
      _max: { position: true },
    });
    return (result._max.position ?? 0) + 1;
  }

  async create(
    tx: Prisma.TransactionClient,
    data: { userId: string; timeSlotId: string; quantity: number; position: number },
  ) {
    return tx.waitlist.create({
      data: { ...data, status: 'WAITING' },
    });
  }

  async promoteEntry(tx: Prisma.TransactionClient, id: string) {
    return tx.waitlist.update({
      where: { id },
      data: { status: 'PROMOTED' },
    });
  }

  /**
   * Lock waiting entries for a slot (FIFO order) for promotion.
   */
  async lockWaitingEntries(tx: Prisma.TransactionClient, timeSlotId: string) {
    return tx.$queryRaw<Array<{
      id: string; userId: string; timeSlotId: string;
      quantity: number; position: number;
    }>>`
      SELECT id, "userId", "timeSlotId", quantity, position
      FROM waitlists
      WHERE "timeSlotId" = ${timeSlotId} AND status = 'WAITING'
      ORDER BY position ASC
      FOR UPDATE
    `;
  }
}

export const waitlistRepository = new WaitlistRepository();
