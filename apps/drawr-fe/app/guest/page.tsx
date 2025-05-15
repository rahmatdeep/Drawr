"use client";

import { useEffect } from "react";
import { getOrCreateGuestUser } from "@/utils/guestUser";
// import { RoomCanvasComponent } from "@/components/RoomCanvasComponent";
import { useRouter } from "next/navigation";
// import { generateId } from "@/utils/generateId";

export default function GuestCanvas() {
  const router = useRouter();

  useEffect(() => {
    // Create or get guest user
    const guestUser = getOrCreateGuestUser();

    // Generate a unique room ID for this guest session
    const guestRoomId = `guest-${guestUser.id}`;

    // Redirect to the canvas page with guest mode enabled
    router.push(`/canvas/${guestRoomId}?guest=true`);
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-white">Preparing guest canvas...</div>
    </div>
  );
}