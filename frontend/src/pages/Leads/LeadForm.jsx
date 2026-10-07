import { useEffect, useState } from "react";
import { X, Search } from "lucide-react";
import { LeadService } from "@/ServiceLayer/LeadService/LeadService";
import { CustomerService } from "@/ServiceLayer/WhatsAppService/WhatsAppService";
import { inputCls, labelCls } from "@/components/common/ui";
import { apiError } from "@/lib/apiClient";
import { displayName } from "@/lib/time";
import {
  EMIRATES, COMMUNITIES, PROPERTY_TYPES, BEDROOMS, LEAD_SOURCES, LEAD_PURPOSES, PRIORITIES, FINANCE, LEAD_COMPLETIONS,
  MOVE_TIMELINES, BUYER_TYPES, NATIONALITIES, BUY_PLANS, AMENITIES,
} from "@/lib/realEstate";

const empty = {
  source: "WHATSAPP", purpose: "BUY", propertyType: "", emirate: "Dubai", communities: "",
  bedroomsMin: "", bedroomsMax: "", budgetMin: "", budgetMax: "", finance: "", downPaymentMax: "", monthlyEmiMax: "", buyPlan: "", minAmenities: [], completion: "", moveTimeline: "",
  nationality: "", buyerType: "", requirements: "", priority: "WARM", assignedTo: "",
};

const NUMBER_FIELDS = ["bedroomsMin", "bedroomsMax", "budgetMin", "budgetMax", "downPaymentMax", "monthlyEmiMax", "assignedTo"];

const fromLead = (l) => {
  const f = { ...empty };
  Object.keys(empty).forEach((k) => { if (l[k] !== null && l[k] !== undefined) f[k] = typeof l[k] === "number" ? String(l[k]) : l[k]; });
  f.minAmenities = l.minAmenities ? l.minAmenities.split(",").map((a) => a.trim()).filter(Boolean) : [];
  return f;
};

