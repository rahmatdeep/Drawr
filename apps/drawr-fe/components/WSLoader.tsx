import { Pencil } from "lucide-react";

export function WSLoader() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black flex items-center justify-center">
      <div className="text-center">
        <div className="relative flex justify-center items-center">
          <Pencil
            className="w-16 h-16 text-white animate-bounce"
            strokeWidth={1.5}
          />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-white/10 rounded-full blur-sm animate-pulse" />
        </div>

        <h1 className="mt-8 text-4xl font-bold text-white">drawr</h1>

        <div className="mt-4 flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <div className="w-2 h-2 rounded-full bg-white animate-pulse delay-150" />
          <div className="w-2 h-2 rounded-full bg-white animate-pulse delay-300" />
        </div>

        <p className="mt-4 text-zinc-400">Connecting to drawing space...</p>
      </div>
    </div>
  );
}
