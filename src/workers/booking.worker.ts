import { Worker, Job } from 'bullmq';
import redis from '../lib/redis';
import { bookingService } from '../modules/booking/booking.service';

interface BookingJobData {
  userId: string;
  timeSlotId: string;
  quantity: number;
}

const bookingWorker = new Worker<BookingJobData>(
  'booking',
  async (job: Job<BookingJobData>) => {
    console.log(`[BookingWorker] Processing job ${job.id}: user=${job.data.userId}, slot=${job.data.timeSlotId}`);
    try {
      const result = await bookingService.processBooking(job.data.userId, {
        timeSlotId: job.data.timeSlotId,
        quantity: job.data.quantity,
      });
      console.log(`[BookingWorker] Job ${job.id} completed: ${result.status}`);
      return result;
    } catch (error: any) {
      console.error(`[BookingWorker] Job ${job.id} failed:`, error.message);
      throw error;
    }
  },
  { connection: redis, concurrency: 1 },
);

bookingWorker.on('failed', (job, err) => {
  console.error(`[BookingWorker] Job ${job?.id} failed permanently:`, err.message);
});

console.log('[BookingWorker] Started and listening for booking jobs');
export default bookingWorker;
