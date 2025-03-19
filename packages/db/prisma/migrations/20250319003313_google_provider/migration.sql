-- AlterTable
ALTER TABLE "User" ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerAccountId" TEXT,
ALTER COLUMN "password" DROP NOT NULL;
