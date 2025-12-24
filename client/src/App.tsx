import { useEffect, Suspense, lazy } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Toaster } from "sonner";
import { WalletContextProvider } from "@/contexts/WalletContextProvider";
import { initializeAuth } from "@/utils/auth";
import { socketService } from "@/services/socket";
import { RouteLoadingOverlay } from "@/components/RouteLoadingOverlay";

// Scroll to top on route change (instant, not smooth)
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
};

// Layouts - keep these eager loaded as they're used on every route
import { PublicLayout } from "@/layouts/PublicLayout";
import { PrivateLayout } from "@/layouts/PrivateLayout";
import { AdminLayout } from "@/layouts/AdminLayout";

// Critical path: Home page loaded eagerly for fastest initial load
import { Home } from "@/pages/Home";
import { Login } from "@/pages/Login";

// Lazy load all other pages for code splitting
const Markets = lazy(() =>
  import("@/pages/Markets").then((m) => ({ default: m.Markets }))
);
const MarketDetail = lazy(() =>
  import("@/pages/MarketDetail").then((m) => ({ default: m.MarketDetail }))
);
const CreateMarket = lazy(() =>
  import("@/pages/CreateMarket").then((m) => ({ default: m.CreateMarket }))
);
const Portfolio = lazy(() =>
  import("@/pages/Portfolio").then((m) => ({ default: m.Portfolio }))
);
const Activity = lazy(() =>
  import("@/pages/Activity").then((m) => ({ default: m.Activity }))
);
const Leaderboard = lazy(() =>
  import("@/pages/Leaderboard").then((m) => ({ default: m.Leaderboard }))
);
const Settings = lazy(() =>
  import("@/pages/Settings").then((m) => ({ default: m.Settings }))
);
const VerifyEmail = lazy(() =>
  import("@/pages/VerifyEmail").then((m) => ({ default: m.VerifyEmail }))
);
const MyMarkets = lazy(() =>
  import("@/pages/MyMarkets").then((m) => ({ default: m.MyMarkets }))
);
const Watchlist = lazy(() =>
  import("@/pages/Watchlist").then((m) => ({ default: m.Watchlist }))
);
const Pools = lazy(() =>
  import("@/pages/Pools").then((m) => ({ default: m.Pools }))
);
const UserProfile = lazy(() =>
  import("@/pages/UserProfile").then((m) => ({ default: m.UserProfile }))
);

// Legal Pages - lazy loaded since rarely accessed
const TermsOfService = lazy(() =>
  import("@/pages/TermsOfService").then((m) => ({ default: m.TermsOfService }))
);
const PrivacyPolicy = lazy(() =>
  import("@/pages/PrivacyPolicy").then((m) => ({ default: m.PrivacyPolicy }))
);
const CookiePolicy = lazy(() =>
  import("@/pages/CookiePolicy").then((m) => ({ default: m.CookiePolicy }))
);
const Disclaimer = lazy(() =>
  import("@/pages/Disclaimer").then((m) => ({ default: m.Disclaimer }))
);

// Admin Pages - lazy loaded since rarely accessed
const AdminDashboard = lazy(() =>
  import("@/pages/admin/Dashboard").then((m) => ({ default: m.AdminDashboard }))
);
const AdminMarkets = lazy(() =>
  import("@/pages/admin/Markets").then((m) => ({ default: m.AdminMarkets }))
);
const AdminUsers = lazy(() =>
  import("@/pages/admin/Users").then((m) => ({ default: m.AdminUsers }))
);
const AdminSettings = lazy(() =>
  import("@/pages/admin/Settings").then((m) => ({ default: m.AdminSettings }))
);
const AdminWithdrawals = lazy(() =>
  import("@/pages/admin/Withdrawals").then((m) => ({
    default: m.AdminWithdrawals,
  }))
);
const AdminSuspiciousTrades = lazy(() =>
  import("@/pages/admin/SuspiciousTrades").then((m) => ({
    default: m.AdminSuspiciousTrades,
  }))
);
const AdminDisputes = lazy(() =>
  import("@/pages/admin/Disputes").then((m) => ({
    default: m.AdminDisputes,
  }))
);

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-2 border-neon-iris border-t-transparent rounded-full animate-spin" />
      <span className="text-moon-grey text-sm">Loading...</span>
    </div>
  </div>
);

function App() {
  useEffect(() => {
    initializeAuth();

    // Initialize global socket connection
    socketService.connect();

    return () => {
      // Don't disconnect on cleanup - the service manages this
    };
  }, []);

  useEffect(() => {
    const stickyElements = document.querySelectorAll(
      "[data-sticky-aside], [data-sticky-trade-form], [data-sticky-trade-form-2]"
    );

    stickyElements.forEach((el) => {
      let parent = el.parentElement;

      while (parent) {
        const style: any = getComputedStyle(parent);

        const breaksSticky =
          style.overflow !== "visible" ||
          style.transform !== "none" ||
          style.backdropFilter !== "none" ||
          style.webkitBackdropFilter !== "none" ||
          style.position === "fixed";

        if (breaksSticky) {
          parent.style.outline = "2px solid red";
          parent.style.outlineOffset = "2px";

          console.warn("Sticky broken by ancestor:", parent, style);

          const label = document.createElement("div");
          label.textContent = "🚫 Sticky Blocker";
          label.style.position = "absolute";
          label.style.top = "0";
          label.style.right = "0";
          label.style.background = "rgba(255,0,0,0.7)";
          label.style.color = "#fff";
          label.style.fontSize = "10px";
          label.style.padding = "2px 4px";
          label.style.zIndex = "9999";

          parent.appendChild(label);
        }

        parent = parent.parentElement;
      }
    });
  }, []);

  return (
    <WalletContextProvider>
      <Toaster
        position="top-center"
        closeButton
        visibleToasts={1}
        toastOptions={{
          style: {
            background: "#2a2a3e",
            border: "1px solid #7C4DFF",
            color: "#e2e8f0",
            boxShadow: "0 4px 12px rgba(124, 77, 255, 0.3)",
          },
          className: "toast-swipeable",
        }}
        richColors
        expand={false}
        duration={4000}
      />
      <BrowserRouter>
        <RouteLoadingOverlay />
        <ScrollToTop />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Login page - standalone, no layout */}
            <Route path="/login" element={<Login />} />

            {/* Public Routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/markets" element={<Markets />} />
              <Route path="/market/:id" element={<MarketDetail />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              {/* Legal Pages */}
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/cookies" element={<CookiePolicy />} />
              <Route path="/disclaimer" element={<Disclaimer />} />
            </Route>

            {/* Private Routes (Require Wallet Connection) */}
            <Route element={<PrivateLayout />}>
              <Route path="/create" element={<CreateMarket />} />
              <Route path="/my-markets" element={<MyMarkets />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/pools" element={<Pools />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/activity" element={<Activity />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile/:userId" element={<UserProfile />} />
            </Route>

            {/* Admin Routes (Require Admin Role) */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="markets" element={<AdminMarkets />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="withdrawals" element={<AdminWithdrawals />} />
              <Route
                path="suspicious-trades"
                element={<AdminSuspiciousTrades />}
              />
              <Route path="disputes" element={<AdminDisputes />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </WalletContextProvider>
  );
}

export default App;
