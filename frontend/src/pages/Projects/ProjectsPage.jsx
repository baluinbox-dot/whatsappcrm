import { useEffect, useState } from "react";
import { Landmark, Plus, RefreshCw, Search, X, Pencil, Trash2, MapPin } from "lucide-react";
import { ProjectService } from "@/ServiceLayer/PropertyService/PropertyService";
import { useAuth } from "@/context/AuthContext";
import { Alerts, DeleteModal, inputCls, labelCls } from "@/components/common/ui";
import { apiError } from "@/lib/apiClient";
import { toInputDate } from "@/lib/utils";
import {
  EMIRATES, PROJECT_TYPES, COMPLETIONS, AMENITIES, COMMUNITIES, labelOf, formatAed,
} from "@/lib/realEstate";

const emptyForm = {
  projectName: "", description: "", projectType: "COMMUNITY", developer: "", emirate: "Dubai", community: "", mapUrl: "",
  completion: "OFFPLAN", handoverDate: "", completionPct: "", amenities: [], downPaymentPct: "", paymentPlan: "",
  isActive: "T", payments: [],
};

const emptyStep = { label: "", percentDue: "", dueNote: "" };

const toForm = (p) => {
  const f = { ...emptyForm };
  Object.keys(emptyForm).forEach((k) => { if (p[k] !== null && p[k] !== undefined) f[k] = typeof p[k] === "number" ? String(p[k]) : p[k]; });
  f.amenities = p.amenities ? p.amenities.split(",").map((a) => a.trim()).filter(Boolean) : [];
  f.handoverDate = toInputDate(p.handoverDate);
  f.payments = p.payments.map((s) => ({ label: s.label, percentDue: String(s.percentDue), dueNote: s.dueNote ?? "" }));
  return f;
};

const toPayload = (f) => {
  const p = { ...f, amenities: f.amenities.join(", ") };
  Object.keys(p).forEach((k) => { if (typeof p[k] === "string" && !p[k].trim()) p[k] = null; });
  p.completionPct = f.completionPct === "" ? null : Number(f.completionPct);
  p.downPaymentPct = f.downPaymentPct === "" ? null : Number(f.downPaymentPct);
  p.payments = f.payments.map((s) => ({ label: s.label, percentDue: Number(s.percentDue) || 0, dueNote: s.dueNote.trim() || null }));
  return p;
};

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3 pb-1 border-b border-gray-100 dark:border-slate-800">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">{children}</div>
    </div>
  );
}

