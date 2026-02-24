import { eventRepository } from './event.repository';
import { AppError } from '../../middlewares/errorHandler';
import type { CreateEventInput, UpdateEventInput, EventQuery } from './event.schema';

export class EventService {
  async create(userId: string, input: CreateEventInput) {
    for (const slot of input.timeSlots) {
      if (new Date(slot.startTime) >= new Date(slot.endTime)) {
        throw new AppError(400, `Time slot "${slot.label}": start must be before end`, 'INVALID_TIME_RANGE');
      }
    }

    return eventRepository.create({
      title: input.title,
      description: input.description,
      location: input.location,
      imageUrl: input.imageUrl,
      bannerUrl: input.bannerUrl,
      category: input.category,
      createdBy: { connect: { id: userId } },
      timeSlots: {
        create: input.timeSlots.map(slot => ({
          label: slot.label,
          startTime: new Date(slot.startTime),
          endTime: new Date(slot.endTime),
          capacity: slot.capacity,
        })),
      },
    });
  }

  async update(userId: string, userRole: string, eventId: string, input: UpdateEventInput) {
    const event = await eventRepository.findById(eventId);
    if (!event) throw new AppError(404, 'Event not found', 'EVENT_NOT_FOUND');
    if (event.createdById !== userId && userRole !== 'ADMIN') {
      throw new AppError(403, 'Only the event creator or admin can edit', 'FORBIDDEN');
    }
    return eventRepository.update(eventId, input);
  }

  async delete(userId: string, userRole: string, eventId: string) {
    const event = await eventRepository.findById(eventId);
    if (!event) throw new AppError(404, 'Event not found', 'EVENT_NOT_FOUND');
    if (event.createdById !== userId && userRole !== 'ADMIN') {
      throw new AppError(403, 'Only the event creator or admin can delete', 'FORBIDDEN');
    }
    return eventRepository.delete(eventId);
  }

  async getById(id: string) {
    const event = await eventRepository.findById(id);
    if (!event) throw new AppError(404, 'Event not found', 'EVENT_NOT_FOUND');

    return {
      ...event,
      timeSlots: event.timeSlots.map((slot: any) => ({
        ...slot,
        availableSpots: slot.capacity - slot.bookedCount,
        isFull: slot.bookedCount >= slot.capacity,
      })),
    };
  }

  async list(query: EventQuery, userPreferences?: string[]) {
    const where: any = {};
    if (query.category) where.category = query.category;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.upcoming !== false) {
      where.timeSlots = { some: { startTime: { gt: new Date() } } };
    }

    const skip = (query.page - 1) * query.limit;

    if (query.sort === 'smart' && userPreferences && userPreferences.length > 0) {
      const { events: allEvents, total } = await eventRepository.findMany({ where });

      const sorted = allEvents.sort((a: any, b: any) => {
        const aPref = userPreferences.includes(a.category) ? 0 : 1;
        const bPref = userPreferences.includes(b.category) ? 0 : 1;
        if (aPref !== bPref) return aPref - bPref;

        const aNext = a.timeSlots.find((s: any) => new Date(s.startTime) > new Date());
        const bNext = b.timeSlots.find((s: any) => new Date(s.startTime) > new Date());
        const aTime = aNext ? new Date(aNext.startTime).getTime() : Infinity;
        const bTime = bNext ? new Date(bNext.startTime).getTime() : Infinity;
        if (aTime !== bTime) return aTime - bTime;

        const aAvail = a.timeSlots.reduce((sum: number, s: any) => sum + (s.capacity - s.bookedCount), 0);
        const bAvail = b.timeSlots.reduce((sum: number, s: any) => sum + (s.capacity - s.bookedCount), 0);
        return bAvail - aAvail;
      });

      return {
        events: sorted.slice(skip, skip + query.limit),
        pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
      };
    }

    const { events, total } = await eventRepository.findMany({
      skip, take: query.limit, where, orderBy: { createdAt: 'desc' },
    });

    return {
      events,
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }
}

export const eventService = new EventService();
