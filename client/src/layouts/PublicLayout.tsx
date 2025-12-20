import { Outlet } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MobileNav } from "@/components/MobileNav";

export const PublicLayout = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Main content area — CLEAN, NO overflow, NO isolation, NO transforms */}
      <main className="flex-1 md:pt-16 pb-16 md:pb-0 overflow-visible">
        <Outlet />
      </main>

      {/* Footer (desktop only) */}
      <div className="hidden md:block">
        <Footer />
      </div>

      {/* Mobile nav (fixed) */}
      <MobileNav />
    </div>
  );
};