function Field({ label, span, children }) {
  return (
    <div className={span === 2 ? "md:col-span-2" : span === 4 ? "md:col-span-2 lg:col-span-4" : ""}>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options, blank }) {
  return (
    <select value={value} onChange={onChange} className={inputCls}>
      {blank !== undefined && <option value="">{blank}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export default function ProjectsPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ search: "", emirate: "", completion: "" });
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const load = async (f = filters) => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v));
    try { setRows(await ProjectService.getAll(params)); }
    catch { setError("Failed to load projects."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setFilter = (k) => (e) => {
    const next = { ...filters, [k]: e.target.value };
    setFilters(next);
    if (k !== "search") load(next);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleAmenity = (a) => setForm((f) => ({
    ...f, amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a],
  }));
  const setStep = (i, k) => (e) => setForm((f) => ({ ...f, payments: f.payments.map((s, j) => (j === i ? { ...s, [k]: e.target.value } : s)) }));
  const addStep = () => setForm((f) => ({ ...f, payments: [...f.payments, { ...emptyStep }] }));
  const removeStep = (i) => setForm((f) => ({ ...f, payments: f.payments.filter((_, j) => j !== i) }));

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowForm(true); setError(""); };
  const openEdit = async (p) => {
    try {
      const full = await ProjectService.get(p.projectId);
      setEditing(full); setForm(toForm(full)); setShowForm(true); setError("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { setError("Failed to open project."); }
  };
  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm); };

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.projectName.trim()) { setError("Project name is required."); return; }
    setSaving(true); setError("");
    try {
      const saved = editing
        ? await ProjectService.update(editing.projectId, toPayload(form))
        : await ProjectService.create(toPayload(form));
      setSuccess(`${saved.projectNo} ${editing ? "updated" : "saved"}.`);
      closeForm();
      load();
    } catch (err) {
      setError(apiError(err, "Failed to save project."));
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    try { await ProjectService.remove(deleteTarget.projectId); setSuccess(`${deleteTarget.projectNo} deleted.`); }
    catch { setError("Failed to delete project."); }
    finally { setDeleteTarget(null); load(); }
  };

  const scheduleTotal = form.payments.reduce((n, s) => n + (Number(s.percentDue) || 0), 0);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600/10 p-2"><Landmark className="h-6 w-6 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Projects</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Developments with their amenities and price plan. Properties are linked to a project.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load()} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          {isAdmin && (
            <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium">
              <Plus className="h-4 w-4" /> Add Project
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={filters.search} onChange={setFilter("search")} onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Project no, name, community, developer..." className={`${inputCls} pl-9`} />
        </div>
        <select value={filters.emirate} onChange={setFilter("emirate")} className={`${inputCls.replace("w-full ", "")} w-40`}>
          <option value="">All emirates</option>
          {EMIRATES.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={filters.completion} onChange={setFilter("completion")} className={`${inputCls.replace("w-full ", "")} w-36`}>
          <option value="">Ready & Off-Plan</option>
          {COMPLETIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={() => load()} className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">Apply</button>
      </div>

      <Alerts success={success} error={error} onClearSuccess={() => setSuccess("")} onClearError={() => setError("")} />

      {showForm && (
        <form onSubmit={submit} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-5 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editing ? `Edit ${editing.projectNo}` : "New Project"}</h2>
            <button type="button" onClick={closeForm}><X className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
          </div>

          <Section title="Project">
            <Field label="Project Name *" span={2}>
              <input value={form.projectName} onChange={set("projectName")} maxLength={200} className={inputCls} placeholder="e.g. Damac Lagoons Santorini" />
            </Field>
            <Field label="Project Type *"><Select value={form.projectType} onChange={set("projectType")} options={PROJECT_TYPES} /></Field>
            <Field label="Status">
              <Select value={form.isActive} onChange={set("isActive")} options={[{ value: "T", label: "Active" }, { value: "F", label: "Inactive" }]} />
            </Field>
            <Field label="Developer"><input value={form.developer} onChange={set("developer")} maxLength={150} className={inputCls} placeholder="e.g. Emaar, Damac, Nakheel" /></Field>
            <Field label="Ready / Off-Plan"><Select value={form.completion} onChange={set("completion")} options={COMPLETIONS} /></Field>
            {form.completion === "OFFPLAN" && (
              <>
                <Field label="Handover Date"><input type="date" value={form.handoverDate} onChange={set("handoverDate")} className={inputCls} /></Field>
                <Field label="Construction Completion %"><input type="number" min="0" max="100" value={form.completionPct} onChange={set("completionPct")} className={inputCls} /></Field>
              </>
            )}
            <Field label="Description" span={4}>
              <textarea value={form.description} onChange={set("description")} rows={4} className={inputCls} placeholder="Describe the project, highlights, nearby landmarks..." />
            </Field>
          </Section>

          <Section title="Location">
            <Field label="Emirate *">
              <select value={form.emirate} onChange={set("emirate")} className={inputCls}>
                {EMIRATES.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </Field>
            <Field label="Community / Area">
              <input value={form.community} onChange={set("community")} list="project-community-list" maxLength={150} className={inputCls} />
              <datalist id="project-community-list">
                {(COMMUNITIES[form.emirate] ?? []).map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <Field label="Google Maps Link" span={2}>
              <input value={form.mapUrl} onChange={set("mapUrl")} maxLength={500} className={inputCls} placeholder="https://maps.google.com/..." />
            </Field>
          </Section>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3 pb-1 border-b border-gray-100 dark:border-slate-800">Amenities</h3>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map((a) => {
                const on = form.amenities.includes(a);
                return (
                  <button type="button" key={a} onClick={() => toggleAmenity(a)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-300 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"}`}>
                    {a}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3 pb-1 border-b border-gray-100 dark:border-slate-800">Price Plan</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <Field label="Down Payment %">
                <input type="number" min="0" max="100" step="0.01" value={form.downPaymentPct} onChange={set("downPaymentPct")} className={inputCls} />
              </Field>
              <Field label="Plan Summary">
                <input value={form.paymentPlan} onChange={set("paymentPlan")} maxLength={100} className={inputCls} placeholder="e.g. 60/40, 1% monthly" />
              </Field>
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Payment Schedule (step-down payments)</span>
              <button type="button" onClick={addStep} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                <Plus className="h-3.5 w-3.5" /> Add step
              </button>
            </div>
            {form.payments.length === 0 ? (
              <p className="text-xs text-gray-400">No steps yet, e.g. On booking 10%, During construction 50%, On handover 40%.</p>
            ) : (
              <div className="space-y-2">
                {form.payments.map((s, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <span className="col-span-1 text-xs text-gray-500 text-center">{i + 1}</span>
                    <input value={s.label} onChange={setStep(i, "label")} maxLength={100} placeholder="Step, e.g. On booking" className={`${inputCls} col-span-5`} />
                    <input type="number" min="0" max="100" step="0.01" value={s.percentDue} onChange={setStep(i, "percentDue")} placeholder="%" className={`${inputCls} col-span-2`} />
                    <input value={s.dueNote} onChange={setStep(i, "dueNote")} maxLength={100} placeholder="When, e.g. within 30 days" className={`${inputCls} col-span-3`} />
                    <button type="button" onClick={() => removeStep(i)} className="col-span-1 flex justify-center text-gray-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                  </div>
                ))}
                <p className={`text-xs ${scheduleTotal === 100 ? "text-green-600" : "text-amber-600"}`}>Total {scheduleTotal}% (must be 100%)</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeForm} className="rounded-lg border border-gray-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-sm font-medium disabled:opacity-60">
              {saving ? "Saving..." : editing ? "Update" : "Save Project"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
              <tr className="text-left text-gray-600 dark:text-gray-300">
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Price Plan</th>
                <th className="px-4 py-3 font-medium">Properties</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No projects found.</td></tr>
              )}
              {rows.map((p) => (
                <tr key={p.projectId} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-gray-500 dark:text-gray-400">{p.projectNo}{p.isActive === "F" ? " · Inactive" : ""}</div>
                    <button onClick={() => openEdit(p)} className="block max-w-xs truncate text-left font-medium text-gray-900 dark:text-white hover:text-blue-600">{p.projectName}</button>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{[p.developer, labelOf(COMPLETIONS, p.completion)].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    <div className="flex items-start gap-1">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-400" />
                      <div>
                        <div>{p.community || "—"}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{p.emirate}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{labelOf(PROJECT_TYPES, p.projectType)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    <div>{p.paymentPlan || "—"}</div>
                    {p.downPaymentPct !== null && <div className="text-xs text-gray-500 dark:text-gray-400">{p.downPaymentPct}% down payment</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    <div>{p.propertyCount}</div>
                    {p.minPrice !== null && <div className="text-xs text-gray-500 dark:text-gray-400">{formatAed(p.minPrice)}{p.maxPrice !== p.minPrice ? ` – ${formatAed(p.maxPrice)}` : ""}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-blue-600" title="Edit"><Pencil className="h-4 w-4" /></button>
                      {isAdmin && (
                        <button onClick={() => setDeleteTarget(p)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DeleteModal open={!!deleteTarget} name={deleteTarget ? `${deleteTarget.projectNo} – ${deleteTarget.projectName}` : ""}
        onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
    </div>
  );
}
