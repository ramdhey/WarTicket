import { Queue } from 'bullmq';
import redis from './redis';

export const bookingQueue = new Queue('booking', { connection: redis });
export const promotionQueue = new Queue('promotion', { connection: redis });
