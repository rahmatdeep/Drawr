"use client";
import { ReactNode } from "react";

export function IconButton({
  icon,
  onClick,
  isActivated,
}: {
  icon: ReactNode;
  onClick: () => void;
  isActivated: boolean;
}) {
  return (
    <div
      className={`rounded-full cursor-pointer border p-2 bg-black hover:bg-gray-800 ${isActivated ? `text-red-800` : `text-white`}`}
      onClick={onClick}
    >
      {icon}
    </div>
  );
}
