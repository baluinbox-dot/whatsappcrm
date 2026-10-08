import { useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, MessagesSquare, Contact, Users, NotebookPen, MessageCircle, ShieldAlert, LogOut, Mail, AtSign,
  Building2, BriefcaseBusiness, Target, CalendarClock, BarChart3, Landmark, Menu, X, Sun, Moon, Maximize2, Minimize2,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import LoginPage from "@/pages/Auth/LoginPage";
import DashboardPage from "@/pages/Dashboard/DashboardPage";
import InboxPage from "@/pages/Inbox/InboxPage";
import CustomersPage from "@/pages/Customers/CustomersPage";
import StaffPage from "@/pages/Staff/StaffPage";
import NotesPage from "@/pages/Notes/NotesPage";
import WhatsAppSettingsPage from "@/pages/WhatsAppSettings/WhatsAppSettingsPage";
import EmailInboxPage from "@/pages/EmailInbox/EmailInboxPage";
import EmailSettingsPage from "@/pages/EmailSettings/EmailSettingsPage";
import SuperAdminPage from "@/pages/SuperAdmin/SuperAdminPage";
import PropertiesPage from "@/pages/Properties/PropertiesPage";
import ProjectsPage from "@/pages/Projects/ProjectsPage";
import ServicesPage from "@/pages/Services/ServicesPage";
import LeadsPage from "@/pages/Leads/LeadsPage";
import LeadDetailPage from "@/pages/Leads/LeadDetailPage";
import ImportLeadsPage from "@/pages/Leads/ImportLeadsPage";
import FollowUpsPage from "@/pages/FollowUps/FollowUpsPage";
import ReportsPage from "@/pages/Reports/ReportsPage";

// access: "all" | "admin" | "super"
const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, access: "all" },
  { to: "/inbox", label: "WhatsApp Inbox", icon: MessagesSquare, access: "all" },
  { to: "/email-inbox", label: "Email Inbox", icon: Mail, access: "all" },
  { to: "/leads", label: "Leads", icon: Target, access: "all" },
  { to: "/follow-ups", label: "Follow-ups", icon: CalendarClock, access: "all" },
  { to: "/customers", label: "Customers", icon: Contact, access: "all" },
  { to: "/projects", label: "Projects", icon: Landmark, access: "all" },
  { to: "/properties", label: "Properties", icon: Building2, access: "all" },
  { to: "/services", label: "Services", icon: BriefcaseBusiness, access: "all" },
  { to: "/reports", label: "Reports", icon: BarChart3, access: "all" },
  { to: "/staff", label: "Staff", icon: Users, access: "admin" },
  { to: "/notes", label: "Notes", icon: NotebookPen, access: "all" },
  { to: "/whatsapp-settings", label: "WhatsApp Settings", icon: MessageCircle, access: "admin" },
  { to: "/email-settings", label: "Email Settings", icon: AtSign, access: "admin" },
  { to: "/superadmin", label: "Super Admin", icon: ShieldAlert, access: "super" },
];

function allowed(access, { isAdmin, isSuperAdmin }) {
  if (access === "super") return isSuperAdmin;
  if (access === "admin") return isAdmin;
  return true;
}

function RequireAuth({ access, children }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading) return <div className="p-8 text-gray-400">Loading…</div>;
  if (!auth.isAuthenticated) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!allowed(access, auth)) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Not authorised</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">You don’t have access to this page.</p>
      </div>
    );
  }
  return children;
}

function Sidebar({ open, onClose }) {
  const auth = useAuth();
  const { user, unread, emailUnread, followUpsDue } = auth;
  const badges = { "/inbox": unread, "/email-inbox": emailUnread, "/follow-ups": followUpsDue };
  const linkClass = ({ isActive }) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-blue-600 text-white"
        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
    }`;

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition-transform duration-200 lg:static lg:z-auto lg:w-60 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center gap-2 mb-1 px-2">
          <MessageCircle className="h-6 w-6 shrink-0 text-green-600" />
          <span className="flex-1 text-base font-bold leading-tight text-gray-900 dark:text-white">iStreams CRM</span>
          <button onClick={onClose} aria-label="Close menu" className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-2 mb-6 text-xs text-gray-500 dark:text-gray-400 truncate" title={user?.companyName}>{user?.companyName}</div>

        <nav className="space-y-1 flex-1 overflow-y-auto">
          {NAV.filter((n) => allowed(n.access, auth)).map((n) => (
            <NavLink key={n.to} to={n.to} className={linkClass}>
              <n.icon className="h-4 w-4" />
              <span className="flex-1">{n.label}</span>
              {badges[n.to] > 0 && (
                <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white ${n.to === "/inbox" ? "bg-green-600" : n.to === "/follow-ups" ? "bg-red-600" : "bg-blue-600"}`}>
                  {badges[n.to] > 99 ? "99+" : badges[n.to]}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}

