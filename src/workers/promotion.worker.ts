import { Worker } from 'bullmq';
import redis from '../lib/redis';
import prisma from '../lib/prisma';
import { bookingRepository } from '../modules/booking/booking.repository';
import { notificationService } from '../modules/notification/notification.service';

const promotionWorker = new Worker(
  'promotion',
  async (job) => {
    const { timeSlotId } = job.data;

    await prisma.$transaction(async (tx: any) => {
      const slot = await bookingRepository.lockTimeSlotForUpdate(tx, timeSlotId);
      if (!slot) return;

      let remainingSpots = slot.capacity - slot.bookedCount;
      if (remainingSpots <= 0) return;

      const waitlisters = await tx.waitlist.findMany({
        where: { timeSlotId, status: 'WAITING' },
        orderBy: { position: 'asc' },
        include: { timeSlot: { include: { event: { select: { title: true } } } } },
      });

      for (const entry of waitlisters) {
        if (remainingSpots < entry.quantity) continue;

        await tx.waitlist.update({ where: { id: entry.id }, data: { status: 'PROMOTED' } });

        const existingBooking = await tx.booking.findUnique({
          where: { userId_timeSlotId: { userId: entry.userId, timeSlotId } },
        });

        if (existingBooking) {
          await tx.booking.update({
            where: { id: existingBooking.id },
            data: { status: 'CONFIRMED', quantity: entry.quantity, cancelledAt: null },
          });
        } else {
          await bookingRepository.createBookingInTx(tx, { userId: entry.userId, timeSlotId, quantity: entry.quantity });
        }

        await bookingRepository.incrementBookedCount(tx, timeSlotId, entry.quantity);
        remainingSpots -= entry.quantity;

        try {
          await notificationService.createPromotionNotification(entry.userId, entry.timeSlot.event.title, entry.timeSlot.label);
        } catch { /* don't fail promotion */ }

        console.log(`[PromotionWorker] Promoted user ${entry.userId} for slot ${timeSlotId}`);
      }
    }, { isolationLevel: 'Serializable' });
  },
  { connection: redis, concurrency: 1 },
);

promotionWorker.on('completed', (job) => console.log(`[PromotionWorker] Job ${job.id} completed`));
promotionWorker.on('failed', (job, err) => console.error(`[PromotionWorker] Job ${job?.id} failed:`, err.message));

console.log('[PromotionWorker] Started and listening for promotion jobs');
export default promotionWorker;
