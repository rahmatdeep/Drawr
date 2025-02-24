import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { RoomCanvasComponent } from "@/components/RoomCanvasComponent";
import { HTTP_BACKEND } from "@/config";
import axios from "axios";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

async function getRoom(slug: string, token: string) {
  const roomResponse = await axios.get(`${HTTP_BACKEND}/room/${slug}`, {
    headers: { Authorization: `${token}` },
  });
  return roomResponse.data.room.id;
}

export default async function Canvas({
  params,
}: {
  params: {
    slug: string;
  };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    redirect("/signin");
  }
  const slug = (await params).slug;
  const roomId = await getRoom(slug, session?.accessToken);
  return <RoomCanvasComponent token={session?.accessToken} roomId={roomId} />;
}
