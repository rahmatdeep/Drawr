"use client";

type UserAvatarProps = {
  name: string;
  size?: "sm" | "md" | "lg";
};

const colors = [
  "bg-cyan-400/30",
  "bg-emerald-400/30",
  "bg-rose-400/30",
  "bg-amber-400/30",
  "bg-violet-400/30",
  "bg-orange-400/30",
];

export function UserAvatar({ name, size = "md" }: UserAvatarProps) {
  const firstLetter = name.charAt(0).toUpperCase();
  const colorIndex = name.charCodeAt(0) % colors.length;
  const bgColor = colors[colorIndex];

  const sizeClasses = {
    sm: "w-8 h-8 text-sm",
    md: "w-10 h-10 text-base",
    lg: "w-12 h-12 text-lg",
  };

  return (
    <div className="group relative cursor-default">
      <div
        className={`
          ${sizeClasses[size]} 
          ${bgColor} 
          rounded-full 
          flex 
          items-center 
          justify-center 
          text-white/90 
          font-medium
          border
          border-white/20
          backdrop-blur-md
          shadow-[0_4px_12px_rgba(255,255,255,0.1)]
          hover:scale-110
          hover:shadow-[0_4px_16px_rgba(255,255,255,0.15)]
          transition-all
          duration-300
        `}
      >
        {firstLetter}
      </div>
      <div className="absolute bottom-0 right-full mr-2 px-2 py-1 bg-gray-800/90 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap backdrop-blur-sm border border-white/10">
        {name}
      </div>
    </div>
  );
}
