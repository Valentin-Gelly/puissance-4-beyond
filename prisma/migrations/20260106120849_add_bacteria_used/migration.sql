-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "guestBacteriaUsed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hostBacteriaUsed" BOOLEAN NOT NULL DEFAULT false;
