import { PrismaClient, EventCategory, BookingStatus, WaitlistStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcrypt';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://rama_dev:secretpassword@localhost:5432/booking_db',
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Helpers ──────────────────────────────────────────────────────

const CATEGORIES = Object.values(EventCategory);
const NAMES = [
  'Andi Pratama', 'Budi Santoso', 'Citra Wijaya', 'Dewi Lestari', 'Eka Putri',
  'Fitri Purnomo', 'Gilang Ramadhan', 'Hana Nugraha', 'Indra Setiawan', 'Joko Widodo',
  'Kartini Sari', 'Lukman Hakim', 'Maya Anggraini', 'Niko Pratama', 'Oscar Setiawan',
  'Putri Handayani', 'Qori Amaliah', 'Rizki Fauzan', 'Sari Dewi', 'Teguh Prasetyo',
  'Umar Said', 'Vina Oktavia', 'Wahyu Hidayat', 'Xena Aprilia', 'Yanto Sugiarto',
  'Zahra Ramadhani', 'Arief Budiman', 'Bayu Kusuma', 'Clara Natasha', 'Dimas Anggara',
];

const LOCATIONS = [
  'Gelora Bung Karno', 'Istora Senayan', 'Balai Kartini', 'JIEXPO Kemayoran', 'Ancol Beach City',
  'Mall Kelapa Gading', 'Gandaria City', 'Pacific Place', 'Summarecon Serpong', 'ICE BSD',
  'Aula ITB Bandung', 'Aula UI Depok', 'Hall UGM Yogyakarta', 'Convention Hall ITS Surabaya',
];

function randomItem<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function futureDate(daysFromNow: number, hour = 10): Date {
  const d = new Date(); d.setDate(d.getDate() + daysFromNow); d.setHours(hour, 0, 0, 0); return d;
}
function pastDate(daysAgo: number, hour = 10): Date {
  const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(hour, 0, 0, 0); return d;
}

const EVENT_NAMES: Record<string, string[]> = {
  CONCERT: ['Rock Night', 'Jazz Evening', 'Indie Showcase', 'Acoustic Session', 'Pop Festival', 'Metal Madness', 'R&B Vibes', 'Electronic Pulse'],
  WORKSHOP: ['UI/UX Bootcamp', 'Data Science Intro', 'Photography 101', 'Creative Writing', 'Web Dev Sprint', 'AI Workshop', 'Mobile Dev Lab', 'Product Design'],
  FESTIVAL: ['Pensi SMA 1', 'Festival Seni UGM', 'Kampus Fair ITB', 'Cultural Night UI', 'Music Fest ITS', 'Art Exhibition UB', 'Tech Fest Binus', 'Creative Show'],
};

// ─── Main Seed ────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database...\n');

  // Clean
  await prisma.notification.deleteMany();
  await prisma.waitlist.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.timeSlot.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  // ── 300 Users ──
  console.log('👤 Creating 300 users...');
  const passwordHash = await bcrypt.hash('password123', 10);
  const users = [];

  // First 5 = admins
  for (let i = 0; i < 300; i++) {
    const baseName = NAMES[i % NAMES.length];
    const suffix = i >= NAMES.length ? `_${Math.floor(i / NAMES.length)}` : '';
    const name = `${baseName}${suffix ? ` ${suffix.slice(1)}` : ''}`;
    const email = baseName.toLowerCase().replace(/ /g, '.') + suffix + '@mail.com';
    const prefs = [randomItem(CATEGORIES)];
    if (Math.random() > 0.5) prefs.push(randomItem(CATEGORIES.filter(c => c !== prefs[0])));

    const user = await prisma.user.create({
      data: {
        name, email, passwordHash,
        role: i < 5 ? 'ADMIN' : 'USER',
        timezone: 'Asia/Jakarta',
        preferences: [...new Set(prefs)],
      },
    });
    users.push(user);
  }
  console.log('   ✅ Created 300 users (5 admins + 295 users)\n');

  // ── 100 Events ──
  console.log('🎪 Creating 100 events...');
  const events = [];
  const admin = users[0];

  for (let i = 0; i < 100; i++) {
    const category = CATEGORIES[i % 3];
    const isPast = i < 30;
    const baseDay = isPast ? randomInt(10, 90) : randomInt(5, 60);
    const dateFn = isPast ? pastDate : futureDate;

    const slotCount = randomInt(1, 3);
    const timeSlots = [];
    for (let s = 0; s < slotCount; s++) {
      const hour = 9 + s * 3;
      timeSlots.push({
        label: ['Morning', 'Afternoon', 'Evening'][s] || `Session ${s + 1}`,
        startTime: dateFn(baseDay, hour),
        endTime: dateFn(baseDay, hour + 2),
        capacity: randomInt(15, 50),
      });
    }

    const event = await prisma.event.create({
      data: {
        title: `${EVENT_NAMES[category][i % EVENT_NAMES[category].length]} #${i + 1}`,
        description: `A ${category.toLowerCase()} event for everyone. Come join us for an amazing experience!`,
        location: randomItem(LOCATIONS),
        category,
        createdById: admin.id,
        timeSlots: { create: timeSlots },
      },
      include: { timeSlots: true },
    });
    events.push(event);
  }
  console.log('   ✅ Created 100 events\n');

  // ── Random bookings for realism ──
  console.log('📝 Creating random bookings for realism...');
  let bookingCount = 0;
  for (let i = 0; i < 100; i++) {
    const event = randomItem(events);
    const slot = randomItem(event.timeSlots);
    const user = users[randomInt(10, 299)];
    const qty = randomInt(1, 3);

    if (slot.bookedCount + qty <= slot.capacity) {
      try {
        await prisma.booking.create({
          data: { userId: user.id, timeSlotId: slot.id, quantity: qty, status: 'CONFIRMED' },
        });
        await prisma.timeSlot.update({ where: { id: slot.id }, data: { bookedCount: { increment: qty } } });
        slot.bookedCount += qty;
        bookingCount++;
      } catch { /* skip unique violations */ }
    }
  }
  console.log(`   ✅ Created ~${bookingCount} random bookings\n`);

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 1 — The Full Slot
  // Event with 2 time slots: one full (3 waitlisted), one with 2 spots
  // ═══════════════════════════════════════════════════════════════
  console.log('🔒 Scenario 1: The Full Slot');
  const s1Users = users.slice(100, 113);
  const s1Event = await prisma.event.create({
    data: {
      title: '🔒 [S1] Sold-Out Rock Concert',
      description: 'Scenario 1 — Event with 2 time slots. Slot A is fully booked with 3 on waitlist. Slot B has 2 spots left.',
      location: 'Gelora Bung Karno',
      category: 'CONCERT',
      createdById: admin.id,
      timeSlots: {
        create: [
          { label: 'Slot A — Full', startTime: futureDate(14, 19), endTime: futureDate(14, 22), capacity: 5 },
          { label: 'Slot B — 2 Left', startTime: futureDate(15, 19), endTime: futureDate(15, 22), capacity: 10 },
        ],
      },
    },
    include: { timeSlots: true },
  });

  const s1SlotA = s1Event.timeSlots[0];
  const s1SlotB = s1Event.timeSlots[1];

  // Fill Slot A (5 bookings)
  for (let i = 0; i < 5; i++) {
    await prisma.booking.create({ data: { userId: s1Users[i].id, timeSlotId: s1SlotA.id, quantity: 1, status: 'CONFIRMED' } });
  }
  await prisma.timeSlot.update({ where: { id: s1SlotA.id }, data: { bookedCount: 5 } });

  // 3 waitlist for Slot A
  for (let i = 0; i < 3; i++) {
    await prisma.waitlist.create({
      data: { userId: s1Users[5 + i].id, timeSlotId: s1SlotA.id, quantity: 1, position: i + 1, status: 'WAITING' },
    });
  }

  // Fill Slot B partially (8 of 10)
  for (let i = 0; i < 8; i++) {
    await prisma.booking.create({ data: { userId: s1Users[i].id, timeSlotId: s1SlotB.id, quantity: 1, status: 'CONFIRMED' } });
  }
  await prisma.timeSlot.update({ where: { id: s1SlotB.id }, data: { bookedCount: 8 } });

  console.log('   ✅ Event with 2 slots — Slot A: 5/5 booked + 3 waitlisted, Slot B: 8/10 (2 left)\n');

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 2 — The Busy User
  // ═══════════════════════════════════════════════════════════════
  console.log('🏃 Scenario 2: The Busy User');
  const busyUser = users.find(u => u.name === 'Bayu Kusuma') || users[27];

  // Past booking
  const s2PastEvent = await prisma.event.create({
    data: {
      title: '🏃 [S2] Past Workshop (Busy User)',
      description: 'Scenario 2 — Past event for the busy user.',
      location: 'Balai Kartini', category: 'WORKSHOP', createdById: admin.id,
      timeSlots: { create: [{ label: 'Main Session', startTime: pastDate(10, 10), endTime: pastDate(10, 13), capacity: 30 }] },
    },
    include: { timeSlots: true },
  });
  await prisma.booking.create({
    data: { userId: busyUser.id, timeSlotId: s2PastEvent.timeSlots[0].id, quantity: 2, status: 'CONFIRMED' },
  });
  await prisma.timeSlot.update({ where: { id: s2PastEvent.timeSlots[0].id }, data: { bookedCount: 2 } });

  // Upcoming booking
  const s2UpcomingEvent = await prisma.event.create({
    data: {
      title: '🏃 [S2] Upcoming Concert (Busy User)',
      description: 'Scenario 2 — Upcoming event for the busy user.',
      location: 'Istora Senayan', category: 'CONCERT', createdById: admin.id,
      timeSlots: { create: [{ label: 'Evening Show', startTime: futureDate(7, 19), endTime: futureDate(7, 22), capacity: 50 }] },
    },
    include: { timeSlots: true },
  });
  await prisma.booking.create({
    data: { userId: busyUser.id, timeSlotId: s2UpcomingEvent.timeSlots[0].id, quantity: 3, status: 'CONFIRMED' },
  });
  await prisma.timeSlot.update({ where: { id: s2UpcomingEvent.timeSlots[0].id }, data: { bookedCount: 3 } });

  // Active waitlist
  const s2WaitlistEvent = await prisma.event.create({
    data: {
      title: '🏃 [S2] Full Festival (Busy User Waitlisted)',
      description: 'Scenario 2 — Event where busy user is on waitlist.',
      location: 'JIEXPO Kemayoran', category: 'FESTIVAL', createdById: admin.id,
      timeSlots: { create: [{ label: 'All Day', startTime: futureDate(20, 10), endTime: futureDate(20, 22), capacity: 5 }] },
    },
    include: { timeSlots: true },
  });
  // Fill slot
  for (let i = 0; i < 5; i++) {
    await prisma.booking.create({
      data: { userId: users[200 + i].id, timeSlotId: s2WaitlistEvent.timeSlots[0].id, quantity: 1, status: 'CONFIRMED' },
    });
  }
  await prisma.timeSlot.update({ where: { id: s2WaitlistEvent.timeSlots[0].id }, data: { bookedCount: 5 } });
  await prisma.waitlist.create({
    data: { userId: busyUser.id, timeSlotId: s2WaitlistEvent.timeSlots[0].id, quantity: 1, position: 1, status: 'WAITING' },
  });

  console.log(`   ✅ User "${busyUser.name}" (${busyUser.email}) — past booking, upcoming booking, active waitlist\n`);

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 3 — The Multi-Slot Event
  // ═══════════════════════════════════════════════════════════════
  console.log('🎰 Scenario 3: The Multi-Slot Event');
  const s3Event = await prisma.event.create({
    data: {
      title: '🎰 [S3] Tech Summit (Multi-Slot)',
      description: 'Scenario 3 — Event with 3 slots in different conditions: Open, Full, 1 spot left.',
      location: 'ICE BSD', category: 'WORKSHOP', createdById: admin.id,
      timeSlots: {
        create: [
          { label: 'Morning — Open', startTime: futureDate(21, 9), endTime: futureDate(21, 12), capacity: 20 },
          { label: 'Afternoon — Full', startTime: futureDate(21, 13), endTime: futureDate(21, 16), capacity: 10 },
          { label: 'Evening — 1 Spot', startTime: futureDate(21, 17), endTime: futureDate(21, 20), capacity: 15 },
        ],
      },
    },
    include: { timeSlots: true },
  });

  // Morning: 10/20
  for (let i = 0; i < 10; i++) {
    await prisma.booking.create({
      data: { userId: users[120 + i].id, timeSlotId: s3Event.timeSlots[0].id, quantity: 1, status: 'CONFIRMED' },
    });
  }
  await prisma.timeSlot.update({ where: { id: s3Event.timeSlots[0].id }, data: { bookedCount: 10 } });

  // Afternoon: 10/10 (full)
  for (let i = 0; i < 10; i++) {
    await prisma.booking.create({
      data: { userId: users[130 + i].id, timeSlotId: s3Event.timeSlots[1].id, quantity: 1, status: 'CONFIRMED' },
    });
  }
  await prisma.timeSlot.update({ where: { id: s3Event.timeSlots[1].id }, data: { bookedCount: 10 } });

  // Evening: 14/15 (1 spot left)
  for (let i = 0; i < 14; i++) {
    await prisma.booking.create({
      data: { userId: users[140 + i].id, timeSlotId: s3Event.timeSlots[2].id, quantity: 1, status: 'CONFIRMED' },
    });
  }
  await prisma.timeSlot.update({ where: { id: s3Event.timeSlots[2].id }, data: { bookedCount: 14 } });

  console.log('   ✅ Morning 10/20 (Open), Afternoon 10/10 (Full), Evening 14/15 (1 spot)\n');

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 4 — The Cancellation Chain
  // ═══════════════════════════════════════════════════════════════
  console.log('🔄 Scenario 4: The Cancellation Chain');
  const s4Event = await prisma.event.create({
    data: {
      title: '🔄 [S4] Concert With Cancellation',
      description: 'Scenario 4 — Cancellation happened, waitlist auto-promotion occurred.',
      location: 'Ancol Beach City', category: 'CONCERT', createdById: admin.id,
      timeSlots: { create: [{ label: 'Main Show', startTime: futureDate(10, 19), endTime: futureDate(10, 23), capacity: 5 }] },
    },
    include: { timeSlots: true },
  });

  const s4Slot = s4Event.timeSlots[0];
  const cancelledUser = users.find(u => u.name === 'Hana Nugraha') || users[7];
  const promotedUser = users.find(u => u.name === 'Fitri Purnomo') || users[5];
  const waitingUser = users.find(u => u.name === 'Citra Wijaya') || users[2];

  // 5 bookings (one by cancelledUser)
  await prisma.booking.create({ data: { userId: cancelledUser.id, timeSlotId: s4Slot.id, quantity: 1, status: 'CANCELLED', cancelledAt: pastDate(1) } });
  for (let i = 0; i < 4; i++) {
    await prisma.booking.create({ data: { userId: users[160 + i].id, timeSlotId: s4Slot.id, quantity: 1, status: 'CONFIRMED' } });
  }
  // Promoted user now has active booking
  await prisma.booking.create({ data: { userId: promotedUser.id, timeSlotId: s4Slot.id, quantity: 1, status: 'CONFIRMED' } });
  await prisma.timeSlot.update({ where: { id: s4Slot.id }, data: { bookedCount: 5 } });

  // Waitlist entries
  await prisma.waitlist.create({ data: { userId: promotedUser.id, timeSlotId: s4Slot.id, quantity: 1, position: 1, status: 'PROMOTED' } });
  await prisma.waitlist.create({ data: { userId: waitingUser.id, timeSlotId: s4Slot.id, quantity: 1, position: 2, status: 'WAITING' } });

  // Create notification for promoted user
  await prisma.notification.create({
    data: {
      userId: promotedUser.id,
      type: 'WAITLIST_PROMOTED',
      title: '🎉 You\'ve been promoted from the waitlist!',
      message: `A spot opened up for "${s4Event.title}" (Main Show). Your booking is now confirmed.`,
      metadata: { eventTitle: s4Event.title, slotLabel: 'Main Show' },
    },
  });

  console.log(`   ✅ ${cancelledUser.name} → CANCELLED, ${promotedUser.name} → PROMOTED, ${waitingUser.name} → WAITING\n`);

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 5 — The Conflict
  // User has booked BOTH overlapping events
  // ═══════════════════════════════════════════════════════════════
  console.log('⚡ Scenario 5: The Conflict');
  const conflictUser = users.find(u => u.name === 'Oscar Setiawan') || users[14];

  const s5EventA = await prisma.event.create({
    data: {
      title: '⚡ [S5] Conflict Event A (Booked)',
      description: 'Scenario 5 — User booked this event, which overlaps with Event B.',
      location: 'Balai Kartini', category: 'CONCERT', createdById: admin.id,
      timeSlots: { create: [{ label: 'Evening Show', startTime: futureDate(15, 19), endTime: futureDate(15, 22), capacity: 50 }] },
    },
    include: { timeSlots: true },
  });

  const s5EventB = await prisma.event.create({
    data: {
      title: '⚡ [S5] Conflict Event B (Also Booked — Overlapping!)',
      description: 'Scenario 5 — User also booked this event, which overlaps with Event A. Demonstrates the data state.',
      location: 'Mall Kelapa Gading', category: 'WORKSHOP', createdById: admin.id,
      timeSlots: { create: [{ label: 'Night Workshop', startTime: futureDate(15, 20), endTime: futureDate(15, 23), capacity: 30 }] },
    },
    include: { timeSlots: true },
  });

  // User booked BOTH (the system should prevent this for new bookings, but seed shows the data state)
  await prisma.booking.create({ data: { userId: conflictUser.id, timeSlotId: s5EventA.timeSlots[0].id, quantity: 1, status: 'CONFIRMED' } });
  await prisma.timeSlot.update({ where: { id: s5EventA.timeSlots[0].id }, data: { bookedCount: 1 } });
  await prisma.booking.create({ data: { userId: conflictUser.id, timeSlotId: s5EventB.timeSlots[0].id, quantity: 1, status: 'CONFIRMED' } });
  await prisma.timeSlot.update({ where: { id: s5EventB.timeSlots[0].id }, data: { bookedCount: 1 } });

  console.log(`   ✅ User "${conflictUser.name}" (${conflictUser.email})`);
  console.log(`      ✓ Booked: Event A "${s5EventA.title}" (${s5EventA.timeSlots[0].startTime.toISOString()})`);
  console.log(`      ✓ Booked: Event B "${s5EventB.title}" (${s5EventB.timeSlots[0].startTime.toISOString()})`);
  console.log(`      → Both booked — API will prevent future overlapping bookings\n`);

  // ═══════════════════════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════════════════════
  const counts = {
    users: await prisma.user.count(),
    events: await prisma.event.count(),
    bookings: await prisma.booking.count(),
    waitlists: await prisma.waitlist.count(),
    notifications: await prisma.notification.count(),
  };

  console.log('════════════════════════════════════════════════════════════');
  console.log('📊 SEED SUMMARY');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`   Users:         ${counts.users} (5 admins + 295 users)`);
  console.log(`   Events:        ${counts.events}`);
  console.log(`   Bookings:      ${counts.bookings}`);
  console.log(`   Waitlist:      ${counts.waitlists}`);
  console.log(`   Notifications: ${counts.notifications}`);
  console.log('════════════════════════════════════════════════════════════\n');

  console.log('✅ Seeding completed successfully!\n');
  console.log('🔑 KEY SCENARIO USER CREDENTIALS');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`   Admin:          andi.pratama@mail.com / password123`);
  console.log(`   Busy User (S2): bayu.kusuma@mail.com / password123`);
  console.log(`   Cancelled (S4): hana.nugraha@mail.com / password123`);
  console.log(`   Promoted (S4):  fitri.purnomo@mail.com / password123`);
  console.log(`   Waiting (S4):   citra.wijaya@mail.com / password123`);
  console.log(`   Conflict (S5):  oscar.setiawan@mail.com / password123`);
  console.log('════════════════════════════════════════════════════════════');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
