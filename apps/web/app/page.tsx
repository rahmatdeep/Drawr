"use client";
import { useRef } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const slug = useRef<string | null>(null);
  const router = useRouter();

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        width: "100vw",
      }}
    >
      <div>
        <input
          onChange={(e) => (slug.current = e.target.value)}
          type="text"
          placeholder="Room slug"
          style={{ padding: 10 }}
        />

        <button
          onClick={() => {
            router.push(`/room/${slug.current}`);
          }}
          style={{ padding: 10 }}
        >
          Join room
        </button>
      </div>
    </div>
  );
}
