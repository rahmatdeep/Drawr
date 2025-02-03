import { useEffect, useRef, useState } from "react";
import { WS_URL } from "../app/config";

export function useSocket() {
  const [loading, setLoading] = useState(true);
  // const [socket, setSocket] = useState<WebSocket>();
  const socket = useRef<WebSocket | null>(null);
  console.log("useSocket");
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      setLoading(false);
      socket.current = ws;
    };
    ws.onclose = () => {
      setLoading(true);
      socket.current = null;
    };
    ws.onerror = (error) => {
      console.error("Websocket error:", error);
      setLoading(true);
    };
    return () => {
      console.log("closed");
      ws.close();
      socket.current = null;
    };
  }, []);

  return {
    socket: socket.current,
    loading,
  };
}
