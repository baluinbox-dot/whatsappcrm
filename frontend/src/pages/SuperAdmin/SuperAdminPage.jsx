import { useEffect, useState } from "react";
import { ShieldAlert, RefreshCw, Search, CheckCircle2, Ban, RotateCcw } from "lucide-react";
import { SuperAdminService } from "@/ServiceLayer/AuthService/AuthService";
import { useAuth } from "@/context/AuthContext";
import { Alerts, inputCls } from "@/components/common/ui";
import { apiError } from "@/lib/apiClient";
import { dateTime } from "@/lib/time";

const STATUS = {
  PENDING: { label: "Pending", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  ACTIVE: { label: "Active", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  SUSPENDED: { label: "Suspended", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

export default function SuperAdminPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const load = async (s = status) => {
    setLoading(true);
    try { setRows(await SuperAdminService.companies({ search: search || undefined, status: s || undefined })); }
    catch { setError("Failed to load companies."); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const apply = async (company, next) => {
    try {
      await SuperAdminService.setStatus(company.companyId, next);
      setSuccess(`${company.companyName} is now ${STATUS[next].label.toLowerCase()}.`);
      load();
    } catch (err) { setError(apiError(err, "Failed to update company.")); }
    finally { setConfirm(null); }
  };

  const counts = rows.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-red-600/10 p-2"><ShieldAlert className="h-6 w-6 text-red-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Super Admin</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Approve, suspend and monitor every company</p>
          </div>
        </div>
        <button onClick={() => load()} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search company or admin email..." className={`${inputCls} pl-9`} />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); load(e.target.value); }} className={`${inputCls.replace("w-full ", "")} w-44`}>
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <button onClick={() => load()} className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">Apply</button>
        {!status && counts.PENDING > 0 && (
          <span className="text-sm font-medium text-amber-600">{counts.PENDING} waiting for approval</span>
        )}
      </div>

      <Alerts success={success} error={error} onClearSuccess={() => setSuccess("")} onClearError={() => setError("")} />

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
              <tr className="text-left text-gray-600 dark:text-gray-300">
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Admin</th>
                <th className="px-4 py-3 font-medium">WhatsApp</th>
                <th className="px-4 py-3 font-medium text-right">Users</th>
                <th className="px-4 py-3 font-medium text-right">Customers</th>
                <th className="px-4 py-3 font-medium text-right">Messages</th>
                <th className="px-4 py-3 font-medium">Registered</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No companies found.</td></tr>
              )}
              {rows.map((c) => {
                const st = STATUS[c.status] ?? STATUS.PENDING;
                const own = c.companyId === user?.companyId;
                return (
                  <tr key={c.companyId} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{c.companyName}{own && <span className="ml-1 text-xs text-gray-400">(yours)</span>}</div>
                      <div className="font-mono text-[11px] text-gray-400">{c.companyCode}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900 dark:text-white">{c.adminName || "—"}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{c.adminEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.displayNumber || "Not set"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.users}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.customers}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.messages}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{dateTime(c.createdAt)}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {c.status !== "ACTIVE" && (
                          <button onClick={() => apply(c, "ACTIVE")}
                            className="inline-flex items-center gap-1 rounded-md bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 text-xs font-medium">
                            {c.status === "PENDING" ? <><CheckCircle2 className="h-3.5 w-3.5" /> Approve</> : <><RotateCcw className="h-3.5 w-3.5" /> Reactivate</>}
                          </button>
                        )}
                        {c.status !== "SUSPENDED" && !own && (
                          <button onClick={() => setConfirm(c)}
                            className="inline-flex items-center gap-1 rounded-md border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2.5 py-1 text-xs font-medium">
                            <Ban className="h-3.5 w-3.5" /> {c.status === "PENDING" ? "Reject" : "Suspend"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Suspend {confirm.companyName}?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Its admins and staff will be signed out and can't sign in, and incoming WhatsApp messages will be ignored until you reactivate it.
              No data is deleted.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setConfirm(null)} className="rounded-lg border border-gray-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={() => apply(confirm, "SUSPENDED")} className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-medium">Suspend</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
