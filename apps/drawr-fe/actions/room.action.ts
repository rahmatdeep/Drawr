"use server";

import { HTTP_BACKEND } from "@/config";
import axios, { AxiosError } from "axios";

export async function handleRoom(
  token: string,
  roomName: string,
  type: string
) {
  let errorMessage: string | null = null;
  try {
    let roomId: string;
    if (type === "join") {
      // Try to get room ID first
      const roomResponse = await axios.get(`${HTTP_BACKEND}/room/${roomName}`, {
        headers: { Authorization: `${token}` },
      });

      if (!roomResponse.data.room) {
        errorMessage =
          "Room does not exist. Please enter a valid room name or create a new room.";
        return errorMessage;
      }
      roomId = roomResponse.data.room.id.toString();
      try {
        await axios.post(
          `${HTTP_BACKEND}/rooms`,
          { roomId },
          {
            headers: { Authorization: `${token}` },
          }
        );
      } catch (e) {
        const error = e as AxiosError;
        if (error.status === 409) {
          errorMessage =
            "Rooms is already joined please enter it from the list below";
        }
      }
    } else if (type === "create") {
      // Create new room
      try {
        await axios.post(
          `${HTTP_BACKEND}/room`,
          { name: roomName },
          { headers: { Authorization: `${token}` } }
        );
      } catch (e) {
        const error = e as AxiosError;
        if (error.status === 409) {
          errorMessage =
            "A Room with this name already exists please use another name";
        }
      }
      //   roomId = createResponse.data.roomId.toString();
    }

    return errorMessage;
  } catch (error) {
    console.error("Error handling room:", error);
    throw error;
  }
}
