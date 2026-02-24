import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import './workers/booking.worker';
import './workers/promotion.worker';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 WarTicket API running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
});
