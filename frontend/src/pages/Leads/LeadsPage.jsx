import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Target, Plus, RefreshCw, Search, Trash2, CalendarClock, MessagesSquare, Mail, FileSpreadsheet, X } from "lucide-react";
import { LeadService } from "@/ServiceLayer/LeadService/LeadService";
import { CustomerService } from "@/ServiceLayer/WhatsAppService/WhatsAppService";
import { StaffService } from "@/ServiceLayer/AuthService/AuthService";
import { useAuth } from "@/context/AuthContext";
import { Alerts, DeleteModal, inputCls } from "@/components/common/ui";
import { apiError } from "@/lib/apiClient";
import { formatDate } from "@/lib/utils";
import { toDate, dateTime, displayName } from "@/lib/time";
import { LEAD_STATUSES, LEAD_SOURCES, PRIORITIES, labelOf, requirementSummary } from "@/lib/realEstate";
import LeadForm from "./LeadForm";

export const statusOf = (s) => LEAD_STATUSES.find((x) => x.value === s) ?? LEAD_STATUSES[0];
export const priorityOf = (p) => PRIORITIES.find((x) => x.value === p) ?? PRIORITIES[1];

const VIEWS = [
  { value: "open", label: "Open" },
  { value: "", label: "All" },
  { value: "overdue", label: "Overdue follow-up" },
  { value: "unassigned", label: "Unassigned", admin: true },
  { value: "closed", label: "Closed" },
];

