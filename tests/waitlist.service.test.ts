import { mockDeep, mockReset } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { waitlistService } from '@/modules/waitlist/waitlist.service';
import { waitlistRepository } from '@/modules/waitlist/waitlist.repository';
import { AppError } from '@/middlewares/errorHandler';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));
import prismaMock from '@/lib/prisma';

jest.mock('@/modules/waitlist/waitlist.repository');

const mockPrisma = prismaMock as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

describe('WaitlistService', () => {
  beforeEach(() => {
    mockReset(mockPrisma);
    jest.clearAllMocks();
  });

  describe('joinWaitlist', () => {
    const userId = 'user-1';
    const timeSlotId = 'slot-1';
    const input = { timeSlotId, quantity: 2 };

    it('should throw error if time slot not found', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
      mockPrisma.timeSlot.findUnique.mockResolvedValue(null);

      await expect(waitlistService.joinWaitlist(userId, input)).rejects.toThrow(
        new AppError(404, 'Time slot not found', 'SLOT_NOT_FOUND')
      );
    });

    it('should throw error if already on waitlist', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
      mockPrisma.timeSlot.findUnique.mockResolvedValue({ id: timeSlotId } as any);
      mockPrisma.waitlist.findUnique.mockResolvedValue({ status: 'WAITING' } as any);

      await expect(waitlistService.joinWaitlist(userId, input)).rejects.toThrow(
        new AppError(409, 'Already on waitlist for this slot', 'ALREADY_WAITLISTED')
      );
    });

    it('should throw error if already confirmed booked', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
      mockPrisma.timeSlot.findUnique.mockResolvedValue({ id: timeSlotId } as any);
      mockPrisma.waitlist.findUnique.mockResolvedValue(null);
      mockPrisma.booking.findUnique.mockResolvedValue({ status: 'CONFIRMED' } as any);

      await expect(waitlistService.joinWaitlist(userId, input)).rejects.toThrow(
        new AppError(409, 'Already booked for this slot', 'ALREADY_BOOKED')
      );
    });

    it('should accurately calculate next position and create waitlist entry', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
      mockPrisma.timeSlot.findUnique.mockResolvedValue({ id: timeSlotId } as any);
      mockPrisma.waitlist.findUnique.mockResolvedValue(null);
      mockPrisma.booking.findUnique.mockResolvedValue(null);

      (waitlistRepository.getNextPosition as jest.Mock).mockResolvedValue(5);
      (waitlistRepository.create as jest.Mock).mockResolvedValue({ id: 'waitlist-1', position: 5 });

      const result = await waitlistService.joinWaitlist(userId, input);

      expect(result.position).toBe(5);
      expect(waitlistRepository.getNextPosition).toHaveBeenCalledWith(mockPrisma, timeSlotId);
      expect(waitlistRepository.create).toHaveBeenCalledWith(mockPrisma, {
        userId,
        timeSlotId,
        quantity: 2,
        position: 5
      });
    });
  });
});
