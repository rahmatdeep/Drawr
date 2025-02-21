import { HTTP_BACKEND } from "@/config";
import axios from "axios";

export async function getExsistingShapes(roomId: string) {
    const res = await axios.get(`${HTTP_BACKEND}/chats/${roomId}`);
    const data = res.data.messages;
  
    const shapes = data.map((x: { message: string }) => {
      const messageData = JSON.parse(x.message);
      return messageData;
    });
  
    return shapes;
  }
  