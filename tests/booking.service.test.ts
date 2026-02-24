import { mockDeep, mockReset } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { bookingService } from '@/modules/booking/booking.service';
import { bookingRepository } from '@/modules/booking/booking.repository';
import { promotionQueue } from '@/lib/queue';
import { AppError } from '@/middlewares/errorHandler';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));
import prismaMock from '@/lib/prisma';

jest.mock('@/modules/booking/booking.repository');
jest.mock('@/lib/queue', () => ({
  promotionQueue: { add: jest.fn() },
}));

const mockPrisma = prismaMock as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

describe('BookingService', () => {
  beforeEach(() => {
    mockReset(mockPrisma);
    jest.clearAllMocks();
  });

  describe('processBooking', () => {
    const userId = 'user-123';
    const timeSlotId = 'slot-123';
    const input = { timeSlotId, quantity: 2 };

    it('should throw error if time slot not found', async () => {
      // Mock transaction simulation
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      (bookingRepository.lockTimeSlotForUpdate as jest.Mock).mockResolvedValue(null);

      await expect(bookingService.processBooking(userId, input)).rejects.toThrow(
        new AppError(404, 'Time slot not found', 'SLOT_NOT_FOUND')
      );
    });

    it('should throw error if already confirmed booked', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
      (bookingRepository.lockTimeSlotForUpdate as jest.Mock).mockResolvedValue({ id: timeSlotId, capacity: 10, bookedCount: 5 });
      
      mockPrisma.booking.findUnique.mockResolvedValue({ status: 'CONFIRMED' } as any);

      await expect(bookingService.processBooking(userId, input)).rejects.toThrow(AppError);
    });

    it('should throw error on time conflict', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
      (bookingRepository.lockTimeSlotForUpdate as jest.Mock).mockResolvedValue({ 
        id: timeSlotId, capacity: 10, bookedCount: 5, startTime: new Date('2024-01-01T10:00:00Z'), endTime: new Date('2024-01-01T12:00:00Z') 
      });
      mockPrisma.booking.findUnique.mockResolvedValue(null);
      mockPrisma.booking.findMany.mockResolvedValue([
        { timeSlot: { id: 'slot-other', startTime: new Date('2024-01-01T11:00:00Z'), endTime: new Date('2024-01-01T13:00:00Z') } }
      ] as any);

      await expect(bookingService.processBooking(userId, input)).rejects.toThrow(AppError);
    });

    it('should waitlist if capacity is full', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
      (bookingRepository.lockTimeSlotForUpdate as jest.Mock).mockResolvedValue({ 
        id: timeSlotId, capacity: 10, bookedCount: 9, startTime: new Date('2024-01-01T10:00:00Z'), endTime: new Date('2024-01-01T12:00:00Z') 
      });
      mockPrisma.booking.findUnique.mockResolvedValue(null);
      mockPrisma.booking.findMany.mockResolvedValue([]);
      
      mockPrisma.waitlist.aggregate.mockResolvedValue({ _max: { position: 5 } } as any);
      mockPrisma.waitlist.create.mockResolvedValue({ id: 'waitlist-1', position: 6 } as any);

      const result = await bookingService.processBooking(userId, input);

      expect(result.status).toBe('WAITLISTED');
      expect(mockPrisma.waitlist.create).toHaveBeenCalledWith({
        data: { userId, timeSlotId, quantity: 2, position: 6, status: 'WAITING' }
      });
    });

    it('should confirm booking if seats are available', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
      (bookingRepository.lockTimeSlotForUpdate as jest.Mock).mockResolvedValue({ 
        id: timeSlotId, capacity: 10, bookedCount: 5, startTime: new Date('2024-01-01T10:00:00Z'), endTime: new Date('2024-01-01T12:00:00Z') 
      });
      mockPrisma.booking.findUnique.mockResolvedValue(null);
      mockPrisma.booking.findMany.mockResolvedValue([]);
      
      (bookingRepository.createBookingInTx as jest.Mock).mockResolvedValue({ id: 'booking-1', status: 'CONFIRMED' });

      const result = await bookingService.processBooking(userId, input);

      expect(result.status).toBe('CONFIRMED');
      expect(bookingRepository.createBookingInTx).toHaveBeenCalled();
      expect(bookingRepository.incrementBookedCount).toHaveBeenCalledWith(mockPrisma, timeSlotId, 2);
    });
  });

  describe('cancelBooking', () => {
    it('should completely cancel and trigger waitlist promotion', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
      mockPrisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', userId: 'user-1', timeSlotId: 'slot-1', quantity: 3, status: 'CONFIRMED' } as any);

      await bookingService.cancelBooking('user-1', 'booking-1');

      expect(mockPrisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        data: expect.objectContaining({ status: 'CANCELLED' })
      });
      expect(bookingRepository.decrementBookedCount).toHaveBeenCalledWith(mockPrisma, 'slot-1', 3);
      expect(promotionQueue.add).toHaveBeenCalledWith('promote', { timeSlotId: 'slot-1', freedQuantity: 3 });
    });
  });
  
  describe('partialCancel', () => {
    it('should reduce booking quantity and trigger promotion queue', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
      mockPrisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', userId: 'user-1', timeSlotId: 'slot-1', quantity: 5, status: 'CONFIRMED' } as any);

      const result = await bookingService.partialCancel('user-1', 'booking-1', 2);

      expect(result.newQuantity).toBe(3);
      expect(mockPrisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        data: { quantity: 3 }
      });
      expect(bookingRepository.decrementBookedCount).toHaveBeenCalledWith(mockPrisma, 'slot-1', 2);
      expect(promotionQueue.add).toHaveBeenCalledWith('promote', { timeSlotId: 'slot-1', freedQuantity: 2 });
    });
  });

  describe('undoCancellation', () => {
    it('should allow undoing cancellation if within window and capacity permits', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
      
      const cancelledAt = new Date();
      cancelledAt.setMinutes(cancelledAt.getMinutes() - 2); // 2 minutes ago (valid window)

      mockPrisma.booking.findUnique.mockResolvedValue({ 
        id: 'booking-1', userId: 'user-1', timeSlotId: 'slot-1', quantity: 2, status: 'CANCELLED', cancelledAt 
      } as any);

      (bookingRepository.lockTimeSlotForUpdate as jest.Mock).mockResolvedValue({ capacity: 10, bookedCount: 5 });

      await bookingService.undoCancellation('user-1', 'booking-1');

      expect(mockPrisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        data: { status: 'CONFIRMED', cancelledAt: null }
      });
      expect(bookingRepository.incrementBookedCount).toHaveBeenCalledWith(mockPrisma, 'slot-1', 2);
    });

    it('should reject undo if window expired', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
      
      const cancelledAt = new Date();
      cancelledAt.setMinutes(cancelledAt.getMinutes() - 6); // 6 minutes ago (expired)

      mockPrisma.booking.findUnique.mockResolvedValue({ 
        id: 'booking-1', userId: 'user-1', timeSlotId: 'slot-1', quantity: 2, status: 'CANCELLED', cancelledAt 
      } as any);

      await expect(bookingService.undoCancellation('user-1', 'booking-1')).rejects.toThrow(
        new AppError(400, 'Undo window expired (5 minutes). Please make a new booking.', 'UNDO_EXPIRED')
      );
    });
  });
});
