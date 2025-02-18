"use client";

import { WS_BACKEND } from "@/config";
import { useEffect, useState } from "react";
import { CanvasComponent } from "./CanvasComponent";

export function RoomCanvasComponent({ roomId }: { roomId: string }) {
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_BACKEND);

    ws.onopen = () => {
      setSocket(ws);
      ws.send(
        JSON.stringify({
          type: "join_room",
          roomId: Number(roomId),
        })
      );
    };
  }, []);

  if (!socket) {
    return <div>Connecting to server</div>;
  }

  return (
    <div>
      <CanvasComponent roomId={roomId} socket={socket} />
    </div>
  );
}
