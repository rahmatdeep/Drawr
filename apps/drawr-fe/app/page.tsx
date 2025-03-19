import { Button } from "@repo/ui/button";
import { Pencil, Users, Zap, Palette } from "lucide-react";
import Link from "next/link";
export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-black">
      <div className="flex flex-col items-center justify-center p-4 flex-grow">
        <div className="text-center">
          <div
            className="mb-8 inline-flex items-center justify-center p-4  bg-gray-900/50  rounded-2xl shadow-sm border border-gray-700/50 hover:shadow-lg hover:bg-gray-800/50 transition-all duration-300 
                    hover:border-white/20 hover:scale-[1.02]"
          >
            <Pencil className="w-12 h-12 text-white" strokeWidth={1.5} />
          </div>

          <h1 className="text-6xl font-bold mb-4 text-white">drawr</h1>

          <p className="text-lg text-neutral-400 mb-8 max-w-md mx-auto">
            Collaborative sketching reimagined for modern teams
          </p>
          <Link href={"/signin"}>
            <Button
              size="lg"
              variant="primary"
              className="px-8 py-4 bg-white text-black rounded-xl text-lg font-medium
              transform transition-all duration-300 hover:scale-105
                     hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-white
                    "
            >
              Start Creating
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            className="group relative p-6 bg-gray-900/50 rounded-xl border border-gray-700/50 
                    hover:bg-gray-800/50 transition-all duration-300 
                    hover:border-white/20 hover:scale-[1.02]"
          >
            <div className="inline-flex items-center justify-center p-3 bg-neutral-900 rounded-xl mb-4">
              <Users className="w-6 h-6 text-white" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white">
              Real-time Collaboration
            </h3>
            <p className="text-neutral-400">
              Work together seamlessly with your team. See changes instantly as
              they happen.
            </p>
          </div>

          <div
            className="group relative p-6 bg-gray-900/50 rounded-xl border border-gray-700/50 
                    hover:bg-gray-800/50 transition-all duration-300 
                    hover:border-white/20 hover:scale-[1.02]"
          >
            <div className="inline-flex items-center justify-center p-3 bg-neutral-900 rounded-xl mb-4">
              <Zap className="w-6 h-6 text-white" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white">
              Lightning Fast
            </h3>
            <p className="text-neutral-400">
              Built for speed with advanced vector rendering. Create without
              lag.
            </p>
          </div>

          <div
            className="group relative p-6 bg-gray-900/50 rounded-xl border border-gray-700/50 
                    hover:bg-gray-800/50 transition-all duration-300 
                    hover:border-white/20 hover:scale-[1.02]"
          >
            <div className="inline-flex items-center justify-center p-3 bg-neutral-900 rounded-xl mb-4">
              <Palette className="w-6 h-6 text-white" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white">
              Custom Styling
            </h3>
            <p className="text-neutral-400">
              Extensive color palettes and brush libraries to match your needs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
