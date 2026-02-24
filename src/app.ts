import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/auth.routes';
import eventRoutes from './modules/event/event.routes';
import bookingRoutes from './modules/booking/booking.routes';
import waitlistRoutes from './modules/waitlist/waitlist.routes';
import notificationRoutes from './modules/notification/notification.routes';
import ticketRoutes from './modules/ticket/ticket.routes';
import uploadRoutes from './modules/upload/upload.routes';
import { errorHandler } from './middlewares/errorHandler';
import path from 'path';

const app = express();

// Trust proxy for correct protocol generation behind NGINX
app.set('trust proxy', 1);

// Global middleware
app.use(cors());
app.use(express.json());

// Serve static uploads folder
app.use('/public/uploads', express.static(path.join(process.cwd(), 'public/uploads')));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/waitlists', waitlistRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin/tickets', ticketRoutes);
app.use('/api/upload', uploadRoutes);

// Error handler (must be last)
app.use(errorHandler);

export default app;
