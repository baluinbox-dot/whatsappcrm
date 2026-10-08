import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, RefreshCw, CheckCircle2, MessagesSquare, Mail, Phone } from "lucide-react";
import { FollowUpService } from "@/ServiceLayer/LeadService/LeadService";
import { StaffService } from "@/ServiceLayer/AuthService/AuthService";
import { useAuth } from "@/context/AuthContext";
import { Alerts, inputCls } from "@/components/common/ui";
import { apiError } from "@/lib/apiClient";
import { dateTime, displayName } from "@/lib/time";
import { FOLLOW_UP_TYPES, labelOf } from "@/lib/realEstate";
import { statusOf } from "@/pages/Leads/LeadsPage";

const VIEWS = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "done", label: "Done (30 days)" },
];

export default function FollowUpsPage() {
  const { isAdmin, refreshUnread } = useAuth();
  const [view, setView] = useState("today");
  const [assignedTo, setAssignedTo] = useState("");
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ overdue: 0, today: 0 });
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const load = async (v = view, a = assignedTo) => {
    setLoading(true);
    try {
      const [list, c] = await Promise.all([
        FollowUpService.getAll({ view: v, assignedTo: a || undefined }),
        FollowUpService.counts(),
      ]);
      setRows(list); setCounts(c);
    } catch { setError("Failed to load follow-ups."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    // Start on Overdue when something is late.
    FollowUpService.counts().then((c) => {
      const start = c.overdue > 0 ? "overdue" : "today";
      setView(start); load(start);
    }).catch(() => load());
    if (isAdmin) StaffService.getAll().then((r) => setStaff(r.filter((s) => s.isActive === "T"))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const complete = async (e) => {
    e.preventDefault();
    try {
      await FollowUpService.complete(completing.id, completing.result.trim() || null);
      setSuccess("Follow-up done."); setCompleting(null); load(); refreshUnread();
    } catch (err) { setError(apiError(err, "Failed to update follow-up.")); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600/10 p-2"><CalendarClock className="h-6 w-6 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Follow-ups</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{isAdmin ? "Calls, viewings and meetings scheduled by the team" : "Your scheduled calls, viewings and meetings"}</p>
          </div>
        </div>
        <button onClick={() => load()} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
          {VIEWS.map((v) => {
            const n = v.value === "overdue" ? counts.overdue : v.value === "today" ? counts.today : null;
            return (
              <button key={v.value} onClick={() => { setView(v.value); load(v.value); }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === v.value ? "bg-blue-600 text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"}`}>
                {v.label}
                {n > 0 && (
                  <span className={`ml-1.5 rounded-full px-1.5 text-[10px] font-semibold ${view === v.value ? "bg-white/25" : v.value === "overdue" ? "bg-red-600 text-white" : "bg-blue-600 text-white"}`}>{n}</span>
                )}
              </button>
            );
          })}
        </div>
        {isAdmin && (
          <select value={assignedTo} onChange={(e) => { setAssignedTo(e.target.value); load(view, e.target.value); }} className={`${inputCls.replace("w-full ", "")} w-44`}>
            <option value="">All agents</option>
            {staff.map((s) => <option key={s.userId} value={s.userId}>{s.fullName}</option>)}
          </select>
        )}
      </div>

      <Alerts success={success} error={error} onClearSuccess={() => setSuccess("")} onClearError={() => setError("")} />

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
              <tr className="text-left text-gray-600 dark:text-gray-300">
                <th className="px-4 py-3 font-medium">{view === "done" ? "Was Due" : "Due"}</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                {isAdmin && <th className="px-4 py-3 font-medium">Agent</th>}
                <th className="px-4 py-3 font-medium text-right">{view === "done" ? "Done" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr><td colSpan={isAdmin ? 6 : 5} className="px-4 py-10 text-center text-gray-400">
                  {view === "overdue" ? "Nothing overdue. Well done." : "No follow-ups here."}
                </td></tr>
              )}
              {rows.map((f) => {
                const st = statusOf(f.leadStatus);
                return (
                  <tr key={f.followUpId} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors align-top">
                    <td className={`px-4 py-3 whitespace-nowrap font-medium ${view === "overdue" ? "text-red-600" : "text-gray-900 dark:text-white"}`}>{dateTime(f.dueAt)}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">{labelOf(FOLLOW_UP_TYPES, f.followUpType)}</td>
                    <td className="px-4 py-3">
                      <Link to={`/leads/${f.leadId}`} className="font-medium text-gray-900 dark:text-white hover:text-blue-600">{displayName(f) || f.leadNo}</Link>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-mono">{f.leadNo}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${st.cls}`}>{st.label}</span>
                      </div>
                      {f.mobileNo && <div className="text-xs text-gray-500 dark:text-gray-400">+{f.mobileNo}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-sm">
                      {f.propertyRef && <div className="text-xs text-blue-600">{f.propertyRef} · {f.propertyTitle}</div>}
                      {f.notes || (f.propertyRef ? "" : "—")}
                      {completing?.id === f.followUpId && (
                        <form onSubmit={complete} className="mt-2 flex gap-2">
                          <input autoFocus value={completing.result} onChange={(e) => setCompleting((c) => ({ ...c, result: e.target.value }))}
                            maxLength={2000} placeholder="What happened? (optional)" className={inputCls} />
                          <button type="submit" className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm font-medium">Save</button>
                          <button type="button" onClick={() => setCompleting(null)} className="rounded-lg border border-gray-300 dark:border-slate-700 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200">Cancel</button>
                        </form>
                      )}
                    </td>
                    {isAdmin && <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{f.assignedToName ?? "—"}</td>}
                    <td className="px-4 py-3">
                      {view === "done" ? (
                        <div className="text-right text-xs text-gray-500 dark:text-gray-400">{dateTime(f.doneAt)}<br />{f.doneByName}</div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          {f.mobileNo && <a href={`tel:+${f.mobileNo}`} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-blue-600" title="Call"><Phone className="h-4 w-4" /></a>}
                          {f.mobileNo && <Link to={`/inbox?customer=${f.customerId}`} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-green-600" title="Open chat"><MessagesSquare className="h-4 w-4" /></Link>}
                          {f.email && <Link to={`/email-inbox?customer=${f.customerId}`} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-blue-600" title="Open emails"><Mail className="h-4 w-4" /></Link>}
                          {completing?.id !== f.followUpId && (
                            <button onClick={() => setCompleting({ id: f.followUpId, result: "" })}
                              className="ml-1 inline-flex items-center gap-1 rounded-lg border border-green-300 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Done
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
