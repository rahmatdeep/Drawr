import { Button } from "@repo/ui/button";
import { Pencil, Users, Zap, Palette } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-100">
      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center p-4 flex-grow">
        <div className="text-center">
          <div className="mb-8 inline-flex items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-neutral-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <Pencil className="w-12 h-12 text-neutral-800" strokeWidth={1.5} />
          </div>

          <h1 className="text-6xl font-bold mb-4 text-neutral-800">drawr</h1>

          <p className="text-lg text-neutral-600 mb-8 max-w-md mx-auto">
            Collaborative sketching reimagined for modern teams
          </p>
          <Link href={"/signin"}>
            <Button
              size="lg"
              variant="primary"
              className="px-8 py-4 bg-neutral-800 text-white rounded-xl text-lg font-medium
            transition-all duration-300 hover:bg-neutral-900 hover:shadow-lg hover:-translate-y-1"
            >
              Start Creating
            </Button>
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-5xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Real-time Collaboration */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <div className="inline-flex items-center justify-center p-3 bg-neutral-100 rounded-xl mb-4">
              <Users className="w-6 h-6 text-neutral-800" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-neutral-800">
              Real-time Collaboration
            </h3>
            <p className="text-neutral-600">
              Work together seamlessly with your team. See changes instantly as
              they happen.
            </p>
          </div>

          {/* Lightning Fast */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <div className="inline-flex items-center justify-center p-3 bg-neutral-100 rounded-xl mb-4">
              <Zap className="w-6 h-6 text-neutral-800" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-neutral-800">
              Lightning Fast
            </h3>
            <p className="text-neutral-600">
              Built for speed with advanced vector rendering. Create without
              lag.
            </p>
          </div>

          {/* Custom Styling */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <div className="inline-flex items-center justify-center p-3 bg-neutral-100 rounded-xl mb-4">
              <Palette className="w-6 h-6 text-neutral-800" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-neutral-800">
              Custom Styling
            </h3>
            <p className="text-neutral-600">
              Extensive color palettes and brush libraries to match your needs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
