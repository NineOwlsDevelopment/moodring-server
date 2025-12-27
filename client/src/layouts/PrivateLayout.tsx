import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
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
      <main className="flex-1 md:pt-16">
        <Outlet />
      </main>
      
      {/* Footer */}
      <Footer />
    </div>
  );
};
