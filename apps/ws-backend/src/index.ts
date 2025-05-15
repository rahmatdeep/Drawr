import { WebSocket, WebSocketServer } from "ws";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { prismaClient } from "@repo/db/client";
const wss = new WebSocketServer({ port: 8080 });

interface User {
  ws: WebSocket;
  rooms: string[];
  userId: string;
  isInCall: boolean;
  isMuted: boolean;
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
    isInCall: false,
    isMuted: false,
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
            return {
              username: userInfo?.username,
              userId: u.userId,
              isInCall: u.isInCall,
              isMuted: u.isMuted,
            };
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
    } else if (parsedData.type === "leave_room") {
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
            return {
              username: userInfo?.username,
              userId: u.userId,
              isInCall: u.isInCall,
              isMuted: u.isMuted,
            };
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

      // If user was in call, notify others that they left the call
      if (user.isInCall) {
        user.isInCall = false;
        users.forEach((u) => {
          if (u.rooms.includes(parsedData.roomId) && u.isInCall) {
            u.ws.send(
              JSON.stringify({
                type: "user_left_call",
                userId: user.userId,
                roomId: parsedData.roomId,
              })
            );
          }
        });
      }
    } else if (parsedData.type === "chat") {
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
    } else if (parsedData.type === "delete_message") {
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
    // WebRTC Voice Call related message types
    else if (parsedData.type === "join_call") {
      const roomId = parsedData.roomId;
      const user = users.find((x) => x.ws === ws);
      if (!user) return;

      // Update user status
      user.isInCall = true;
      user.isMuted = parsedData.isMuted || false;

      // Send the current call participants to the user who just joined
      const callParticipants = users.filter(
        (u) =>
          u.rooms.includes(roomId) && u.isInCall && u.userId !== user.userId
      );

      ws.send(
        JSON.stringify({
          type: "call_participants",
          participants: await Promise.all(
            callParticipants.map(async (u) => {
              const userInfo = await prismaClient.user.findUnique({
                where: { id: u.userId },
                select: { username: true },
              });
              return {
                userId: u.userId,
                username: userInfo?.username,
                isMuted: u.isMuted,
              };
            })
          ),
          roomId,
        })
      );

      // Notify all users in the room about the new call participant
      const userInfo = await prismaClient.user.findUnique({
        where: { id: user.userId },
        select: { username: true },
      });

      users.forEach((u) => {
        if (u.rooms.includes(roomId) && u.ws !== ws) {
          u.ws.send(
            JSON.stringify({
              type: "user_joined_call",
              user: {
                userId: user.userId,
                username: userInfo?.username,
                isMuted: user.isMuted,
              },
              roomId,
            })
          );
        }
      });

      // Update room users list for everyone
      const roomUsers = await Promise.all(
        users
          .filter((u) => u.rooms.includes(roomId))
          .map(async (u) => {
            const info = await prismaClient.user.findUnique({
              where: { id: u.userId },
              select: { username: true },
            });
            return {
              username: info?.username,
              userId: u.userId,
              isInCall: u.isInCall,
              isMuted: u.isMuted,
            };
          })
      );

      users.forEach((u) => {
        if (u.rooms.includes(roomId)) {
          u.ws.send(
            JSON.stringify({
              type: "room_users",
              users: roomUsers,
            })
          );
        }
      });
    } else if (parsedData.type === "leave_call") {
      const roomId = parsedData.roomId;
      const user = users.find((x) => x.ws === ws);
      if (!user) return;

      // Update user status
      user.isInCall = false;

      // Notify all users in the call about this user leaving
      users.forEach((u) => {
        if (u.rooms.includes(roomId) && u.isInCall && u.ws !== ws) {
          u.ws.send(
            JSON.stringify({
              type: "user_left_call",
              userId: user.userId,
              roomId,
            })
          );
        }
      });

      // Update room users list
      const roomUsers = await Promise.all(
        users
          .filter((u) => u.rooms.includes(roomId))
          .map(async (u) => {
            const info = await prismaClient.user.findUnique({
              where: { id: u.userId },
              select: { username: true },
            });
            return {
              username: info?.username,
              userId: u.userId,
              isInCall: u.isInCall,
              isMuted: u.isMuted,
            };
          })
      );

      users.forEach((u) => {
        if (u.rooms.includes(roomId)) {
          u.ws.send(
            JSON.stringify({
              type: "room_users",
              users: roomUsers,
            })
          );
        }
      });
    } else if (parsedData.type === "toggle_mute") {
      const roomId = parsedData.roomId;
      const isMuted = parsedData.isMuted;
      const user = users.find((x) => x.ws === ws);
      if (!user || !user.isInCall) return;

      // Update user mute status
      user.isMuted = isMuted;

      // Notify all users in the call about the mute status change
      users.forEach((u) => {
        if (u.rooms.includes(roomId) && u.isInCall) {
          u.ws.send(
            JSON.stringify({
              type: "user_mute_changed",
              userId: user.userId,
              isMuted,
              roomId,
            })
          );
        }
      });

      // Update room users list
      const roomUsers = await Promise.all(
        users
          .filter((u) => u.rooms.includes(roomId))
          .map(async (u) => {
            const info = await prismaClient.user.findUnique({
              where: { id: u.userId },
              select: { username: true },
            });
            return {
              username: info?.username,
              userId: u.userId,
              isInCall: u.isInCall,
              isMuted: u.isMuted,
            };
          })
      );

      users.forEach((u) => {
        if (u.rooms.includes(roomId)) {
          u.ws.send(
            JSON.stringify({
              type: "room_users",
              users: roomUsers,
            })
          );
        }
      });
    }
    // WebRTC signaling
    else if (parsedData.type === "webrtc_offer") {
      const { roomId, offer, targetUserId } = parsedData;
      const targetUser = users.find(
        (u) =>
          u.userId === targetUserId && u.rooms.includes(roomId) && u.isInCall
      );

      if (targetUser) {
        targetUser.ws.send(
          JSON.stringify({
            type: "webrtc_offer",
            offer,
            fromUserId: userId,
            roomId,
          })
        );
      }
    } else if (parsedData.type === "webrtc_answer") {
      const { roomId, answer, targetUserId } = parsedData;
      const targetUser = users.find(
        (u) =>
          u.userId === targetUserId && u.rooms.includes(roomId) && u.isInCall
      );

      if (targetUser) {
        targetUser.ws.send(
          JSON.stringify({
            type: "webrtc_answer",
            answer,
            fromUserId: userId,
            roomId,
          })
        );
      }
    } else if (parsedData.type === "webrtc_ice_candidate") {
      const { roomId, candidate, targetUserId } = parsedData;
      const targetUser = users.find(
        (u) =>
          u.userId === targetUserId && u.rooms.includes(roomId) && u.isInCall
      );

      if (targetUser) {
        targetUser.ws.send(
          JSON.stringify({
            type: "webrtc_ice_candidate",
            candidate,
            fromUserId: userId,
            roomId,
          })
        );
      }
    }
  });

  // Handle disconnections
  ws.on("close", async () => {
    const userIndex = users.findIndex((x) => x.ws === ws);
    if (userIndex === -1) return;

    const user = users[userIndex];
    const userRooms = [...user!.rooms];

    // For each room the user was in
    for (const roomId of userRooms) {
      // If user was in a call, notify others
      if (user?.isInCall) {
        users.forEach((u) => {
          if (u.rooms.includes(roomId) && u.isInCall && u.ws !== ws) {
            u.ws.send(
              JSON.stringify({
                type: "user_left_call",
                userId: user?.userId,
                roomId,
              })
            );
          }
        });
      }

      // Update room users list for the room
      const roomUsers = await Promise.all(
        users
          .filter((u) => u.userId !== user?.userId && u.rooms.includes(roomId))
          .map(async (u) => {
            const info = await prismaClient.user.findUnique({
              where: { id: u.userId },
              select: { username: true },
            });
            return {
              username: info?.username,
              userId: u.userId,
              isInCall: u.isInCall,
              isMuted: u.isMuted,
            };
          })
      );

      // Broadcast updated user list
      users.forEach((u) => {
        if (u.userId !== user?.userId && u.rooms.includes(roomId)) {
          u.ws.send(
            JSON.stringify({
              type: "room_users",
              users: roomUsers,
            })
          );
        }
      });
    }

    // Remove the user from the users array
    users.splice(userIndex, 1);
  });
});