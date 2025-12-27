import { Link, useLocation } from "react-router-dom";
import { Home, Search, Activity, User } from "lucide-react";

export const MobileNav = () => {
  const location = useLocation();

  const navItems = [
    {
      path: "/",
      icon: Home,
      label: "Home",
    },
    {
      path: "/markets",
      icon: Search,
      label: "Explore",
    },
    {
      path: "/activity",
      icon: Activity,
      label: "Activity",
    },
    {
      path: "/portfolio",
      icon: User,
      label: "Profile",
    },
  ];

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 block md:hidden bg-graphite-deep border-t border-white/5">
      <div
        className="flex items-center justify-around w-full"
        style={{
          paddingTop: "8px",
          paddingBottom: `calc(8px + env(safe-area-inset-bottom, 0px))`,
          minHeight: "64px",
        }}
      >
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors duration-200 ${
                active ? "text-white" : "text-moon-grey"
              }`}
            >
              <Icon
                className={`w-5 h-5 transition-all duration-200 ${
                  active ? "stroke-[2.5]" : "stroke-[1.5]"
                }`}
              />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
