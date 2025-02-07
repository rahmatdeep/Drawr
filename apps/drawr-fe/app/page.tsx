import { Button } from "@repo/ui/button";
import { Pencil } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-neutral-950 overflow-hidden">
      {/* Static background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-neutral-950 to-black opacity-80" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center">
          {/* Logo */}
          <div className="mb-8 inline-flex items-center justify-center p-4 bg-gradient-to-b from-neutral-900 to-neutral-950 rounded-2xl backdrop-blur-sm border border-neutral-800">
            <Pencil className="w-12 h-12 text-neutral-300" strokeWidth={1.5} />
          </div>

          {/* Main Heading */}
          <h1 className="text-7xl font-bold mb-6 bg-gradient-to-b from-white to-neutral-200 bg-clip-text text-transparent">
            drawr
          </h1>

          {/* Subheading */}
          <p className="text-lg text-neutral-400 mb-12 max-w-md mx-auto">
            Collaborative sketching reimagined
          </p>

          {/* CTA Button */}
          <Link href={"/signup"}>
            <Button
              className="group relative px-8 py-4 bg-gradient-to-b from-neutral-50 to-neutral-200 
            text-neutral-900 rounded-xl text-lg font-medium overflow-hidden 
            transition-all duration-300 hover:from-white hover:to-neutral-100
            shadow-[0_0_30px_-15px_rgba(255,255,255,0.3)]
            hover:shadow-[0_0_30px_-10px_rgba(255,255,255,0.4)]"
              size="sm"
              variant="primary"
            >
              <span className="relative">Start Now</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