function Field({ label, span, children }) {
  return (
    <div className={span === 2 ? "md:col-span-2" : span === 3 ? "md:col-span-2 lg:col-span-3" : ""}>
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

// lead: edit an existing lead. customer: pre-selected customer for a new lead (from the Customers page).
export default function LeadForm({ lead, customer, staff, isAdmin, onSaved, onCancel, onError }) {
  const [form, setForm] = useState(() => (lead ? fromLead(lead) : empty));
  const [contactMode, setContactMode] = useState(customer ? "existing" : "new");
  const [picked, setPicked] = useState(customer ?? null);
  const [contact, setContact] = useState({ customerName: "", mobileNo: "", email: "" });
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead || contactMode !== "existing" || picked || query.trim().length < 2) { setMatches([]); return; }
    const t = setTimeout(() => CustomerService.getAll({ search: query.trim() }).then((r) => setMatches(r.slice(0, 8))).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [query, contactMode, picked, lead]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleAmenity = (a) => setForm((f) => ({
    ...f, minAmenities: f.minAmenities.includes(a) ? f.minAmenities.filter((x) => x !== a) : [...f.minAmenities, a],
  }));
  const setC = (k) => (e) => setContact((c) => ({ ...c, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const payload = { ...form, minAmenities: form.minAmenities.join(", ") };
    Object.keys(payload).forEach((k) => { if (payload[k] === "") payload[k] = null; });
    NUMBER_FIELDS.forEach((k) => { payload[k] = form[k] === "" ? null : Number(form[k]); });
    payload.source ??= "OTHER";

    if (!lead) {
      if (contactMode === "existing") {
        if (!picked) { onError("Choose a customer."); return; }
        payload.customerId = picked.customerId;
      } else {
        const mobileNo = contact.mobileNo.replace(/[^\d]/g, "");
        const email = contact.email.trim();
        if (!mobileNo && !email) { onError("Enter a mobile number or an email ID."); return; }
        Object.assign(payload, { mobileNo: mobileNo || null, email: email || null, customerName: contact.customerName.trim() || null });
      }
    }

    setSaving(true);
    try {
      const saved = lead ? await LeadService.update(lead.leadId, payload) : await LeadService.create(payload);
      onSaved(saved);
    } catch (err) {
      onError(apiError(err, "Failed to save lead."));
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{lead ? `Edit ${lead.leadNo}` : "New Lead"}</h2>
        <button type="button" onClick={onCancel}><X className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
      </div>

      {!lead && (
        <div>
          <div className="flex items-center gap-4 mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Customer</h3>
            {["new", "existing"].map((m) => (
              <label key={m} className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="radio" checked={contactMode === m} onChange={() => setContactMode(m)} />
                {m === "new" ? "New contact" : "Existing customer"}
              </label>
            ))}
          </div>
          {contactMode === "new" ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Name"><input value={contact.customerName} onChange={setC("customerName")} maxLength={150} className={inputCls} /></Field>
              <Field label="Mobile No">
                <input value={contact.mobileNo} onChange={setC("mobileNo")} className={inputCls} placeholder="With country code, e.g. 971501234567" />
              </Field>
              <Field label="Email ID"><input type="email" value={contact.email} onChange={setC("email")} maxLength={150} className={inputCls} /></Field>
              <p className="md:col-span-3 text-xs text-gray-500 dark:text-gray-400">If this mobile or email already belongs to a customer, the lead is added to that customer.</p>
            </div>
          ) : picked ? (
            <div className="flex items-center justify-between rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5">
              <div className="text-sm">
                <span className="font-medium text-gray-900 dark:text-white">{displayName(picked)}</span>
                <span className="text-gray-500 dark:text-gray-400"> {[picked.mobileNo && `+${picked.mobileNo}`, picked.email].filter(Boolean).join(" · ")}</span>
              </div>
              <button type="button" onClick={() => { setPicked(null); setQuery(""); }} className="text-xs font-medium text-blue-600 hover:underline">Change</button>
            </div>
          ) : (
            <div className="relative max-w-lg">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, mobile or email (2+ characters)..." className={`${inputCls} pl-9`} />
              {matches.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg max-h-64 overflow-y-auto">
                  {matches.map((c) => (
                    <li key={c.customerId}>
                      <button type="button" onClick={() => setPicked(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800">
                        <span className="font-medium text-gray-900 dark:text-white">{displayName(c)}</span>
                        <span className="text-gray-500 dark:text-gray-400"> {[c.mobileNo && `+${c.mobileNo}`, c.email].filter(Boolean).join(" · ")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3 pb-1 border-b border-gray-100 dark:border-slate-800">Requirement</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Looking to *"><Select value={form.purpose} onChange={set("purpose")} options={LEAD_PURPOSES} /></Field>
          <Field label="Property Type"><Select value={form.propertyType} onChange={set("propertyType")} options={PROPERTY_TYPES} blank="Any" /></Field>
          <Field label="Emirate">
            <select value={form.emirate} onChange={set("emirate")} className={inputCls}>
              <option value="">Any</option>
              {EMIRATES.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </Field>
          <Field label="Preferred Communities">
            <input value={form.communities} onChange={set("communities")} list="lead-community-list" maxLength={500} className={inputCls} placeholder="e.g. Dubai Marina, JLT" />
            <datalist id="lead-community-list">
              {(COMMUNITIES[form.emirate] ?? []).map((c) => <option key={c} value={c} />)}
            </datalist>
          </Field>
          <Field label="Bedrooms (min)"><Select value={form.bedroomsMin} onChange={set("bedroomsMin")} options={BEDROOMS} blank="Any" /></Field>
          <Field label="Bedrooms (max)"><Select value={form.bedroomsMax} onChange={set("bedroomsMax")} options={BEDROOMS} blank="Any" /></Field>
          <Field label={form.purpose === "RENT" ? "Budget min (AED / year)" : "Budget min (AED)"}>
            <input type="number" min="0" value={form.budgetMin} onChange={set("budgetMin")} className={inputCls} />
          </Field>
          <Field label={form.purpose === "RENT" ? "Budget max (AED / year)" : "Budget max (AED)"}>
            <input type="number" min="0" value={form.budgetMax} onChange={set("budgetMax")} className={inputCls} />
          </Field>
          {form.purpose === "BUY" && (
            <>
              <Field label="Finance"><Select value={form.finance} onChange={set("finance")} options={FINANCE} blank="—" /></Field>
              <Field label="Down payment max (AED)">
                <input type="number" min="0" value={form.downPaymentMax} onChange={set("downPaymentMax")} className={inputCls} />
              </Field>
              <Field label="Monthly EMI (AED)">
                <input type="number" min="0" value={form.monthlyEmiMax} onChange={set("monthlyEmiMax")} className={inputCls} />
              </Field>
              <Field label="Self plan / Ready to buy"><Select value={form.buyPlan} onChange={set("buyPlan")} options={BUY_PLANS} blank="—" /></Field>
              <Field label="Ready / Off-Plan"><Select value={form.completion} onChange={set("completion")} options={LEAD_COMPLETIONS} blank="—" /></Field>
              <Field label="Buyer Type"><Select value={form.buyerType} onChange={set("buyerType")} options={BUYER_TYPES} blank="—" /></Field>
            </>
          )}
          <Field label="Move-in / Purchase Timeline"><Select value={form.moveTimeline} onChange={set("moveTimeline")} options={MOVE_TIMELINES} blank="—" /></Field>
          <Field label="Nationality">
            <input value={form.nationality} onChange={set("nationality")} list="nationality-list" maxLength={50} className={inputCls} />
            <datalist id="nationality-list">{NATIONALITIES.map((n) => <option key={n} value={n} />)}</datalist>
          </Field>
          <div className="md:col-span-2 lg:col-span-4">
            <label className={labelCls}>Minimum amenities required</label>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map((a) => {
                const on = form.minAmenities.includes(a);
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
          <Field label="Other Requirements" span={3}>
            <textarea value={form.requirements} onChange={set("requirements")} rows={2} maxLength={2000} className={inputCls}
              placeholder="e.g. high floor, sea view, near metro, pets allowed" />
          </Field>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3 pb-1 border-b border-gray-100 dark:border-slate-800">Lead</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Source *"><Select value={form.source} onChange={set("source")} options={LEAD_SOURCES} /></Field>
          <Field label="Priority"><Select value={form.priority} onChange={set("priority")} options={PRIORITIES} /></Field>
          {isAdmin && !lead && (
            <Field label="Assign To">
              <select value={form.assignedTo} onChange={set("assignedTo")} className={inputCls}>
                <option value="">Unassigned</option>
                {staff.map((s) => <option key={s.userId} value={s.userId}>{s.fullName}</option>)}
              </select>
            </Field>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-gray-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">Cancel</button>
        <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-sm font-medium disabled:opacity-60">
          {saving ? "Saving..." : lead ? "Update" : "Create Lead"}
        </button>
      </div>
    </form>
  );
}
