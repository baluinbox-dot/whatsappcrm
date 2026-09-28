import { useEffect, useState } from "react";
import { BriefcaseBusiness, Plus, RefreshCw, Search, X, Pencil, Trash2 } from "lucide-react";
import { ServiceCatalogService } from "@/ServiceLayer/PropertyService/PropertyService";
import { useAuth } from "@/context/AuthContext";
import { Alerts, DeleteModal, inputCls, labelCls } from "@/components/common/ui";
import { apiError } from "@/lib/apiClient";
import { SERVICE_CATEGORIES, formatAed } from "@/lib/realEstate";

const emptyForm = { serviceName: "", category: SERVICE_CATEGORIES[0], price: "", priceNote: "", description: "", isActive: "T" };

export default function ServicesPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const load = async (cat = category) => {
    setLoading(true);
    try { setRows(await ServiceCatalogService.getAll({ search: search || undefined, category: cat || undefined })); }
    catch { setError("Failed to load services."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const openAdd = () => { setEditId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (s) => {
    setEditId(s.serviceId);
    setForm({
      serviceName: s.serviceName, category: s.category, price: s.price ?? "", priceNote: s.priceNote ?? "",
      description: s.description ?? "", isActive: s.isActive,
    });
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.serviceName.trim()) { setError("Service name is required."); return; }
    setSaving(true); setError("");
    const payload = { ...form, priceNote: form.priceNote.trim() || null, description: form.description.trim() || null, price: form.price === "" ? null : Number(form.price) };
    try {
      if (editId) { await ServiceCatalogService.update(editId, payload); setSuccess("Service updated."); }
      else { await ServiceCatalogService.create(payload); setSuccess("Service added."); }
      setShowForm(false); setEditId(null); setForm(emptyForm); load();
    } catch (err) {
      setError(apiError(err, "Failed to save service."));
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    try { await ServiceCatalogService.remove(deleteTarget.serviceId); setSuccess("Service deleted."); }
    catch { setError("Failed to delete service."); }
    finally { setDeleteTarget(null); load(); }
  };

  const changeCategory = (c) => { setCategory(c); load(c); };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600/10 p-2"><BriefcaseBusiness className="h-6 w-6 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Services</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Property management, mortgage, Golden Visa and other services you offer</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load()} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          {isAdmin && (
            <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium">
              <Plus className="h-4 w-4" /> Add Service
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search service..." className={`${inputCls} pl-9`} />
        </div>
        <select value={category} onChange={(e) => changeCategory(e.target.value)} className={`${inputCls.replace("w-full ", "")} w-52`}>
          <option value="">All categories</option>
          {SERVICE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => load()} className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">Apply</button>
      </div>

      <Alerts success={success} error={error} onClearSuccess={() => setSuccess("")} onClearError={() => setError("")} />

      {showForm && (
        <form onSubmit={submit} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editId ? "Edit Service" : "New Service"}</h2>
            <button type="button" onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Service Name *</label>
              <input value={form.serviceName} onChange={set("serviceName")} maxLength={150} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Category *</label>
              <select value={form.category} onChange={set("category")} className={inputCls}>
                {SERVICE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.isActive} onChange={set("isActive")} className={inputCls}>
                <option value="T">Active</option>
                <option value="F">Inactive</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Price (AED)</label>
              <input type="number" min="0" step="0.01" value={form.price} onChange={set("price")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Price Note</label>
              <input value={form.priceNote} onChange={set("priceNote")} maxLength={50} className={inputCls} placeholder="e.g. per year, 5% of annual rent" />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className={labelCls}>Description</label>
              <textarea value={form.description} onChange={set("description")} rows={3} maxLength={2000} className={inputCls} />
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
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {isAdmin && <th className="px-4 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr><td colSpan={isAdmin ? 6 : 5} className="px-4 py-10 text-center text-gray-400">No services found.</td></tr>
              )}
              {rows.map((s) => (
                <tr key={s.serviceId} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{s.serviceName}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{s.category}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">
                    {s.price !== null ? formatAed(s.price) : "—"}
                    {s.priceNote && <span className="text-xs text-gray-500 dark:text-gray-400"> {s.priceNote}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-md"><span className="line-clamp-2">{s.description || "—"}</span></td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.isActive === "T"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-gray-300"}`}>
                      {s.isActive === "T" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(s)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-blue-600" title="Edit"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => setDeleteTarget(s)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DeleteModal open={!!deleteTarget} name={deleteTarget?.serviceName}
        onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
    </div>
  );
}
