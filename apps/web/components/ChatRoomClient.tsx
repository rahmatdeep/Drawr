"use client";

import { useEffect, useRef, useState } from "react";
import { useSocket } from "../hooks/useSocket";

export function ChatRoomClient({
  messages,
  id,
}: {
  messages: { message: string }[];
  id: string;
}) {
  const [chats, setChats] = useState(messages);
  const { socket, loading } = useSocket();
  const currentMessageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (socket && !loading) {
      socket.send(
        JSON.stringify({
          type: "join_room",
          roomId: Number(id),
        })
      );
      const handleMessage = (event: MessageEvent) => {
        try {
          const parsedData = JSON.parse(event.data);
          if (parsedData.type === "chat") {
            setChats((c) => [...c, { message: parsedData.message }]);
          }
        } catch (e) {
          console.error("Failed to parse Websocket message:", e);
        }
      };
      socket.addEventListener("message", handleMessage);

      return () => {
        socket.removeEventListener("message", handleMessage);
      };
    }
  }, [socket, loading, id]);

  const sendMessage = (): void => {
    const roomId = Number(id);
    if (currentMessageRef.current) {
      const message = currentMessageRef.current?.value;
      if (message && socket) {
        socket?.send(
          JSON.stringify({
            type: "chat",
            message,
            roomId,
          })
        );
        currentMessageRef.current.value = "";
      }
    }
  };

  return (
    <div>
      {chats.map((m) => (
        <div>{m.message}</div>
      ))}
      <input type="text" placeholder="message" ref={currentMessageRef} />
      <button onClick={sendMessage}>Send Message</button>
    </div>
  );
}
