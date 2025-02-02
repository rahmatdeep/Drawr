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
    ws.send("Unauthorized");
    setTimeout(() => ws.close(), 100);
    return;
  }
  const queryParams = new URLSearchParams(url.split("?")[1]);
  const token = queryParams.get("token");
  if (!token) {
    ws.send("Unauthorized");
    setTimeout(() => ws.close(), 100);
    return;
  }
  const userId = checkUser(token);
  if (!userId) {
    ws.send("Unauthorized");
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
    }
    if (parsedData.type === "leave_room") {
      const user = users.find((x) => x.ws === ws);
      if (!user) {
        return;
      }
      user.rooms = user.rooms.filter((x) => x !== parsedData.roomId);
    }
    if (parsedData.type === "chat") {
      const roomId = parsedData.roomId;
      const message = parsedData.message;
      const isUserInRoom = users.some(
        (user) => user.userId === userId && user.rooms.includes(roomId)
      );
      if (!isUserInRoom) {
        ws.send("Unauthorized");
        setTimeout(() => ws.close(), 100);
        return;
      }

      await prismaClient.chat.create({
        data: {
          roomId,
          message,
          userId,
        },
      });

      users.forEach((user) => {
        if (user.rooms.includes(roomId)) {
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
  });
});
