-- DropForeignKey
ALTER TABLE "Chat" DROP CONSTRAINT "Chat_roomId_fkey";

-- DropForeignKey
ALTER TABLE "UserRooms" DROP CONSTRAINT "UserRooms_roomId_fkey";

-- AddForeignKey
ALTER TABLE "UserRooms" ADD CONSTRAINT "UserRooms_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
