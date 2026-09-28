import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Contact, Plus, RefreshCw, Search, X, Pencil, Trash2, MessagesSquare, Mail, Target } from "lucide-react";
import { CustomerService } from "@/ServiceLayer/WhatsAppService/WhatsAppService";
import { StaffService } from "@/ServiceLayer/AuthService/AuthService";
import { useAuth } from "@/context/AuthContext";
import { Alerts, DeleteModal, inputCls, labelCls } from "@/components/common/ui";
import { apiError } from "@/lib/apiClient";
import { formatDate } from "@/lib/utils";
import { toDate, displayName } from "@/lib/time";

const emptyForm = { mobileNo: "", customerName: "", email: "" };

const STATE_LABEL = {
  ASK_NAME: { label: "Waiting for name", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  ASK_EMAIL: { label: "Waiting for email", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  DONE: { label: "Complete", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
};

export default function CustomersPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState([]);
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const load = async (f = filter) => {
    setLoading(true);
    try { setRows(await CustomerService.getAll({ search: search || undefined, filter: f || undefined })); }
    catch { setError("Failed to load customers."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    if (isAdmin) StaffService.getAll().then((r) => setStaff(r.filter((s) => s.isActive === "T"))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const openAdd = () => { setEditId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (c) => {
    setEditId(c.customerId);
    setForm({ mobileNo: c.mobileNo ?? "", customerName: c.customerName ?? "", email: c.email ?? "" });
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const mobileNo = form.mobileNo.replace(/[^\d]/g, "");
    const email = form.email.trim();
    if (!mobileNo && !email) { setError("Enter a mobile number or an email ID."); return; }
    setSaving(true); setError("");
    const payload = { mobileNo: mobileNo || null, customerName: form.customerName.trim() || null, email: email || null };
    try {
      if (editId) { await CustomerService.update(editId, payload); setSuccess("Customer updated."); }
      else { await CustomerService.create(payload); setSuccess("Customer added."); }
      setShowForm(false); setEditId(null); setForm(emptyForm); load();
    } catch (err) {
      setError(apiError(err, "Failed to save customer."));
    } finally { setSaving(false); }
  };

  const assign = async (c, value) => {
    try {
      const updated = await CustomerService.assign(c.customerId, value ? Number(value) : null);
      setRows((rs) => rs.map((r) => (r.customerId === c.customerId ? updated : r)));
      setSuccess(updated.assignedToName ? `${displayName(updated)} assigned to ${updated.assignedToName}.` : "Customer unassigned.");
    } catch (err) { setError(apiError(err, "Failed to assign customer.")); }
  };

  const confirmDelete = async () => {
    try { await CustomerService.remove(deleteTarget.customerId); setSuccess("Customer deleted."); }
    catch { setError("Failed to delete customer."); }
    finally { setDeleteTarget(null); load(); }
  };

  const changeFilter = (f) => { setFilter(f); load(f); };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600/10 p-2"><Contact className="h-6 w-6 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isAdmin ? "Customers" : "My Customers"}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isAdmin ? "Everyone who contacted you on WhatsApp or email" : "Customers assigned to you"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load()} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          {isAdmin && (
            <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium">
              <Plus className="h-4 w-4" /> Add Customer
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search mobile, name or email..." className={`${inputCls} pl-9`} />
        </div>
        {isAdmin && (
          <select value={filter} onChange={(e) => changeFilter(e.target.value)} className={`${inputCls.replace("w-full ", "")} w-44`}>
            <option value="">All customers</option>
            <option value="unassigned">Unassigned</option>
            <option value="assigned">Assigned</option>
          </select>
        )}
        <button onClick={() => load()} className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">Apply</button>
      </div>

      <Alerts success={success} error={error} onClearSuccess={() => setSuccess("")} onClearError={() => setError("")} />

      {showForm && (
        <form onSubmit={submit} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editId ? "Edit Customer" : "New Customer"}</h2>
            <button type="button" onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Mobile No</label>
              <input value={form.mobileNo} onChange={set("mobileNo")} className={inputCls} placeholder="With country code, e.g. 919876543210" />
            </div>
            <div>
              <label className={labelCls}>Name</label>
              <input value={form.customerName} onChange={set("customerName")} maxLength={150} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email ID</label>
              <input type="email" value={form.email} onChange={set("email")} maxLength={150} className={inputCls} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-sm font-medium disabled:opacity-60">{saving ? "Saving..." : editId ? "Update" : "Save"}</button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
              <tr className="text-left text-gray-600 dark:text-gray-300">
                <th className="px-4 py-3 font-medium">Mobile No</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email ID</th>
                <th className="px-4 py-3 font-medium">WhatsApp Name</th>
                {isAdmin && <th className="px-4 py-3 font-medium">Assigned To</th>}
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr><td colSpan={isAdmin ? 8 : 7} className="px-4 py-10 text-center text-gray-400">No customers found.</td></tr>
              )}
              {rows.map((c) => {
                const st = STATE_LABEL[c.chatState] ?? STATE_LABEL.DONE;
                return (
                  <tr key={c.customerId} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{c.mobileNo ? `+${c.mobileNo}` : "—"}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{c.customerName || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.email || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.whatsappName || "—"}</td>
                    {isAdmin && (
                      <td className="px-4 py-2">
                        <select value={c.assignedTo ?? ""} onChange={(e) => assign(c, e.target.value)}
                          className={`${inputCls.replace("w-full ", "")} py-1.5 w-40 ${c.assignedTo ? "" : "border-amber-400 text-amber-700"}`}>
                          <option value="">Unassigned</option>
                          {staff.map((s) => <option key={s.userId} value={s.userId}>{s.fullName}</option>)}
                          {c.assignedTo && !staff.some((s) => s.userId === c.assignedTo) && (
                            <option value={c.assignedTo}>{c.assignedToName} (inactive)</option>
                          )}
                        </select>
                      </td>
                    )}
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(toDate(c.createdAt))}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/leads?new=1&customer=${c.customerId}`} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-blue-600" title="Create lead"><Target className="h-4 w-4" /></Link>
                        {c.mobileNo && (
                          <Link to={`/inbox?customer=${c.customerId}`} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-green-600" title="Open chat"><MessagesSquare className="h-4 w-4" /></Link>
                        )}
                        {c.email && (
                          <Link to={`/email-inbox?customer=${c.customerId}`} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-blue-600" title="Open emails"><Mail className="h-4 w-4" /></Link>
                        )}
                        <button onClick={() => openEdit(c)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-blue-600" title="Edit"><Pencil className="h-4 w-4" /></button>
                        {isAdmin && (
                          <button onClick={() => setDeleteTarget(c)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
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

      <DeleteModal open={!!deleteTarget} name={displayName(deleteTarget)}
        onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
    </div>
  );
}
