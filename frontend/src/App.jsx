import { Routes, Route, Navigate, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, MessagesSquare, Contact, Users, NotebookPen, MessageCircle, ShieldAlert, LogOut, Mail, AtSign,
  Building2, BriefcaseBusiness,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
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
import ServicesPage from "@/pages/Services/ServicesPage";

// access: "all" | "admin" | "super"
const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, access: "all" },
  { to: "/inbox", label: "WhatsApp Inbox", icon: MessagesSquare, access: "all" },
  { to: "/email-inbox", label: "Email Inbox", icon: Mail, access: "all" },
  { to: "/customers", label: "Customers", icon: Contact, access: "all" },
  { to: "/properties", label: "Properties", icon: Building2, access: "all" },
  { to: "/services", label: "Services", icon: BriefcaseBusiness, access: "all" },
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

function Sidebar() {
  const auth = useAuth();
  const { user, logout, unread, emailUnread } = auth;
  const badges = { "/inbox": unread, "/email-inbox": emailUnread };
  const linkClass = ({ isActive }) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-blue-600 text-white"
        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
    }`;

  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-1 px-2">
        <MessageCircle className="h-6 w-6 shrink-0 text-green-600" />
        <span className="text-base font-bold leading-tight text-gray-900 dark:text-white">WhatsApp CRM</span>
      </div>
      <div className="px-2 mb-6 text-xs text-gray-500 dark:text-gray-400 truncate" title={user?.companyName}>{user?.companyName}</div>

      <nav className="space-y-1 flex-1 overflow-y-auto">
        {NAV.filter((n) => allowed(n.access, auth)).map((n) => (
          <NavLink key={n.to} to={n.to} className={linkClass}>
            <n.icon className="h-4 w-4" />
            <span className="flex-1">{n.label}</span>
            {badges[n.to] > 0 && (
              <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white ${n.to === "/inbox" ? "bg-green-600" : "bg-blue-600"}`}>
                {badges[n.to] > 99 ? "99+" : badges[n.to]}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-gray-200 dark:border-slate-800 pt-3 mt-3">
        <div className="px-2 mb-2">
          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.fullName}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {user?.isSuperAdmin === "T" ? "Super Admin" : user?.role === "ADMIN" ? "Admin" : "Staff"}
          </div>
        </div>
        <button onClick={logout}
          className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}

function Shell({ children }) {
  return (
    <div className="flex h-full bg-gray-50 dark:bg-slate-950">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
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
      <Route path="/properties" element={page(<PropertiesPage />)} />
      <Route path="/services" element={page(<ServicesPage />)} />
      <Route path="/staff" element={page(<StaffPage />, "admin")} />
      <Route path="/notes" element={page(<NotesPage />)} />
      <Route path="/whatsapp-settings" element={page(<WhatsAppSettingsPage />, "admin")} />
      <Route path="/email-settings" element={page(<EmailSettingsPage />, "admin")} />
      <Route path="/superadmin" element={page(<SuperAdminPage />, "super")} />

      <Route path="*" element={page(<div className="p-8">Not found</div>)} />
    </Routes>
  );
}
