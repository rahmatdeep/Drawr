"use client";

import { useTransition } from "react";
import { handleRoom } from "@/actions/room.action";
import { useRouter } from "next/navigation";

export function RoomForm({ token }: { token: string }) {
  //   const [isPending, startTransition] = useTransition();
  const [isJoiningPending, startJoiningTransition] = useTransition();
  const [isCreatingPending, startCreatingTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="w-full max-w-2xl mx-auto mt-8">
      <form
        action={async (formData: FormData) => {
          const roomName = formData.get("roomName") as string;
          const type = formData.get("type") as string;
          //   startTransition(async () => {
          //     await handleRoom(token, roomName, type);
          //   });
          if (type === "join") {
            startJoiningTransition(async () => {
              const roomSlug = await handleRoom(token, roomName, type);
              router.push(`canvas/${roomSlug}`);
            });
          } else {
            startCreatingTransition(async () => {
              const roomSlug = await handleRoom(token, roomName, type);
              router.push(`canvas/${roomSlug}`);
            });
          }
        }}
        className="relative group"
      >
        <div className="relative flex flex-col items-center gap-2">
          <input
            type="text"
            name="roomName"
            placeholder="Enter a room name to join or create a new one"
            className="w-full px-6 py-4 text-lg bg-gray-900/50 border-2 border-gray-700 rounded-xl 
                     focus:outline-none focus:border-white transition-all duration-300
                     placeholder:text-gray-500 text-white caret-white"
            required
            autoFocus
          />
          <div className="flex items-center gap-4 mt-3">
            <button
              name="type"
              value="join"
              disabled={isJoiningPending}
              className="px-6 py-2 bg-gray-800 text-white rounded-md
                     transform transition-all duration-300 hover:scale-105
                     hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-white
                     disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isJoiningPending ? "Joining..." : "Join Room"}
            </button>
            <button
              name="type"
              value="create"
              disabled={isCreatingPending}
              className="px-6 py-2 bg-white text-black rounded-md
                     transform transition-all duration-300 hover:scale-105
                     hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-white
                     disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isCreatingPending ? "Creating..." : "Create Room"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
