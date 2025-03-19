import { redirect } from "next/navigation";
import { RoomForm } from "@/components/RoomForm";
import { HTTP_BACKEND } from "@/config";
import { Header } from "@/components/Header";
import axios from "axios";
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/options";
import { RoomCard } from "@/components/RoomCard";

type Room = {
  room: {
    id: number;
    slug: string;
    createdAt: string;
    adminId: string;
  };
};

async function getRooms(token: string) {
  const response = await axios.get(`${HTTP_BACKEND}/rooms`, {
    headers: {
      Authorization: `${token}`,
    },
  });
  return response.data as Room[];
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const username =
    session?.provider === "google"
      ? session.user.name
      : session?.user.email.split("@")[0];
  const usernameCapitalized =
    username && username.charAt(0).toUpperCase() + username.slice(1);

  if (!session?.accessToken) {
    redirect("/signin");
  }

  const rooms = await getRooms(session?.accessToken);

  return (
    <div className="min-h-screen bg-black">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <RoomForm token={session?.accessToken} />

        <div className="mt-16">
          <h2 className="text-2xl font-semibold text-white mb-8">
            Hello {usernameCapitalized}! Here are the rooms you&apos;ve joined.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map(
              ({ room }) =>
                session.accessToken && (
                  <RoomCard
                    key={room.id}
                    room={room}
                    isAdmin={room.adminId === session?.userId}
                    token={session?.accessToken}
                  />
                )
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
