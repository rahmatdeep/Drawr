"use server";

import { HTTP_BACKEND } from "@/config";
import axios from "axios";

export async function handleRoom(
  token: string,
  roomName: string,
  type: string
) {
  try {
    let roomId: string;

    if (type === "join") {
      // Try to get room ID first
      const roomResponse = await axios.get(`${HTTP_BACKEND}/room/${roomName}`, {
        headers: { Authorization: `${token}` },
      });

      if (!roomResponse.data.room) {
        throw new Error("Room not found");
      }
      roomId = roomResponse.data.room.id.toString();
      await axios.post(
        `${HTTP_BACKEND}/rooms`,
        { roomId },
        {
          headers: { Authorization: `${token}` },
        }
      );
    } else {
      // Create new room
      await axios.post(
        `${HTTP_BACKEND}/room`,
        { name: roomName },
        { headers: { Authorization: `${token}` } }
      );
      //   roomId = createResponse.data.roomId.toString();
    }
    
    return roomName
  } catch (error) {
    console.error("Error handling room:", error);
    throw error;
  }
}
