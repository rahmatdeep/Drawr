import { WebSocket, WebSocketServer } from "ws";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
const wss = new WebSocketServer({ port: 8080 });

function checkUser(token: string, ws: WebSocket): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (!decoded.userId) {
      ws.send("Unauthorized");
      setTimeout(() => ws.close(), 100);
      return null;
    } else {
      return decoded.userId;
    }
  } catch {
    ws.send("Unauthorized");
    setTimeout(() => ws.close(), 100);
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

  const userId = checkUser(token, ws);

  if (!userId) {
    ws.send("Unauthorized");
    setTimeout(() => ws.close(), 100);
    return;
  }

  

  ws.on("message", function message(data) {
    ws.send("pong");
  });
});
