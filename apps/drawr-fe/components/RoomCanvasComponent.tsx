"use client";

import { WS_BACKEND, HTTP_BACKEND } from "@/config";
import { useEffect, useState } from "react";
import { CanvasComponent } from "./CanvasComponent";
import { UserAvatar } from "./AvatarComponent";
import { WSLoader } from "./WSLoader";
import { VoiceCallComponent } from "./VoiceCallComponent";
import {
  getOrCreateGuestUser,
  GuestUser,
  exportDrawingsFromLocalStorage,
  clearAllGuestData,
} from "@/utils/guestUser";
import axios from "axios";
import { useSearchParams } from "next/navigation";

interface RoomUser {
  username: string;
  userId: string;
  isInCall?: boolean;
  isMuted?: boolean;
}

export function RoomCanvasComponent({
  roomId,
  token,
  isGuestMode = false,
  userId,
}: {
  roomId: string;
  token?: string;
  isGuestMode?: boolean;
  userId?: string;
}) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const wsUrl = `${WS_BACKEND}?token=${token}`;
  const [roomUsers, setRoomUsers] = useState<RoomUser[]>([]);
  const [guestUser, setGuestUser] = useState<GuestUser | null>(null);
  const searchParams = useSearchParams();
  const shouldConvert = searchParams?.get("convert") === "true";
  const [isImporting, setIsImporting] = useState(shouldConvert);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Handle drawing import if needed
  useEffect(() => {
    const importDrawings = async () => {
      if (!token || !shouldConvert) {
        setIsImporting(false);
        return;
      }

      try {
        // Get drawings from local storage
        const drawings = exportDrawingsFromLocalStorage();

        if (drawings && drawings.length > 0) {
          // Import drawings to the room
          await axios.post(
            `${HTTP_BACKEND}/import-guest-drawings`,
            {
              roomId,
              drawings,
            },
            { headers: { Authorization: token } }
          );

          // Clear guest data after successful import
          clearAllGuestData();
        }

        setIsImporting(false);
      } catch (error) {
        console.error("Error importing guest drawings:", error);
        setIsImporting(false);
      }
    };

    // Only run the import once when the component mounts
    if (isImporting) {
      importDrawings();
    }
  }, [token, roomId, shouldConvert, isImporting]);

  useEffect(() => {
    if (isGuestMode) {
      // For guest mode, we don't need a real WebSocket connection
      const user = getOrCreateGuestUser();
      setGuestUser(user);
      // Convert user.id to string to match RoomUser interface
      setRoomUsers([{ username: user.username, userId: String(user.id) }]);
      setCurrentUserId(String(user.id));
      return;
    }
    // For non-guest mode, we need to set the userId immediately
    if (userId) {
      setCurrentUserId(userId);
    }

    if (!token) {
      console.error("No token available for WebSocket connection");
      return;
    }

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setSocket(ws);
      ws.send(
        JSON.stringify({
          type: "join_room",
          roomId: Number(roomId),
        })
      );
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "room_users") {
        // Process room users with call status information
        if (data.users && Array.isArray(data.users)) {
          // Explicitly type the filtered users as RoomUser[]
          const uniqueUsers = [
            ...new Set(
              data.users.filter((user: RoomUser) => user && user.username)
            ),
          ] as RoomUser[];
          setRoomUsers(uniqueUsers);
        }
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    // Listen for beforeunload event
    const handleBeforeUnload = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "leave_room",
            roomId: Number(roomId),
          })
        );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      ws.close();
    };
  }, [roomId, wsUrl, isGuestMode, token, userId]);

  if (isImporting) {
    return <WSLoader message="Importing your drawings..." />;
  }

  if (!socket && !isGuestMode) {
    return <WSLoader />;
  }

  return (
    <div className="relative h-screen w-full">
      {/* Canvas component as the base layer */}
      <CanvasComponent
        roomId={roomId}
        socket={socket}
        isGuestMode={isGuestMode}
        guestUser={isGuestMode ? guestUser : null}
      />

      {/* Overlay elements positioned with absolute */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Voice call component - positioned at the top right */}
        {!isGuestMode && currentUserId && socket && (
          <div className="absolute top-24 right-0 z-20 pointer-events-auto">
            <VoiceCallComponent
              roomId={roomId}
              socket={socket}
              currentUserId={currentUserId}
            />
          </div>
        )}

        {/* User avatars - positioned at the bottom right */}
        <div className="absolute bottom-4 right-4 flex flex-col-reverse gap-2 z-10 pointer-events-auto">
          {roomUsers.map((user, index) => (
            <div key={`${user.username}-${index}`} className="group relative">
              <UserAvatar name={user.username} size="sm" />
              {user.isInCall && (
                <div
                  className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${user.isMuted ? "bg-red-500" : "bg-green-500"}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
