"use client";

import { WS_BACKEND } from "@/config";
import { useEffect, useState } from "react";
import { CanvasComponent } from "./CanvasComponent";
// import { UserAvatar } from "./AvatarComponent";
import { WSLoader } from "./WSLoader";

export function RoomCanvasComponent({
  roomId,
  token,
  currentUserId,
}: {
  roomId: string;
  token: string;
  currentUserId: string;
}) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const wsUrl = `${WS_BACKEND}?token=${token}`;
  //   const [roomUsers, setRoomUsers] = useState<string[]>([]);
  useEffect(() => {
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setSocket(ws);
      ws.send(
        JSON.stringify({
          type: "join_room",
          roomId: Number(roomId),
        })
      );
    };

    // ws.onmessage = (event) => {
    //   const data = JSON.parse(event.data);
    //   if (data.type === "room_users") {
    //     setRoomUsers(data.users);
    //   }
    // };

    // Listen for beforeunload event
    const handleBeforeUnload = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "leave_room",
            roomId: Number(roomId),
          })
        );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      ws.close();
    };
  }, [roomId, wsUrl]);

  if (!socket) {
    return <WSLoader />;
  }

  return (
    <div className="relative">
      {/* <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-10">
        {roomUsers.map((username) => (
          <div key={username} className="group relative">
            <UserAvatar name={username} size="sm" />
          </div>
        ))}
      </div> */}
      <CanvasComponent
        roomId={roomId}
        socket={socket}
        currentUserId={currentUserId}
      />
    </div>
  );
}
