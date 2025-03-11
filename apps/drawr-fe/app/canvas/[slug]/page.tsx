import { RoomCanvasComponent } from "@/components/RoomCanvasComponent";
import { HTTP_BACKEND } from "@/config";
import { authOptions } from "@/lib/auth";
import axios from "axios";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

async function getRoom(slug: string, token: string) {
  const checkInRoom = await axios.get(`${HTTP_BACKEND}/rooms`, {
    headers: {
      Authorization: `${token}`,
    },
  });
  const exists = checkInRoom.data.some(
    ({ room }: { room: { slug: string } }) => room.slug === slug
  );
  const roomResponse = await axios.get(`${HTTP_BACKEND}/room/${slug}`, {
    headers: { Authorization: `${token}` },
  });
  const roomId = roomResponse.data.room.id;
  if (!exists) {
    await axios.post(
      `${HTTP_BACKEND}/rooms`,
      { roomId: roomId.toString() },
      {
        headers: { Authorization: `${token}` },
      }
    );
  }
  return roomId;
}

export default async function Canvas({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    redirect("/signin");
  }
  const { slug } = await params;
  const roomId = await getRoom(slug, session?.accessToken);
  return <RoomCanvasComponent token={session?.accessToken} roomId={roomId} />;
}
