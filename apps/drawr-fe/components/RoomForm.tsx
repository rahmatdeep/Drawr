"use client";

import { useRef, useState, useTransition } from "react";
import { handleRoom } from "@/actions/room.action";
import { useRouter } from "next/navigation";
// import { Toast } from "@repo/ui/Toast";

export function RoomForm({ token }: { token: string }) {
  const [isJoiningPending, startJoiningTransition] = useTransition();
  const [isCreatingPending, startCreatingTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const roomNameRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  return (
    <div className="w-full max-w-2xl mx-auto mt-8">
      {/* <div className="w-full max-w-2xl mx-auto mt-8">
      {error && (
        <Toast 
          message={error} 
          type="error" 
          onClose={() => setError(null)} 
        />
      )} */}
      <form
        action={async (formData: FormData) => {
          let roomName = formData.get("roomName") as string;
          // Trim whitespace, normalize spaces, then replace with underscores
          roomName = roomName.trim().replace(/\s+/g, " ").replace(/\s/g, "_");
          const type = formData.get("type") as string;
          setError(null);
          if (type === "join") {
            startJoiningTransition(async () => {
              const error = await handleRoom(token, roomName, type);
              if (!error) {
                router.push(`canvas/${roomName}`);
              } else {
                roomNameRef.current?.focus();
                setError(error);
              }
            });
          } else if (type === "create") {
            startCreatingTransition(async () => {
              const error = await handleRoom(token, roomName, type);
              if (!error) {
                router.push(`canvas/${roomName}`);
              } else {
                roomNameRef.current?.focus();
                setError(error);
              }
            });
          }
        }}
        className="relative group"
      >
        <div className="relative flex flex-col items-center gap-2">
          <div className="w-full">
            <input
              type="text"
              name="roomName"
              placeholder="Enter a room name to join or create a new one"
              className={`w-full px-6 py-4 text-lg bg-gray-900/50 border-2 rounded-xl 
                focus:outline-none ${error ? "border-red-600 focus:border-red-600" : "border-gray-700 focus:border-white"} transition-all duration-300
                text-white caret-white`}
              required
              autoFocus
              onChange={() => setError(null)}
              ref={roomNameRef}
            />
            {error && (
              <p className="text-red-500 text-sm mt-2 ml-2 animate-fadeIn">
                {error}
              </p>
            )}
          </div>
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
