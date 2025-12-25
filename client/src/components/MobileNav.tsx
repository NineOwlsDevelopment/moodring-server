import { Link, useLocation } from "react-router-dom";
import { Home, Search, Activity, User } from "lucide-react";

interface NavItem {
  path: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
  label: string;
}

export const MobileNav = () => {
  const location = useLocation();

  const navItems: NavItem[] = [
    {
      path: "/",
      icon: <Home className="w-5 h-5" strokeWidth={1.5} />,
      activeIcon: <Home className="w-5 h-5" strokeWidth={2.5} />,
      label: "Home",
    },
    {
      path: "/markets",
      icon: <Search className="w-5 h-5" strokeWidth={1.5} />,
      activeIcon: <Search className="w-5 h-5" strokeWidth={2.5} />,
      label: "Explore",
    },
    {
      path: "/activity",
      icon: <Activity className="w-5 h-5" strokeWidth={1.5} />,
      activeIcon: <Activity className="w-5 h-5" strokeWidth={2.5} />,
      label: "Activity",
    },
    {
      path: "/portfolio",
      icon: <User className="w-5 h-5" strokeWidth={1.5} />,
      activeIcon: <User className="w-5 h-5" strokeWidth={2.5} />,
      label: "Profile",
    },
  ];

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-graphite-deep/95 backdrop-blur-xl border-t border-white/5 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around px-1 py-1">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center py-2 px-3 min-w-[60px] rounded-xl transition-all duration-200 ${
                active
                  ? "text-white bg-neon-iris/10"
                  : "text-moon-grey hover:text-white hover:bg-white/5"
              }`}
            >
              <div
                className={`relative transition-transform duration-200 ${
                  active ? "scale-110" : ""
                }`}
              >
                {active ? item.activeIcon : item.icon}
                {active && (
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-neon-iris" />
                )}
              </div>
              <span
                className={`text-[10px] mt-1 font-medium truncate max-w-full ${
                  active ? "text-white" : ""
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
