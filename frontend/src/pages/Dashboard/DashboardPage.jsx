import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard, RefreshCw, Users, UserPlus, Inbox, MailWarning, MessageSquare, Clock } from "lucide-react";
import { DashboardService } from "@/ServiceLayer/WhatsAppService/WhatsAppService";
import { useAuth } from "@/context/AuthContext";
import { Alerts } from "@/components/common/ui";

function StatCard({ icon: Icon, label, value, hint, to, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-600/10 text-blue-600",
    green: "bg-green-600/10 text-green-600",
    amber: "bg-amber-500/10 text-amber-600",
    red: "bg-red-600/10 text-red-600",
  };
  const body = (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-5 h-full hover:border-gray-300 dark:hover:border-slate-700 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
        <span className={`rounded-lg p-2 ${tones[tone]}`}><Icon className="h-4 w-4" /></span>
      </div>
      <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2 tabular-nums">{value ?? "–"}</div>
      {hint && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{hint}</div>}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function DashboardPage() {
  const { isAdmin, user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try { setData(await DashboardService.get()); }
    catch { setError("Failed to load dashboard."); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const s = data?.stats;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600/10 p-2"><LayoutDashboard className="h-6 w-6 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isAdmin ? `${user?.companyName} — all customers and staff` : "Your assigned customers"}
            </p>
          </div>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <Alerts error={error} onClearError={() => setError("")} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={Users} label={isAdmin ? "Total customers" : "My customers"} value={s?.totalCustomers} to="/customers" />
        <StatCard icon={UserPlus} label="New today" value={s?.newToday} tone="green" />
        {isAdmin && (
          <StatCard icon={Inbox} label="Unassigned" value={s?.unassigned} tone={s?.unassigned > 0 ? "amber" : "blue"}
            hint="Waiting to be assigned to staff" to="/inbox?filter=unassigned" />
        )}
        <StatCard icon={MailWarning} label="Chats with unread messages" value={s?.unreadChats} tone={s?.unreadChats > 0 ? "red" : "blue"}
          to="/inbox?filter=unread" />
        <StatCard icon={MessageSquare} label="Messages today" value={s?.messagesToday} />
        <StatCard icon={Clock} label="Reply window open" value={s?.openWindows} tone="green"
          hint="Customers who wrote in the last 24 hours" />
      </div>

      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 dark:border-slate-800 font-semibold text-gray-900 dark:text-white">Staff workload</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                <tr className="text-left text-gray-600 dark:text-gray-300">
                  <th className="px-4 py-3 font-medium">Staff</th>
                  <th className="px-4 py-3 font-medium text-right">Customers</th>
                  <th className="px-4 py-3 font-medium text-right">Unread chats</th>
                  <th className="px-4 py-3 font-medium text-right">Replies today</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.staff ?? []).map((st) => (
                  <tr key={st.userId} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      <Link to={`/inbox?staffId=${st.userId}`} className="hover:text-blue-600">{st.fullName}</Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{st.customers}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${st.unreadChats > 0 ? "text-red-600 font-semibold" : ""}`}>{st.unreadChats}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{st.repliesToday}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        st.isActive === "T" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                            : "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400"}`}>
                        {st.isActive === "T" ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
