import { Outlet } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const PublicLayout = () => {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation - fixed on desktop, sticky on mobile */}
      <Navbar />

      {/* Main content area — contained between nav and footer */}
      <main className="flex-1 md:pt-16 overflow-visible">
        <Outlet />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};
