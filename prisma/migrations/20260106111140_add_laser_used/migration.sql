-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "guestLaserUsed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hostLaserUsed" BOOLEAN NOT NULL DEFAULT false;
