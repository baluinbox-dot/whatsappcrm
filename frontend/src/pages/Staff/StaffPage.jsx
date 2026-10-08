import { useEffect, useState } from "react";
import { Users, Plus, RefreshCw, Search, X, Pencil, KeyRound } from "lucide-react";
import { StaffService } from "@/ServiceLayer/AuthService/AuthService";
import { useAuth } from "@/context/AuthContext";
import { Alerts, inputCls, labelCls } from "@/components/common/ui";
import { apiError } from "@/lib/apiClient";
import { dateTime } from "@/lib/time";

const emptyForm = { fullName: "", email: "", mobileNo: "", role: "STAFF", isActive: "T", password: "" };

export default function StaffPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try { setRows(await StaffService.getAll(search || undefined)); }
    catch { setError("Failed to load staff."); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const openAdd = () => { setEditId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (s) => {
    setEditId(s.userId);
    setForm({ fullName: s.fullName, email: s.email ?? "", mobileNo: s.mobileNo ?? "", role: s.role, isActive: s.isActive, password: "" });
    setShowForm(true);
  };
  const isSelf = editId === user?.userId;

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const mobile = form.mobileNo.replace(/[^\d]/g, "");
    if (!form.fullName.trim()) { setError("Name is required."); return; }
    if (form.role === "ADMIN" && !form.email.trim()) { setError("Email is required for an admin — admins sign in with email."); return; }
    if (form.role === "STAFF" && !mobile) { setError("Mobile number is required for staff — they sign in with it."); return; }
    if (!editId && form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setSaving(true); setError("");
    const payload = {
      fullName: form.fullName.trim(),
      email: form.email.trim() || null,
      mobileNo: mobile || null,
      role: form.role,
      isActive: form.isActive,
      password: form.password || null,
    };
    try {
      if (editId) { await StaffService.update(editId, payload); setSuccess("Staff member updated."); }
      else {
        await StaffService.create(payload);
        setSuccess(form.role === "STAFF"
          ? `Staff member added. They sign in on the Staff tab with admin email ${user?.email}, mobile ${mobile} and the password you set.`
          : "Admin added. They sign in on the Admin tab with their email and password.");
      }
      setShowForm(false); setEditId(null); setForm(emptyForm); load();
    } catch (err) {
      setError(apiError(err, "Failed to save staff member."));
    } finally { setSaving(false); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600/10 p-2"><Users className="h-6 w-6 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Staff</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Admins and staff who can sign in for {user?.companyName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium">
            <Plus className="h-4 w-4" /> Add Staff
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search name, email or mobile..." className={`${inputCls} pl-9`} />
        </div>
        <button onClick={load} className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">Apply</button>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 px-4 py-2.5 text-sm text-blue-800 dark:text-blue-200">
        <b>How staff sign in:</b> on the <b>Staff</b> tab of the login page with admin email <b>{user?.email}</b>, their own mobile number and password.
        Admins sign in on the <b>Admin</b> tab with their email.
      </div>

      <Alerts success={success} error={error} onClearSuccess={() => setSuccess("")} onClearError={() => setError("")} />

      {showForm && (
        <form onSubmit={submit} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editId ? "Edit Staff" : "New Staff"}</h2>
            <button type="button" onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Full Name *</label>
              <input value={form.fullName} onChange={set("fullName")} maxLength={150} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Mobile {form.role === "STAFF" && "*"}</label>
              <input value={form.mobileNo} onChange={set("mobileNo")} maxLength={20} className={inputCls} placeholder="With country code, e.g. 919876543210" />
            </div>
            <div>
              <label className={labelCls}>Email {form.role === "ADMIN" ? "*" : "(optional)"}</label>
              <input type="email" value={form.email} onChange={set("email")} maxLength={150} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Role</label>
              <select value={form.role} onChange={set("role")} disabled={isSelf} className={inputCls}>
                <option value="STAFF">Staff — sees only assigned customers</option>
                <option value="ADMIN">Admin — sees everything, assigns customers</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.isActive} onChange={set("isActive")} disabled={isSelf} className={inputCls}>
                <option value="T">Active</option>
                <option value="F">Inactive — cannot sign in</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{editId ? "Reset Password" : "Password *"}</label>
              <input type="password" value={form.password} onChange={set("password")} autoComplete="new-password" className={inputCls}
                placeholder={editId ? "Leave blank to keep current" : "Min 6 characters"} />
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
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Mobile</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium text-right">Customers</th>
                <th className="px-4 py-3 font-medium">Last Sign In</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No staff found.</td></tr>
              )}
              {rows.map((s) => (
                <tr key={s.userId} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {s.fullName}{s.userId === user?.userId && <span className="ml-1 text-xs text-gray-400">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{s.email || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{s.mobileNo ? `+${s.mobileNo}` : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.role === "ADMIN" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-300"}`}>
                      {s.role === "ADMIN" ? "Admin" : "Staff"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.assignedCustomers}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {s.hasPassword === "T" ? (dateTime(s.lastLoginAt) || "Never") : <span className="inline-flex items-center gap-1 text-amber-600"><KeyRound className="h-3 w-3" /> No password</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.isActive === "T" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                         : "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400"}`}>
                      {s.isActive === "T" ? "Active" : "Inactive"}
                    </span>
                    {s.isActive !== "T" && s.assignedCustomers > 0 && (
                      <div className="text-[11px] text-amber-600 mt-0.5">Reassign their customers</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(s)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-blue-600" title="Edit"><Pencil className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
