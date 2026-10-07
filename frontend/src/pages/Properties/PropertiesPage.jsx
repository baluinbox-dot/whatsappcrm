import { useEffect, useState } from "react";
import { Building2, Plus, RefreshCw, Search, X, Pencil, Trash2, ImageOff, Star, MapPin, ExternalLink, Link2 } from "lucide-react";
import { PropertyService, ProjectService } from "@/ServiceLayer/PropertyService/PropertyService";
import { StaffService } from "@/ServiceLayer/AuthService/AuthService";
import { useAuth } from "@/context/AuthContext";
import { Alerts, DeleteModal, inputCls, labelCls } from "@/components/common/ui";
import { apiError } from "@/lib/apiClient";
import { toInputDate } from "@/lib/utils";
import {
  EMIRATES, PURPOSES, PROPERTY_TYPES, PROPERTY_STATUSES, COMPLETIONS, FURNISHINGS, BEDROOMS, CHEQUES, AMENITIES,
  COMMUNITIES, labelOf, bedroomsLabel, formatNumber, formatAed, priceLabel, fileUrl,
} from "@/lib/realEstate";
import PropertyMedia from "./PropertyMedia";

const emptyForm = {
  title: "", purpose: "SALE", propertyType: "APARTMENT", completion: "READY", status: "AVAILABLE",
  emirate: "Dubai", community: "", subCommunity: "", developer: "", mapUrl: "",
  bedrooms: "", bathrooms: "", buaSqft: "", plotSqft: "", parking: "", viewType: "", floorNo: "",
  price: "", rentFrequency: "YEARLY", cheques: "", serviceCharge: "", commissionPct: "",
  handoverDate: "", paymentPlan: "", completionPct: "",
  permitNo: "", titleDeedNo: "", ownerName: "", ownerMobile: "", ownerEmail: "",
  furnishing: "", amenities: [], description: "", isFeatured: "F", agentId: "", projectId: "",
};

const NUMBER_FIELDS = ["bedrooms", "bathrooms", "buaSqft", "plotSqft", "parking", "price", "cheques", "serviceCharge", "commissionPct", "completionPct", "agentId", "projectId"];

const toForm = (p) => {
  const f = { ...emptyForm };
  Object.keys(emptyForm).forEach((k) => { if (p[k] !== null && p[k] !== undefined) f[k] = typeof p[k] === "number" ? String(p[k]) : p[k]; });
  f.amenities = p.amenities ? p.amenities.split(",").map((a) => a.trim()).filter(Boolean) : [];
  f.handoverDate = toInputDate(p.handoverDate);
  return f;
};

const toPayload = (f) => {
  const p = { ...f, amenities: f.amenities.join(", ") };
  Object.keys(p).forEach((k) => { if (typeof p[k] === "string" && !p[k].trim()) p[k] = null; });
  NUMBER_FIELDS.forEach((k) => { p[k] = f[k] === "" ? null : Number(f[k]); });
  return p;
};

const statusOf = (s) => PROPERTY_STATUSES.find((x) => x.value === s) ?? PROPERTY_STATUSES[0];

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

