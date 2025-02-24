import { WebSocket, WebSocketServer } from "ws";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { prismaClient } from "@repo/db/client";
const wss = new WebSocketServer({ port: 8080 });

interface User {
  ws: WebSocket;
  rooms: string[];
  userId: string;
}

const users: User[] = [];

function checkUser(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (!decoded.userId) {
      return null;
    } else {
      return decoded.userId;
    }
  } catch {
    return null;
  }
}

wss.on("connection", function (ws, req) {
  const url = req.url;
  if (!url || !url.includes("?")) {
    ws.send(JSON.stringify({ message: "Unauthorized, URL is wrong" }));
    setTimeout(() => ws.close(), 100);
    return;
  }
  const queryParams = new URLSearchParams(url.split("?")[1]);
  const token = queryParams.get("token");
  if (!token) {
    ws.send(JSON.stringify({ message: "Unauthorized, token is not present" }));
    setTimeout(() => ws.close(), 100);
    return;
  }
  const userId = checkUser(token);
  if (!userId) {
    ws.send(
      JSON.stringify({ message: "Unauthorized, userid not present in token" })
    );
    setTimeout(() => ws.close(), 100);
    return;
  }

  users.push({
    userId,
    rooms: [],
    ws,
  });

  ws.on("message", async function message(data) {
    const parsedData = JSON.parse(data as unknown as string);
    if (parsedData.type === "join_room") {
      const user = users.find((x) => x.ws === ws);
      user?.rooms.push(parsedData.roomId);
      ws.send(
        JSON.stringify({ message: `You have joined room ${parsedData.roomId}` })
      );

      // Get usernames for all users in this room
      const roomUsers = await Promise.all(
        users
          .filter((u) => u.rooms.includes(parsedData.roomId))
          .map(async (u) => {
            const userInfo = await prismaClient.user.findUnique({
              where: { id: u.userId },
              select: { username: true },
            });
            return userInfo?.username;
          })
      );

      // Broadcast to all users in the room
      users.forEach((u) => {
        if (u.rooms.includes(parsedData.roomId)) {
          u.ws.send(
            JSON.stringify({
              type: "room_users",
              users: roomUsers,
            })
          );
        }
      });
    }
    if (parsedData.type === "leave_room") {
      const user = users.find((x) => x.ws === ws);
      if (!user) {
        return;
      }
      user.rooms = user.rooms.filter((x) => x !== parsedData.roomId);
      ws.send(
        JSON.stringify({ message: `You have left room ${parsedData.roomId}` })
      );
      // Get usernames for remaining users in the room
      const roomUsers = await Promise.all(
        users
          .filter((u) => u.rooms.includes(parsedData.roomId))
          .map(async (u) => {
            const userInfo = await prismaClient.user.findUnique({
              where: { id: u.userId },
              select: { username: true },
            });
            return userInfo?.username;
          })
      );

      // Broadcast updated user list to remaining users in the room
      users.forEach((u) => {
        if (u.rooms.includes(parsedData.roomId)) {
          u.ws.send(
            JSON.stringify({
              type: "room_users",
              users: roomUsers,
            })
          );
        }
      });
    }
    if (parsedData.type === "chat") {
      const roomId = parsedData.roomId;
      const message = parsedData.message;
      const parsedMessage = JSON.parse(message);

      const userExists = await prismaClient.user.findUnique({
        where: {
          id: userId,
        },
      });

      if (!userExists) {
        ws.send(JSON.stringify({ message: "User not found" }));
        return;
      }

      const isUserInRoom = users.some(
        (user) => user.userId === userId && user.rooms.includes(roomId)
      );
      if (!isUserInRoom) {
        ws.send(JSON.stringify({ message: "Unauthorized, wrong room" }));
        setTimeout(() => ws.close(), 100);
        return;
      }

      await prismaClient.chat.create({
        data: {
          roomId,
          message: JSON.stringify(parsedMessage.shape),
          userId,
          id: parsedMessage.id,
        },
      });

      users.forEach((user) => {
        if (user.rooms.includes(roomId) && user.ws !== ws) {
          user.ws.send(
            JSON.stringify({
              type: "chat",
              message,
              roomId,
            })
          );
        }
      });
    }
    if (parsedData.type === "delete_message") {
      const roomId = parsedData.roomId;
      const messageId = parsedData.messageId;

      await prismaClient.chat.delete({
        where: {
          id: messageId,
          roomId: roomId,
        },
      });

      // Notify other users in the room about deletion
      users.forEach((user) => {
        if (user.rooms.includes(roomId) && user.ws !== ws) {
          user.ws.send(
            JSON.stringify({
              type: "delete_message",
              messageId,
              roomId,
            })
          );
        }
      });
    }
  });
});
