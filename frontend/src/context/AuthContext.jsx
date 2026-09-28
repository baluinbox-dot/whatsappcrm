import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthService } from "@/ServiceLayer/AuthService/AuthService";
import { InboxService } from "@/ServiceLayer/WhatsAppService/WhatsAppService";
import { EmailService } from "@/ServiceLayer/EmailService/EmailService";
import { FollowUpService } from "@/ServiceLayer/LeadService/LeadService";
import { TOKEN_KEY, USER_KEY } from "@/lib/apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) ?? null; } catch { return null; }
  });
  const [unread, setUnread] = useState(0);
  const [emailUnread, setEmailUnread] = useState(0);
  const [followUpsDue, setFollowUpsDue] = useState(0);
  const [loading, setLoading] = useState(true);

  const refreshUnread = useCallback(async () => {
    try { setUnread(await InboxService.unreadCount()); } catch { setUnread(0); }
    try { setEmailUnread(await EmailService.unreadCount()); } catch { setEmailUnread(0); }
    try { const c = await FollowUpService.counts(); setFollowUpsDue(c.overdue + c.today); } catch { setFollowUpsDue(0); }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) { setLoading(false); return; }
    AuthService.me()
      .then((u) => { setUser(u); localStorage.setItem(USER_KEY, JSON.stringify(u)); })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  const persist = (res) => {
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  };

  const login = async (email, password) => persist(await AuthService.login(email, password));
  const staffLogin = async (adminEmail, mobileNo, password) =>
    persist(await AuthService.staffLogin(adminEmail, mobileNo, password));

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setUnread(0);
    setEmailUnread(0);
    setFollowUpsDue(0);
  };

  // Keeps the sidebar unread badge current.
  useEffect(() => {
    if (!user) return;
    refreshUnread();
    const id = setInterval(refreshUnread, 15000);
    return () => clearInterval(id);
  }, [user, refreshUnread]);

  const value = useMemo(() => ({
    user,
    loading,
    login,
    staffLogin,
    logout,
    unread,
    emailUnread,
    followUpsDue,
    refreshUnread,
    isAuthenticated: !!user,
    isAdmin: user?.role === "ADMIN",
    isSuperAdmin: user?.isSuperAdmin === "T",
  }), [user, loading, unread, emailUnread, followUpsDue, refreshUnread]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
