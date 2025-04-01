"use client";

import axios from "axios";
import { HTTP_BACKEND } from "@/config";
import { ChevronRightIcon, LogOutIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";

type RoomCardProps = {
  room: {
    id: number;
    slug: string;
    createdAt: string;
    adminId: string;
  };
  isAdmin: boolean;
  token: string;
};

const formatRoomName = (slug: string): string => {
  return slug.replace(/_+/g, " ").trim();
};
export function RoomCard({ room, isAdmin, token }: RoomCardProps) {
  const router = useRouter();
  const handleDeleteRoom = async () => {
    try {
      await axios.delete(`${HTTP_BACKEND}/room`, {
        headers: { Authorization: token },
        data: { roomId: room.id.toString() },
      });
      router.refresh();
    } catch (error) {
      console.error("Failed to delete room:", error);
    }
  };

  const handleLeaveRoom = async () => {
    try {
      await axios.delete(`${HTTP_BACKEND}/rooms`, {
        headers: { Authorization: token },
        data: { roomId: room.id.toString() },
      });
      router.refresh();
    } catch (error) {
      console.error("Failed to leave room:", error);
    }
  };

  // Format the room name for display
  const displayName = formatRoomName(room.slug);
  return (
    <div
      className="group relative p-6 bg-gray-900/50 rounded-xl border border-gray-700/50 
                    hover:bg-gray-800/50 transition-all duration-300 
                    hover:border-white/20 hover:scale-[1.02]"
    >
      <a href={`/canvas/${room.slug}`}>
        <h3 className="text-xl font-medium text-white mb-2">{displayName}</h3>
        <p className="text-sm text-gray-400">
          Created on {new Date(room.createdAt).toLocaleDateString()}
          <span className="mt-4 flex items-center text-white text-sm font-medium">
            Enter Room
            <ChevronRightIcon className="ml-2 w-4 h-4 transform transition-transform group-hover:translate-x-1" />
          </span>
        </p>
      </a>
      <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
        {isAdmin ? (
          <button
            onClick={handleDeleteRoom}
            className="text-red-400 hover:text-red-300 transition-colors"
          >
            <Trash2Icon />
          </button>
        ) : (
          <button
            onClick={handleLeaveRoom}
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            <LogOutIcon />
          </button>
        )}
      </div>
    </div>
  );
}