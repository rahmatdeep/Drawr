"use client";
import { ReactNode } from "react";

export function IconButton({
  icon,
  onClick,
  isActivated,
  keybind,
  title,
}: {
  icon: ReactNode;
  onClick: () => void;
  isActivated?: boolean;
  keybind?: string;
  title?: string;
}) {
  return (
    <div
      className={`
        p-2.5 
        rounded-xl 
        cursor-pointer 
        transition-all 
        duration-200 
        transform 
        hover:scale-110
        active:scale-95
        ${
          isActivated
            ? "bg-white/20 text-white ring-2 ring-white/30 shadow-sm shadow-white/20"
            : "bg-black/30 text-gray-300 hover:text-white hover:bg-white/10 hover:shadow-lg hover:shadow-white/10"
        }
      `}
      onClick={onClick}
      title={title}
    >
      {icon}
      {keybind && (
        <span className="absolute bottom-1 right-1 text-[10px] text-white/50">
          {keybind}
        </span>
      )}
    </div>
  );
}