const iconBtn =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors";

function Topbar({ onMenu }) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(() => !!document.fullscreenElement);
  const menuRef = useRef(null);

  useEffect(() => {
    const sync = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [menuOpen]);

  const toggleFullscreen = () =>
    (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});

  const initials = (user?.fullName || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const role = user?.isSuperAdmin === "T" ? "Super Admin" : user?.role === "ADMIN" ? "Admin" : "Staff";

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 sm:px-4">
      <button onClick={onMenu} aria-label="Open menu" className={`${iconBtn} lg:hidden`}>
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">
        <MessageCircle className="h-5 w-5 shrink-0 text-green-600" />
        <span className="truncate text-sm font-bold text-gray-900 dark:text-white">iStreams CRM</span>
      </div>
      <div className="hidden flex-1 lg:block" />

      <button onClick={toggleTheme} className={iconBtn} title={isDark ? "Switch to light theme" : "Switch to dark theme"}
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}>
        {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      {document.fullscreenEnabled && (
        <button onClick={toggleFullscreen} className={iconBtn} title={fullscreen ? "Exit full screen" : "Full screen"}
          aria-label={fullscreen ? "Exit full screen" : "Full screen"}>
          {fullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>
      )}

      <div ref={menuRef} className="relative">
        <button onClick={() => setMenuOpen((o) => !o)} aria-haspopup="menu" aria-expanded={menuOpen}
          className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">{initials}</span>
          <span className="hidden text-left sm:block">
            <span className="block max-w-[10rem] truncate text-sm font-medium leading-tight text-gray-900 dark:text-white">{user?.fullName}</span>
            <span className="block text-xs leading-tight text-gray-500 dark:text-gray-400">{role}</span>
          </span>
          <ChevronDown className="hidden h-4 w-4 text-gray-400 sm:block" />
        </button>
        {menuOpen && (
          <div role="menu" className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 shadow-lg">
            <div className="border-b border-gray-100 dark:border-slate-800 px-3 py-2">
              <div className="truncate text-sm font-medium text-gray-900 dark:text-white">{user?.fullName}</div>
              <div className="truncate text-xs text-gray-500 dark:text-gray-400">{user?.email || user?.mobileNo}</div>
              <div className="truncate text-xs text-gray-500 dark:text-gray-400">{role} · {user?.companyName}</div>
            </div>
            <button onClick={logout} role="menuitem"
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function Shell({ children }) {
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setNavOpen(false), [pathname]);

  return (
    <div className="flex h-full bg-gray-50 dark:bg-slate-950">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setNavOpen(true)} />
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

const page = (element, access = "all") => (
  <RequireAuth access={access}>
    <Shell>{element}</Shell>
  </RequireAuth>
);

export default function App() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated && !loading ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/signup" element={<Navigate to="/login?tab=signup" replace />} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={page(<DashboardPage />)} />
      <Route path="/inbox" element={page(<InboxPage />)} />
      <Route path="/email-inbox" element={page(<EmailInboxPage />)} />
      <Route path="/customers" element={page(<CustomersPage />)} />
      <Route path="/leads" element={page(<LeadsPage />)} />
      <Route path="/leads/import" element={page(<ImportLeadsPage />, "admin")} />
      <Route path="/leads/:id" element={page(<LeadDetailPage />)} />
      <Route path="/follow-ups" element={page(<FollowUpsPage />)} />
      <Route path="/projects" element={page(<ProjectsPage />)} />
      <Route path="/properties" element={page(<PropertiesPage />)} />
      <Route path="/services" element={page(<ServicesPage />)} />
      <Route path="/reports" element={page(<ReportsPage />)} />
      <Route path="/staff" element={page(<StaffPage />, "admin")} />
      <Route path="/notes" element={page(<NotesPage />)} />
      <Route path="/whatsapp-settings" element={page(<WhatsAppSettingsPage />, "admin")} />
      <Route path="/email-settings" element={page(<EmailSettingsPage />, "admin")} />
      <Route path="/superadmin" element={page(<SuperAdminPage />, "super")} />

      <Route path="*" element={page(<div className="p-8">Not found</div>)} />
    </Routes>
  );
}
