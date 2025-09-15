'use client'
import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("./components/Map"), { ssr: false });
export default function Home() {
  return (
    <main className=" bg-green-50 relative border-2 border-e-blue-800 overflow-hidden">
      {/* Light green bubbles */}
      {/* <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute w-72 h-72 bg-green-200/30 rounded-full -top-16 -left-16 animate-pulse"></div>
        <div className="absolute w-96 h-96 bg-green-200/20 rounded-full -bottom-32 -right-32 animate-pulse delay-2000"></div>
        <div className="absolute w-64 h-64 bg-green-200/25 rounded-full top-1/3 right-1/4 animate-pulse delay-1000"></div>
      </div> */}

      <div className="relative z-10 max-w-full  h-full mx-auto">
        <MapComponent />
      </div>
    </main>
  );
}
