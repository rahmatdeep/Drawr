import { HTTP_BACKEND } from "@/config";
import axios from "axios";

export async function getExistingShapes(roomId: string) {
  const res = await axios.get(`${HTTP_BACKEND}/chats/${roomId}`);
  const data = res.data.messages;

  const shapes = data.map((x: { id: number; message: string }) => {
    const id = x.id;
    const shape = JSON.parse(x.message);
    return { id, shape };
  });

  return shapes;
}
