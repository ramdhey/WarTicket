-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "checkedInAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "refreshToken" TEXT;
