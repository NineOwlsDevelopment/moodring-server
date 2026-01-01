import { useState } from "react";
import { Navigate, Outlet, Link, useLocation } from "react-router-dom";
import { useUserStore } from "@/stores/userStore";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { motion, AnimatePresence } from "framer-motion";

export const AdminLayout = () => {
  const { isAdmin, isInitializing } = useUserStore();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Show loading state while checking for existing session
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-black">
        <div className="w-8 h-8 border-2 border-white/20 border-t-neon-iris rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    console.log("Not connected or not admin");
    return <Navigate to="/" replace />;
  }

  const navItems = [
    { path: "/admin", label: "Dashboard", icon: "◉", exact: true },
    { path: "/admin/markets", label: "Markets", icon: "◎" },
    { path: "/admin/users", label: "Users", icon: "◉" },
    { path: "/admin/withdrawals", label: "Withdrawals", icon: "◇" },
    { path: "/admin/suspicious-trades", label: "Suspicious", icon: "⚠" },
    { path: "/admin/disputes", label: "Disputes", icon: "◈" },
    { path: "/admin/settings", label: "Settings", icon: "⚙" },
  ];

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="min-h-screen flex flex-col bg-ink-black">
      {/* Top Navigation */}
      <Navbar />

      {/* Mobile Menu Button - Fixed position */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="lg:hidden fixed top-20 left-4 z-40 p-2.5 bg-graphite-deep border border-white/10 hover:border-white/20 transition-colors"
        aria-label="Toggle admin menu"
      >
        <div className="w-5 h-4 flex flex-col justify-between">
          <span
            className={`block h-0.5 bg-white transition-all duration-300 ${
              isSidebarOpen ? "rotate-45 translate-y-1.5" : ""
            }`}
          />
          <span
            className={`block h-0.5 bg-white transition-all duration-300 ${
              isSidebarOpen ? "opacity-0" : ""
            }`}
          />
          <span
            className={`block h-0.5 bg-white transition-all duration-300 ${
              isSidebarOpen ? "-rotate-45 -translate-y-1.5" : ""
            }`}
          />
        </div>
      </button>

      {/* Main content area */}
      <div className="flex-1 flex pt-16">
        {/* Mobile Backdrop */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 bg-ink-black/80 backdrop-blur-sm z-30"
              onClick={closeSidebar}
            />
          )}
        </AnimatePresence>

        {/* Sidebar - Desktop always visible, Mobile drawer */}
        <aside
          className={`
            fixed lg:sticky top-16 left-0 h-[calc(100vh-4rem)] z-40
            w-64 bg-graphite-deep/95 lg:bg-graphite-deep/50 border-r border-white/5
            transform transition-transform duration-300 ease-out
            ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
        >
          <div className="h-full overflow-y-auto">
            <div className="p-4 sm:p-6">
              {/* Admin Panel Header */}
              <div className="mb-6">
                <div className="text-[10px] tracking-[0.3em] uppercase text-neon-iris/80 font-medium mb-1">
                  Administration
                </div>
                <h2 className="text-lg font-light text-white">Admin Panel</h2>
              </div>

              {/* Navigation */}
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const isActive = item.exact
                    ? location.pathname === item.path
                    : location.pathname.startsWith(item.path) &&
                      item.path !== "/admin";

                  // Special case for dashboard - only active when exactly at /admin
                  const isDashboardActive =
                    item.path === "/admin" && location.pathname === "/admin";
                  const finalIsActive =
                    item.path === "/admin" ? isDashboardActive : isActive;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={closeSidebar}
                      className={`
                        flex items-center gap-3 px-4 py-3 text-sm font-light transition-all duration-200
                        ${
                          finalIsActive
                            ? "bg-gradient-to-r from-neon-iris/20 to-transparent text-white border-l-2 border-neon-iris"
                            : "text-moon-grey/60 hover:text-white hover:bg-white/5 border-l-2 border-transparent"
                        }
                      `}
                    >
                      <span className="text-xs opacity-60">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Quick Stats - Mobile only */}
              <div className="mt-8 pt-6 border-t border-white/5 lg:hidden">
                <div className="text-[10px] tracking-[0.15em] uppercase text-moon-grey/40 mb-4">
                  Quick Access
                </div>
                <div className="space-y-2">
                  <Link
                    to="/"
                    onClick={closeSidebar}
                    className="block px-4 py-2 text-xs text-moon-grey/50 hover:text-white transition-colors"
                  >
                    ← Back to App
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto min-w-0">
          {/* Mobile spacer for menu button */}
          <div className="lg:hidden h-12" />
          <Outlet />
        </main>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};
