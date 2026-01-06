-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "guestBombUsed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hostBombUsed" BOOLEAN NOT NULL DEFAULT false;
