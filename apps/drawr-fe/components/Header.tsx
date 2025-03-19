"use client";

import { Button } from "@repo/ui/button";
import { signOut } from "next-auth/react";
import { Loader2Icon, LogOutIcon } from "lucide-react";
import { useState } from "react";

export function Header() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const handleLogout = () => {
    setIsSigningOut(true);
    signOut({ callbackUrl: "/signin" });
  };

  return (
    <header className="w-full border-b border-gray-700/50 bg-gray-900/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <h1 className="text-4xl font-bold text-white select-none">Drawr</h1>
        <Button
          variant="outline"
          size="lg"
          onClick={handleLogout}
          className="text-gray-300 hover:text-white border-gray-700/50 
                      hover:bg-gray-700/50 transition-all duration-300 hover:border-gray-600/50"
        >
          {isSigningOut ? (
            <Loader2Icon className="w-6 h-6 animate-spin" />
          ) : (
            <LogOutIcon className="w-6 h-6" />
          )}
        </Button>
      </div>
    </header>
  );
}
