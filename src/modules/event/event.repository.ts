import prisma from '../../lib/prisma';

export class EventRepository {
  async create(data: any) {
    return prisma.event.create({
      data,
      include: { timeSlots: true },
    });
  }

  async findById(id: string) {
    return prisma.event.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        timeSlots: {
          include: {
            _count: { select: { bookings: { where: { status: 'CONFIRMED' } }, waitlists: { where: { status: 'WAITING' } } } },
          },
          orderBy: { startTime: 'asc' },
        },
      },
    });
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: any;
    orderBy?: any;
  }) {
    const [events, total] = await prisma.$transaction([
      prisma.event.findMany({
        ...params,
        include: {
          createdBy: { select: { id: true, name: true } },
          timeSlots: {
            select: {
              id: true, label: true, startTime: true, endTime: true,
              capacity: true, bookedCount: true,
            },
            orderBy: { startTime: 'asc' },
          },
        },
      }),
      prisma.event.count({ where: params.where }),
    ]);
    return { events, total };
  }

  async update(id: string, data: any) {
    return prisma.event.update({
      where: { id },
      data,
      include: { timeSlots: true },
    });
  }

  async delete(id: string) {
    return prisma.event.delete({ where: { id } });
  }
}

export const eventRepository = new EventRepository();
