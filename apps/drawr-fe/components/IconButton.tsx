"use client";
import { ReactNode } from "react";

export function IconButton({
  icon,
  onClick,
  isActivated,
  keybind,
  title,
  disabled,
}: {
  icon: ReactNode;
  onClick: () => void;
  isActivated?: boolean;
  keybind?: string;
  title?: string;
  disabled?: boolean;
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
        relative
        group
        ${
          isActivated
            ? "bg-white/20 text-white ring-2 ring-white/30 shadow-sm shadow-white/20"
            : "bg-black/30 text-gray-300 hover:text-white hover:bg-white/10 hover:shadow-lg hover:shadow-white/10"
        }
          ${disabled ? "opacity-30 cursor-not-allowed" : ""}
      `}
      onClick={onClick}
      title={title}
      style={{ pointerEvents: disabled ? "none" : "auto" }}
    >
      {icon}
      {keybind && (
        <span
          className={`
            absolute bottom-0 right-0 text-[10px] text-white/50
            transition-opacity duration-200
            ${isActivated ? "opacity-0" : "group-hover:opacity-0"}
          `}
        >
          {keybind}
        </span>
      )}
    </div>
  );
}