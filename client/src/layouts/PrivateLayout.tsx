import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MobileNav } from "@/components/MobileNav";
import { useUserStore } from "@/stores/userStore";

export const PrivateLayout = () => {
  const { user, isInitializing } = useUserStore();
  const location = useLocation();

  // Show loading state while checking for existing session
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a14]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!user) {
    // Redirect to login page, preserving the intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation - fixed on desktop, sticky on mobile */}
      <Navbar />
      
      {/* Main content area — contained between nav and footer */}
      {/* Padding-bottom reserves space for fixed bottom nav on mobile */}
      <main className="flex-1 md:pt-16 pb-bottom-nav">
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
