import { Outlet } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MobileNav } from "@/components/MobileNav";

export const PublicLayout = () => {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation - fixed on desktop, sticky on mobile */}
      <Navbar />

      {/* Main content area — contained between nav and footer */}
      {/* Padding-bottom reserves space for fixed bottom nav on mobile */}
      <main className="flex-1 md:pt-16 overflow-visible pb-bottom-nav">
        <Outlet />
      </main>

      {/* Footer/MobileNav - contains the body from below */}
      {/* Desktop: Footer */}
      <div className="hidden md:block">
        <Footer />
      </div>
      
      {/* Mobile: Bottom Navigation (fixed to bottom, reserved space in main) */}
      <div className="block md:hidden">
        <MobileNav />
      </div>
    </div>
  );
};
