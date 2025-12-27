import { Navigate, Outlet, Link, useLocation } from "react-router-dom";
import { useUserStore } from "@/stores/userStore";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const AdminLayout = () => {
  const { isAdmin, isInitializing } = useUserStore();
  const location = useLocation();

  // Show loading state while checking for existing session
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a14]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!isAdmin) {
    console.log("Not connected or not admin");
    return <Navigate to="/" replace />;
  }

  const navItems = [
    { path: "/admin", label: "Dashboard", exact: true },
    { path: "/admin/markets", label: "Markets" },
    { path: "/admin/users", label: "Users" },
    { path: "/admin/withdrawals", label: "Withdrawals" },
    { path: "/admin/suspicious-trades", label: "Suspicious Trades" },
    { path: "/admin/disputes", label: "Disputes" },
    { path: "/admin/settings", label: "Settings" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation - fixed on desktop, sticky on mobile */}
      <Navbar />
      
      {/* Main content area — contained between nav and footer */}
      <div className="flex-1 flex md:pt-16">
        {/* Sidebar */}
        <aside className="w-64 bg-dark-900 border-r border-dark-800">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Admin Panel
            </h2>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = item.exact
                  ? location.pathname === item.path
                  : location.pathname.startsWith(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`block px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary-500/20 text-primary-300 border border-primary-500/30"
                        : "text-gray-300 hover:bg-dark-800"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      
      {/* Footer - contains the body from below */}
      <Footer />
    </div>
  );
};