export default function LeadsPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [filters, setFilters] = useState({ search: "", view: "open", status: "", priority: "", source: "", assignedTo: "" });
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [presetCustomer, setPresetCustomer] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selected, setSelected] = useState([]);
  const [bulkTarget, setBulkTarget] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const load = async (f = filters) => {
    setLoading(true);
    const q = Object.fromEntries(Object.entries(f).filter(([, v]) => v));
    try {
      const [list, c] = await Promise.all([LeadService.getAll(q), LeadService.counts()]);
      setRows(list); setCounts(c); setSelected([]);
    } catch { setError("Failed to load leads."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    if (isAdmin) StaffService.getAll().then((r) => setStaff(r.filter((s) => s.isActive === "T"))).catch(() => {});
    // Customers page "Create lead" opens the form with that customer chosen.
    const customerId = params.get("customer");
    if (params.get("new")) {
      if (customerId) {
        CustomerService.getAll({}).then((list) => {
          setPresetCustomer(list.find((c) => String(c.customerId) === customerId) ?? null);
          setShowForm(true);
        }).catch(() => setShowForm(true));
      } else setShowForm(true);
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilter = (k, v) => {
    const next = { ...filters, [k]: v };
    // A picked status (e.g. Won) would be hidden by the "Open" view.
    if (k === "status" && v) next.view = "";
    setFilters(next);
    if (k !== "search") load(next);
  };

  const assign = async (l, value) => {
    try {
      const updated = await LeadService.assign(l.leadId, value ? Number(value) : null);
      setRows((rs) => rs.map((r) => (r.leadId === l.leadId ? updated : r)));
      setSuccess(updated.assignedToName ? `${updated.leadNo} assigned to ${updated.assignedToName}.` : `${updated.leadNo} unassigned.`);
    } catch (err) { setError(apiError(err, "Failed to assign lead.")); }
  };

  const confirmDelete = async () => {
    try { await LeadService.remove(deleteTarget.leadId); setSuccess(`${deleteTarget.leadNo} deleted.`); }
    catch { setError("Failed to delete lead."); }
    finally { setDeleteTarget(null); load(); }
  };

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allSelected = rows.length > 0 && selected.length === rows.length;

  // "rr" = round-robin across all active staff, "none" = unassign, otherwise one staff member.
  const bulkAssign = async () => {
    if (!bulkTarget) return;
    const userIds = bulkTarget === "rr" ? staff.map((s) => s.userId) : bulkTarget === "none" ? [] : [Number(bulkTarget)];
    try {
      const r = await LeadService.bulkAssign(selected, userIds);
      setSuccess(bulkTarget === "none" ? `${r.assigned} leads unassigned.`
        : bulkTarget === "rr" ? `${r.assigned} leads shared between ${userIds.length} staff.`
        : `${r.assigned} leads assigned to ${staff.find((s) => s.userId === userIds[0])?.fullName}.`);
      setBulkTarget(""); load();
    } catch (err) { setError(apiError(err, "Failed to assign leads.")); }
  };

  const countOf = (s) => counts.find((c) => c.status === s)?.leads ?? 0;
  const total = counts.reduce((a, c) => a + c.leads, 0);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600/10 p-2"><Target className="h-6 w-6 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isAdmin ? "Leads" : "My Leads"}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Buyer and tenant enquiries, from first contact to closed deal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load()} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          {isAdmin && (
            <Link to="/leads/import" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">
              <FileSpreadsheet className="h-4 w-4" /> Import
            </Link>
          )}
          <button onClick={() => { setPresetCustomer(null); setShowForm(true); }} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium">
            <Plus className="h-4 w-4" /> Add Lead
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => applyFilter("status", "")}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${!filters.status ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 dark:border-slate-700 text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-900"}`}>
          All statuses <span className="opacity-70">{total}</span>
        </button>
        {LEAD_STATUSES.map((s) => (
          <button key={s.value} onClick={() => applyFilter("status", filters.status === s.value ? "" : s.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${filters.status === s.value
              ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 dark:border-slate-700 text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800"}`}>
            {s.label} <span className="opacity-70">{countOf(s.value)}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={filters.search} onChange={(e) => applyFilter("search", e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Lead no, name, mobile, email, area..." className={`${inputCls} pl-9`} />
        </div>
        <select value={filters.view} onChange={(e) => applyFilter("view", e.target.value)} className={`${inputCls.replace("w-full ", "")} w-44`}>
          {VIEWS.filter((v) => !v.admin || isAdmin).map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
        </select>
        <select value={filters.priority} onChange={(e) => applyFilter("priority", e.target.value)} className={`${inputCls.replace("w-full ", "")} w-32`}>
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select value={filters.source} onChange={(e) => applyFilter("source", e.target.value)} className={`${inputCls.replace("w-full ", "")} w-40`}>
          <option value="">All sources</option>
          {LEAD_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {isAdmin && (
          <select value={filters.assignedTo} onChange={(e) => applyFilter("assignedTo", e.target.value)} className={`${inputCls.replace("w-full ", "")} w-40`}>
            <option value="">All agents</option>
            {staff.map((s) => <option key={s.userId} value={s.userId}>{s.fullName}</option>)}
          </select>
        )}
        <button onClick={() => load()} className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">Apply</button>
      </div>

      <Alerts success={success} error={error} onClearSuccess={() => setSuccess("")} onClearError={() => setError("")} />

      {showForm && (
        <LeadForm customer={presetCustomer} staff={staff} isAdmin={isAdmin} onError={setError}
          onCancel={() => setShowForm(false)}
          onSaved={(l) => { setShowForm(false); setError(""); navigate(`/leads/${l.leadId}`); }} />
      )}

      {isAdmin && selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5">
          <span className="text-sm font-medium text-blue-900 dark:text-blue-200">{selected.length} selected</span>
          <select value={bulkTarget} onChange={(e) => setBulkTarget(e.target.value)} className={`${inputCls.replace("w-full ", "")} py-1.5 w-60`}>
            <option value="">Assign to...</option>
            {staff.map((s) => <option key={s.userId} value={s.userId}>{s.fullName}</option>)}
            {staff.length > 1 && <option value="rr">Share equally between all staff</option>}
            <option value="none">Unassign</option>
          </select>
          <button onClick={bulkAssign} disabled={!bulkTarget} className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 text-sm font-medium disabled:opacity-50">Apply</button>
          <button onClick={() => setSelected([])} className="ml-auto inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900"><X className="h-4 w-4" /> Clear</button>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
              <tr className="text-left text-gray-600 dark:text-gray-300">
                {isAdmin && (
                  <th className="pl-4 py-3 w-8">
                    <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : rows.map((r) => r.leadId))} title="Select all" />
                  </th>
                )}
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Requirement</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">{isAdmin ? "Agent" : ""}</th>
                <th className="px-4 py-3 font-medium">Next Follow-up</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr><td colSpan={isAdmin ? 9 : 8} className="px-4 py-10 text-center text-gray-400">No leads found.</td></tr>
              )}
              {rows.map((l) => {
                const st = statusOf(l.status);
                const pr = priorityOf(l.priority);
                const due = toDate(l.nextFollowUpAt);
                const overdue = due && due < new Date();
                return (
                  <tr key={l.leadId} className={`border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors ${selected.includes(l.leadId) ? "bg-blue-50/60 dark:bg-blue-900/10" : ""}`}>
                    {isAdmin && (
                      <td className="pl-4 py-3"><input type="checkbox" checked={selected.includes(l.leadId)} onChange={() => toggle(l.leadId)} /></td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{l.leadNo}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${pr.cls}`}>{pr.label}</span>
                      </div>
                      <Link to={`/leads/${l.leadId}`} className="font-medium text-gray-900 dark:text-white hover:text-blue-600">{displayName(l) || "—"}</Link>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{[l.mobileNo && `+${l.mobileNo}`, l.email].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-xs">{requirementSummary(l)}</td>
                    <td className="px-4 py-3"><span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{labelOf(LEAD_SOURCES, l.source)}</td>
                    <td className="px-4 py-2">
                      {isAdmin && (
                        <select value={l.assignedTo ?? ""} onChange={(e) => assign(l, e.target.value)}
                          className={`${inputCls.replace("w-full ", "")} py-1.5 w-36 ${l.assignedTo ? "" : "border-amber-400 text-amber-700"}`}>
                          <option value="">Unassigned</option>
                          {staff.map((s) => <option key={s.userId} value={s.userId}>{s.fullName}</option>)}
                          {l.assignedTo && !staff.some((s) => s.userId === l.assignedTo) && (
                            <option value={l.assignedTo}>{l.assignedToName} (inactive)</option>
                          )}
                        </select>
                      )}
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap ${overdue ? "text-red-600 font-medium" : "text-gray-600 dark:text-gray-300"}`}>
                      {due ? <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{dateTime(l.nextFollowUpAt)}</span> : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{formatDate(toDate(l.createdAt))}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {l.mobileNo && (
                          <Link to={`/inbox?customer=${l.customerId}`} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-green-600" title="Open chat"><MessagesSquare className="h-4 w-4" /></Link>
                        )}
                        {l.email && (
                          <Link to={`/email-inbox?customer=${l.customerId}`} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-blue-600" title="Open emails"><Mail className="h-4 w-4" /></Link>
                        )}
                        {isAdmin && (
                          <button onClick={() => setDeleteTarget(l)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
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

      <DeleteModal open={!!deleteTarget} name={deleteTarget ? `${deleteTarget.leadNo} – ${displayName(deleteTarget)}` : ""}
        onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
    </div>
  );
}
