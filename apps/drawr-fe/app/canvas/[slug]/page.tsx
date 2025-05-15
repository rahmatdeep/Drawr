import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { RoomCanvasComponent } from "@/components/RoomCanvasComponent";
import { HTTP_BACKEND } from "@/config";
import axios from "axios";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

async function getRoom(slug: string, token: string) {
  try {
    // First check if the room exists
    const roomResponse = await axios.get(`${HTTP_BACKEND}/room/${slug}`, {
      headers: { Authorization: `${token}` },
    });

    // Check if room exists in the response
    if (!roomResponse.data.room) {
      throw new Error("Room not found");
    }

    const roomId = roomResponse.data.room.id;

    // Then check if the user is in the room
    const checkInRoom = await axios.get(`${HTTP_BACKEND}/rooms`, {
      headers: {
        Authorization: `${token}`,
      },
    });

    const exists = checkInRoom.data.some(
      ({ room }: { room: { slug: string } }) => room.slug === slug
    );

    if (!exists) {
      // If the user is not in the room, add them
      await axios.post(
        `${HTTP_BACKEND}/rooms`,
        { roomId: roomId.toString() },
        {
          headers: { Authorization: `${token}` },
        }
      );
    }

    return roomId;
  } catch (error) {
    console.error("Error in getRoom:", error);
    throw error;
  }
}

type PageProps = {
  params: Promise<{ slug: string }> & { slug: string };
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> & {
    [key: string]: string | string[] | undefined;
  };
};

export default async function Canvas({ params, searchParams }: PageProps) {
  const slug = (await params).slug;
  const isGuestMode = (await searchParams)?.guest === "true";
  const shouldConvert = (await searchParams)?.convert === "true";

  const session = await getServerSession(authOptions);

  // If not guest mode and not authenticated, redirect to signin
  if (!isGuestMode && !session?.accessToken) {
    redirect("/");
  }

  const isGuestRoom = slug.startsWith("guest-");

  // If it's a guest room and the user is authenticated
  if (isGuestRoom && session?.accessToken && (shouldConvert || !isGuestMode)) {
    const guestId = slug.replace("guest-", "");

    try {
      // Convert the guest room
      await axios.post(
        `${HTTP_BACKEND}/convert-guest-room`,
        { guestId },
        { headers: { Authorization: session.accessToken } }
      );

      // After conversion, try to get the room
      try {
        const roomId = await getRoom(slug, session.accessToken);
        return (
          <RoomCanvasComponent token={session.accessToken} roomId={roomId} />
        );
      } catch (error) {
        console.error("Error getting room after conversion:", error);
        redirect("/dashboard");
      }
    } catch (error) {
      console.error("Error converting guest room:", error);
      redirect("/dashboard");
    }
  }

  // For guest mode, we don't need to get a room from the server
  if (isGuestMode) {
    return <RoomCanvasComponent roomId={slug} isGuestMode={true} />;
  }

  if (!session?.accessToken) {
    redirect("/");
  }

  try {
    const roomId = await getRoom(slug, session?.accessToken);
    return (
      <RoomCanvasComponent
        token={session?.accessToken}
        roomId={roomId}
        userId={session.userId}
      />
    );
  } catch (error) {
    console.error("Error getting room:", error);
    redirect("/dashboard");
  }
}