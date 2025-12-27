import { Outlet } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MobileNav } from "@/components/MobileNav";

export const PublicLayout = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Main content area — CLEAN, NO overflow, NO isolation, NO transforms */}
      {/* Padding-bottom reserves space for fixed bottom nav on mobile */}
      <main className="flex-1 md:pt-16 overflow-visible pb-bottom-nav">
        <Outlet />
      </main>

      {/* Footer (desktop only) */}
      <div className="hidden md:block">
        <Footer />
      </div>

      {/* Mobile nav (fixed to bottom, reserved space in main) */}
      <MobileNav />
    </div>
  );
};
