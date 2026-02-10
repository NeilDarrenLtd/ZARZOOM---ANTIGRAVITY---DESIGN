"use client";

import Navbar from "@/components/Navbar";

export default function Home() {
  console.log("[v0] Home component rendering - minimal test");
  return (
    <main className="bg-white min-h-screen">
      <Navbar />
      <div className="pt-20 p-8">
        <h1 className="text-4xl font-bold text-green-600">ZARZOOM - Test Page</h1>
        <p className="text-gray-600 mt-4">If you can see this, the app is working.</p>
      </div>
    </main>
  );
}