export default function PropertiesPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState([]);
  const [staff, setStaff] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState({ search: "", purpose: "", propertyType: "", emirate: "", status: "" });
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
    try { setRows(await PropertyService.getAll(params)); }
    catch { setError("Failed to load properties."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    ProjectService.getAll().then((r) => setProjects(r.filter((p) => p.isActive === "T"))).catch(() => {});
    if (isAdmin) StaffService.getAll().then((r) => setStaff(r.filter((s) => s.isActive === "T"))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setFilter = (k) => (e) => {
    const next = { ...filters, [k]: e.target.value };
    setFilters(next);
    if (k !== "search") load(next);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const project = projects.find((p) => String(p.projectId) === String(form.projectId));
  const toggleAmenity = (a) => setForm((f) => ({
    ...f, amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a],
  }));

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowForm(true); setError(""); };
  const openEdit = async (p) => {
    try {
      const full = await PropertyService.get(p.propertyId);
      setEditing(full); setForm(toForm(full)); setShowForm(true); setError("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { setError("Failed to open property."); }
  };
  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm); };

  const refreshEditing = async () => {
    const full = await PropertyService.get(editing.propertyId);
    setEditing(full);
    load();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.title.trim()) { setError("Title is required."); return; }
    if (!form.price || Number(form.price) <= 0) { setError("Enter the price in AED."); return; }
    setSaving(true); setError("");
    const payload = toPayload(form);
    if (project) Object.assign(payload, { emirate: project.emirate, completion: project.completion });
    try {
      if (editing) {
        const saved = await PropertyService.update(editing.propertyId, payload);
        setSuccess(`${saved.refNo} updated.`);
        closeForm();
      } else {
        const saved = await PropertyService.create(payload);
        // Stay in the form so photos can be added straight away.
        setEditing(saved); setForm(toForm(saved));
        setSuccess(`${saved.refNo} saved. Now add photos, floor plans and the brochure below.`);
      }
      load();
    } catch (err) {
      setError(apiError(err, "Failed to save property."));
    } finally { setSaving(false); }
  };

  const copyLink = async (p) => {
    try { await navigator.clipboard.writeText(p.publicUrl); setSuccess(`Public link for ${p.refNo} copied.`); }
    catch { setError(`Could not copy. The link is: ${p.publicUrl}`); }
  };

  const confirmDelete = async () => {
    try { await PropertyService.remove(deleteTarget.propertyId); setSuccess(`${deleteTarget.refNo} deleted.`); }
    catch { setError("Failed to delete property."); }
    finally { setDeleteTarget(null); load(); }
  };

  const isRent = form.purpose === "RENT";
  const isOffPlan = form.completion === "OFFPLAN";
  const pricePerSqft = form.price && form.buaSqft ? Number(form.price) / Number(form.buaSqft) : null;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600/10 p-2"><Building2 className="h-6 w-6 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Properties</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Listings for sale and rent across the UAE</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load()} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium">
            <Plus className="h-4 w-4" /> Add Property
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={filters.search} onChange={setFilter("search")} onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Ref no, title, community, owner..." className={`${inputCls} pl-9`} />
        </div>
        <select value={filters.purpose} onChange={setFilter("purpose")} className={`${inputCls.replace("w-full ", "")} w-32`}>
          <option value="">Sale & Rent</option>
          {PURPOSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filters.propertyType} onChange={setFilter("propertyType")} className={`${inputCls.replace("w-full ", "")} w-40`}>
          <option value="">All types</option>
          {PROPERTY_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filters.emirate} onChange={setFilter("emirate")} className={`${inputCls.replace("w-full ", "")} w-40`}>
          <option value="">All emirates</option>
          {EMIRATES.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={filters.status} onChange={setFilter("status")} className={`${inputCls.replace("w-full ", "")} w-36`}>
          <option value="">All statuses</option>
          {PROPERTY_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={() => load()} className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">Apply</button>
      </div>

      <Alerts success={success} error={error} onClearSuccess={() => setSuccess("")} onClearError={() => setError("")} />

      {showForm && (
        <form onSubmit={submit} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-5 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editing ? `Edit ${editing.refNo}` : "New Property"}
            </h2>
            <button type="button" onClick={closeForm}><X className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
          </div>

          <Section title="Basic">
            <Field label="Title *" span={2}>
              <input value={form.title} onChange={set("title")} maxLength={200} className={inputCls} placeholder="e.g. Spacious 2BR with Marina View" />
            </Field>
            <Field label="Project" span={2}>
              <select value={form.projectId} onChange={set("projectId")} className={inputCls}>
                <option value="">No project (stand-alone listing)</option>
                {projects.map((p) => <option key={p.projectId} value={p.projectId}>{p.projectNo} – {p.projectName}</option>)}
                {editing?.projectId && !project && <option value={editing.projectId}>{editing.projectNo} – {editing.projectName} (inactive)</option>}
              </select>
              {project && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Location, developer, handover and payment plan come from the project. Amenities are added to the project's.
                </p>
              )}
            </Field>
            <Field label="Purpose *"><Select value={form.purpose} onChange={set("purpose")} options={PURPOSES} /></Field>
            <Field label="Property Type *"><Select value={form.propertyType} onChange={set("propertyType")} options={PROPERTY_TYPES} /></Field>
            {!project && <Field label="Ready / Off-Plan"><Select value={form.completion} onChange={set("completion")} options={COMPLETIONS} /></Field>}
            <Field label="Status"><Select value={form.status} onChange={set("status")} options={PROPERTY_STATUSES} /></Field>
            <Field label="Featured">
              <Select value={form.isFeatured} onChange={set("isFeatured")} options={[{ value: "F", label: "No" }, { value: "T", label: "Yes" }]} />
            </Field>
            {isAdmin && (
              <Field label="Listing Agent">
                <select value={form.agentId} onChange={set("agentId")} className={inputCls}>
                  <option value="">Not assigned</option>
                  {staff.map((s) => <option key={s.userId} value={s.userId}>{s.fullName}</option>)}
                  {editing?.agentId && !staff.some((s) => s.userId === editing.agentId) && (
                    <option value={editing.agentId}>{editing.agentName} (inactive)</option>
                  )}
                </select>
              </Field>
            )}
          </Section>

          {!project && <Section title="Location">
            <Field label="Emirate *">
              <select value={form.emirate} onChange={set("emirate")} className={inputCls}>
                {EMIRATES.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </Field>
            <Field label="Community / Area">
              <input value={form.community} onChange={set("community")} list="community-list" maxLength={150} className={inputCls} placeholder="e.g. Dubai Marina" />
              <datalist id="community-list">
                {(COMMUNITIES[form.emirate] ?? []).map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <Field label="Building / Project">
              <input value={form.subCommunity} onChange={set("subCommunity")} maxLength={150} className={inputCls} placeholder="e.g. Marina Gate 1" />
            </Field>
            <Field label="Developer">
              <input value={form.developer} onChange={set("developer")} maxLength={150} className={inputCls} placeholder="e.g. Emaar, Damac, Nakheel" />
            </Field>
            <Field label="Google Maps Link" span={4}>
              <input value={form.mapUrl} onChange={set("mapUrl")} maxLength={500} className={inputCls} placeholder="https://maps.google.com/..." />
            </Field>
          </Section>}

          <Section title="Size & Rooms">
            <Field label="Bedrooms"><Select value={form.bedrooms} onChange={set("bedrooms")} options={BEDROOMS} blank="—" /></Field>
            <Field label="Bathrooms">
              <input type="number" min="0" max="20" value={form.bathrooms} onChange={set("bathrooms")} className={inputCls} />
            </Field>
            <Field label="Built-up Area (sq.ft)">
              <input type="number" min="0" step="0.01" value={form.buaSqft} onChange={set("buaSqft")} className={inputCls} />
            </Field>
            <Field label="Plot Size (sq.ft)">
              <input type="number" min="0" step="0.01" value={form.plotSqft} onChange={set("plotSqft")} className={inputCls} />
            </Field>
            <Field label="Parking Spaces">
              <input type="number" min="0" max="100" value={form.parking} onChange={set("parking")} className={inputCls} />
            </Field>
            <Field label="Floor">
              <input value={form.floorNo} onChange={set("floorNo")} maxLength={20} className={inputCls} placeholder="e.g. 12, High floor, G+1" />
            </Field>
            <Field label="View">
              <input value={form.viewType} onChange={set("viewType")} maxLength={100} className={inputCls} placeholder="e.g. Sea, Marina, Burj Khalifa" />
            </Field>
            <Field label="Furnishing"><Select value={form.furnishing} onChange={set("furnishing")} options={FURNISHINGS} blank="—" /></Field>
          </Section>

          <Section title="Price">
            <Field label={isRent ? "Rent (AED) *" : "Price (AED) *"}>
              <input type="number" min="0" step="1" value={form.price} onChange={set("price")} className={inputCls} />
            </Field>
            {isRent ? (
              <>
                <Field label="Rent Per">
                  <Select value={form.rentFrequency} onChange={set("rentFrequency")}
                    options={[{ value: "YEARLY", label: "Year" }, { value: "MONTHLY", label: "Month" }]} />
                </Field>
                <Field label="No. of Cheques">
                  <select value={form.cheques} onChange={set("cheques")} className={inputCls}>
                    <option value="">—</option>
                    {CHEQUES.map((c) => <option key={c} value={c}>{c} {c === 1 ? "cheque" : "cheques"}</option>)}
                  </select>
                </Field>
              </>
            ) : (
              <Field label="Price per sq.ft">
                <input readOnly value={pricePerSqft ? formatAed(pricePerSqft) : ""} className={`${inputCls} bg-gray-50 dark:bg-slate-800`} />
              </Field>
            )}
            <Field label="Service Charge (AED / sq.ft / yr)">
              <input type="number" min="0" step="0.01" value={form.serviceCharge} onChange={set("serviceCharge")} className={inputCls} />
            </Field>
            <Field label="Commission %">
              <input type="number" min="0" max="100" step="0.01" value={form.commissionPct} onChange={set("commissionPct")} className={inputCls} />
            </Field>
          </Section>

          {isOffPlan && !project && (
            <Section title="Off-Plan">
              <Field label="Handover Date">
                <input type="date" value={form.handoverDate} onChange={set("handoverDate")} className={inputCls} />
              </Field>
              <Field label="Payment Plan">
                <input value={form.paymentPlan} onChange={set("paymentPlan")} maxLength={100} className={inputCls} placeholder="e.g. 60/40, 1% monthly" />
              </Field>
              <Field label="Construction Completion %">
                <input type="number" min="0" max="100" value={form.completionPct} onChange={set("completionPct")} className={inputCls} />
              </Field>
            </Section>
          )}

          <Section title="Legal">
            <Field label="Permit No (Trakheesi / RERA)">
              <input value={form.permitNo} onChange={set("permitNo")} maxLength={50} className={inputCls} />
            </Field>
            <Field label="Title Deed No">
              <input value={form.titleDeedNo} onChange={set("titleDeedNo")} maxLength={50} className={inputCls} />
            </Field>
          </Section>

          <Section title="Owner / Landlord (internal — never shared with customers)">
            <Field label="Owner Name">
              <input value={form.ownerName} onChange={set("ownerName")} maxLength={150} className={inputCls} />
            </Field>
            <Field label="Owner Mobile">
              <input value={form.ownerMobile} onChange={set("ownerMobile")} maxLength={20} className={inputCls} placeholder="971501234567" />
            </Field>
            <Field label="Owner Email" span={2}>
              <input type="email" value={form.ownerEmail} onChange={set("ownerEmail")} maxLength={150} className={inputCls} />
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
            <label className={labelCls}>Description</label>
            <textarea value={form.description} onChange={set("description")} rows={5} className={inputCls}
              placeholder="Describe the property, highlights, nearby landmarks..." />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeForm} className="rounded-lg border border-gray-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">
              {editing ? "Close" : "Cancel"}
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-sm font-medium disabled:opacity-60">
              {saving ? "Saving..." : editing ? "Update" : "Save & Add Photos"}
            </button>
          </div>

          {editing && (
            <div className="border-t border-gray-200 dark:border-slate-800 pt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">Photos & Documents</h3>
              <PropertyMedia property={editing} onChanged={refreshEditing} onError={setError} />
            </div>
          )}
        </form>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
              <tr className="text-left text-gray-600 dark:text-gray-300">
                <th className="px-4 py-3 font-medium">Property</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Size</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No properties found.</td></tr>
              )}
              {rows.map((p) => {
                const st = statusOf(p.status);
                return (
                  <tr key={p.propertyId} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.coverFile ? (
                          <img src={fileUrl(p.propertyId, p.coverFile)} alt="" className="h-12 w-16 shrink-0 rounded-md object-cover" />
                        ) : (
                          <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md bg-gray-100 dark:bg-slate-800">
                            <ImageOff className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{p.refNo}</span>
                            {p.isFeatured === "T" && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                          </div>
                          <button onClick={() => openEdit(p)} className="block max-w-xs truncate text-left font-medium text-gray-900 dark:text-white hover:text-blue-600">{p.title}</button>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {labelOf(PURPOSES, p.purpose)} · {labelOf(COMPLETIONS, p.completion)}{p.imageCount > 0 ? ` · ${p.imageCount} photos` : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      <div className="flex items-start gap-1">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-400" />
                        <div>
                          <div>{p.community || "—"}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{[p.subCommunity, p.emirate].filter(Boolean).join(", ")}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      <div>{labelOf(PROPERTY_TYPES, p.propertyType)}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {[bedroomsLabel(p.bedrooms), p.bathrooms !== null && `${p.bathrooms} Bath`].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {p.buaSqft ? `${formatNumber(p.buaSqft)} sq.ft` : p.plotSqft ? `${formatNumber(p.plotSqft)} sq.ft plot` : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{priceLabel(p)}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{p.agentName || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {p.publicUrl && (
                          <>
                            <a href={p.publicUrl} target="_blank" rel="noreferrer" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-blue-600" title="Open public page"><ExternalLink className="h-4 w-4" /></a>
                            <button onClick={() => copyLink(p)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-blue-600" title="Copy public link"><Link2 className="h-4 w-4" /></button>
                          </>
                        )}
                        <button onClick={() => openEdit(p)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-blue-600" title="Edit"><Pencil className="h-4 w-4" /></button>
                        {isAdmin && (
                          <button onClick={() => setDeleteTarget(p)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
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

      <DeleteModal open={!!deleteTarget} name={deleteTarget ? `${deleteTarget.refNo} – ${deleteTarget.title}` : ""}
        onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
    </div>
  );
}
