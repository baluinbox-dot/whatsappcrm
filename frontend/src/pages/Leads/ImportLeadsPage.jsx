import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileSpreadsheet, Upload, Download, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { LeadService } from "@/ServiceLayer/LeadService/LeadService";
import { StaffService } from "@/ServiceLayer/AuthService/AuthService";
import { Alerts, Breadcrumb, inputCls, labelCls } from "@/components/common/ui";
import { apiError } from "@/lib/apiClient";
import { formatDate } from "@/lib/utils";
import { LEAD_SOURCES, LEAD_PURPOSES, PRIORITIES, labelOf, requirementSummary } from "@/lib/realEstate";

const MAX_ROWS = 2000;

// CRM field -> header words that usually mean it.
const FIELDS = [
  { key: "customerName", label: "Name", guess: ["name", "customer", "client", "contact name", "full name"] },
  { key: "mobileNo", label: "Mobile", guess: ["mobile", "phone", "whatsapp", "contact no", "number", "tel", "cell"] },
  { key: "email", label: "Email", guess: ["email", "e-mail", "mail"] },
  { key: "source", label: "Source", guess: ["source", "portal", "channel", "lead source"] },
  { key: "purpose", label: "Buy / Rent", guess: ["purpose", "buy/rent", "buy or rent", "sale/rent", "intent", "category"] },
  { key: "propertyType", label: "Property Type", guess: ["property type", "type", "unit type"] },
  { key: "emirate", label: "Emirate / City", guess: ["emirate", "city"] },
  { key: "communities", label: "Community / Area", guess: ["community", "area", "location", "project", "building"] },
  { key: "bedrooms", label: "Bedrooms", guess: ["bedroom", "beds", "bed", "br", "rooms"] },
  { key: "budgetMin", label: "Budget Min", guess: ["min budget", "budget min", "budget from", "min price"] },
  { key: "budgetMax", label: "Budget / Max", guess: ["budget", "max budget", "budget max", "price", "max price", "budget to"] },
  { key: "nationality", label: "Nationality", guess: ["nationality", "country"] },
  { key: "priority", label: "Priority", guess: ["priority", "temperature", "hot/warm/cold"] },
  { key: "requirements", label: "Notes / Requirements", guess: ["note", "notes", "comment", "comments", "remarks", "requirement", "message", "details"] },
];

const OUTCOME = {
  NEW: { label: "New customer", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  EXISTING: { label: "Existing customer", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  DUPLICATE: { label: "Skipped", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  ERROR: { label: "Error", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

const cellText = (v) => (v === null || v === undefined ? "" : v instanceof Date ? formatDate(v) : String(v).trim());

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9/ ]/g, " ").replace(/\s+/g, " ").trim();

// Exact header match first, then "contains", and each column is used once.
function guessMapping(headers) {
  const used = new Set();
  const map = {};
  const h = headers.map(norm);
  for (const pass of ["exact", "contains"]) {
    for (const f of FIELDS) {
      if (map[f.key] !== undefined) continue;
      const idx = h.findIndex((x, i) => !used.has(i) && f.guess.some((g) => (pass === "exact" ? x === g : x.includes(g))));
      if (idx >= 0) { map[f.key] = idx; used.add(idx); }
    }
  }
  return map;
}

// The parsers are loaded only when a file is picked, to keep them out of the main bundle.
async function readFile(file) {
  if (/\.csv$/i.test(file.name)) {
    const { default: Papa } = await import("papaparse");
    return new Promise((resolve, reject) =>
      Papa.parse(file, { skipEmptyLines: "greedy", complete: (r) => resolve(r.data), error: reject }));
  }
  const { readSheet } = await import("read-excel-file/browser");
  return readSheet(file);
}

function downloadSample() {
  const csv = [
    "Name,Mobile,Email,Source,Buy/Rent,Property Type,Emirate,Community,Bedrooms,Budget,Nationality,Notes",
    "Ahmed Khan,0501234567,ahmed@example.com,Bayut,Buy,Apartment,Dubai,Dubai Marina,2,1.8M,Indian,Sea view preferred",
    "Sarah Jones,+971 55 765 4321,,Property Finder,Rent,Villa,Dubai,Arabian Ranches,4,280000,British,Move in next month",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "leads-import-sample.csv" });
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportLeadsPage() {
  const [staff, setStaff] = useState([]);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [data, setData] = useState([]);
  const [mapping, setMapping] = useState({});
  const [settings, setSettings] = useState({ defaultSource: "IMPORT", defaultPurpose: "BUY", skipOpenDuplicates: true });
  const [assignMode, setAssignMode] = useState("none");
  const [assignOne, setAssignOne] = useState("");
  const [assignMany, setAssignMany] = useState([]);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    StaffService.getAll().then((r) => setStaff(r.filter((s) => s.isActive === "T"))).catch(() => {});
  }, []);

  const staffName = (id) => staff.find((s) => s.userId === id)?.fullName ?? "";

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(""); setPreview(null); setResult(null);
    if (!/\.(xlsx|csv)$/i.test(file.name)) { setError("Choose an Excel (.xlsx) or CSV file. For old .xls files, open in Excel and Save As .xlsx."); return; }
    setBusy("read");
    try {
      const rows = (await readFile(file)).map((r) => r.map(cellText));
      const [head = [], ...body] = rows;
      const filled = body.filter((r) => r.some((c) => c !== ""));
      if (filled.length === 0) { setError("The file has no data rows under the header row."); return; }
      if (filled.length > MAX_ROWS) { setError(`The file has ${filled.length} rows. Import at most ${MAX_ROWS} at a time — split the file.`); return; }
      setFileName(file.name);
      setHeaders(head.map((h, i) => h || `Column ${i + 1}`));
      setData(filled);
      setMapping(guessMapping(head));
    } catch {
      setError("Could not read that file. Make sure it is a valid .xlsx or .csv file.");
    } finally { setBusy(""); }
  };

  const assignUserIds = assignMode === "one" ? (assignOne ? [Number(assignOne)] : []) : assignMode === "many" ? assignMany : [];

  const buildPayload = (dryRun) => ({
    dryRun,
    ...settings,
    assignUserIds,
    rows: data.map((r) => Object.fromEntries(FIELDS.map((f) => [f.key, mapping[f.key] === undefined ? null : r[mapping[f.key]] || null]))),
  });

  const check = async () => {
    if (mapping.mobileNo === undefined && mapping.email === undefined) { setError("Match at least the Mobile or Email column."); return; }
    if (assignMode === "one" && !assignOne) { setError("Choose who gets the leads."); return; }
    if (assignMode === "many" && assignMany.length < 2) { setError("Tick at least two staff for round-robin."); return; }
    setBusy("check"); setError(""); setResult(null);
    try { setPreview(await LeadService.importLeads(buildPayload(true))); }
    catch (err) { setError(apiError(err, "Failed to check the file.")); }
    finally { setBusy(""); }
  };

  const runImport = async () => {
    setBusy("import"); setError("");
    try { setResult(await LeadService.importLeads(buildPayload(false))); setPreview(null); }
    catch (err) { setError(apiError(err, "Import failed.")); }
    finally { setBusy(""); }
  };

  const reset = () => { setFileName(""); setHeaders([]); setData([]); setMapping({}); setPreview(null); setResult(null); };

  const toImport = preview ? preview.newCustomers + preview.existingCustomers : 0;
  const report = result ?? preview;

  return (
    <div className="p-6 space-y-4">
      <Breadcrumb items={[{ label: "Leads", to: "/leads" }, { label: "Import" }]} />
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600/10 p-2"><FileSpreadsheet className="h-6 w-6 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import Leads</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Upload an Excel or CSV list, match the columns, check, then import and assign</p>
          </div>
        </div>
        <button onClick={downloadSample} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">
          <Download className="h-4 w-4" /> Sample File
        </button>
      </div>

      <Alerts error={error} onClearError={() => setError("")} />

      {result ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
          <h2 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{result.leadsCreated} leads imported</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {result.newCustomers} new customers · {result.existingCustomers} existing · {result.duplicates} skipped · {result.errors} errors
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link to="/leads" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium">Go to Leads <ArrowRight className="h-4 w-4" /></Link>
            <button onClick={reset} className="rounded-lg border border-gray-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">Import another file</button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-5 space-y-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">1. File</h3>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium">
                {busy === "read" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {fileName ? "Choose another file" : "Choose Excel / CSV"}
                <input type="file" accept=".xlsx,.csv" className="hidden" onChange={pickFile} />
              </label>
              {fileName && <span className="text-sm text-gray-700 dark:text-gray-300"><b>{fileName}</b> · {data.length} rows</span>}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              The first row must be the column names. UAE mobiles like 050 123 4567, 0501234567 or +971 50 123 4567 are all fine. Up to {MAX_ROWS} rows per file.
            </p>
          </div>

          {headers.length > 0 && (
            <>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">2. Match Columns</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {FIELDS.map((f) => (
                    <div key={f.key}>
                      <label className={labelCls}>{f.label}{(f.key === "mobileNo" || f.key === "email") && " *"}</label>
                      <select value={mapping[f.key] ?? ""} onChange={(e) => { setPreview(null); setMapping((m) => ({ ...m, [f.key]: e.target.value === "" ? undefined : Number(e.target.value) })); }}
                        className={`${inputCls} ${mapping[f.key] !== undefined ? "border-green-400" : ""}`}>
                        <option value="">— not in file —</option>
                        {headers.map((h, i) => <option key={i} value={i}>{h}{data[0]?.[i] ? ` (e.g. ${data[0][i].slice(0, 25)})` : ""}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">* Mobile or Email is needed. Customers already in the CRM (same mobile or email) get the lead added — no duplicate customer.</p>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">3. Settings & Assignment</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className={labelCls}>Source (when not in file)</label>
                    <select value={settings.defaultSource} onChange={(e) => { setPreview(null); setSettings((s) => ({ ...s, defaultSource: e.target.value })); }} className={inputCls}>
                      {LEAD_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Buy / Rent (when not in file)</label>
                    <select value={settings.defaultPurpose} onChange={(e) => { setPreview(null); setSettings((s) => ({ ...s, defaultPurpose: e.target.value })); }} className={inputCls}>
                      {LEAD_PURPOSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Assign Leads</label>
                    <select value={assignMode} onChange={(e) => { setPreview(null); setAssignMode(e.target.value); }} className={inputCls}>
                      <option value="none">Leave unassigned</option>
                      <option value="one">All to one staff member</option>
                      <option value="many">Round-robin between staff</option>
                    </select>
                  </div>
                  {assignMode === "one" && (
                    <div>
                      <label className={labelCls}>Staff Member</label>
                      <select value={assignOne} onChange={(e) => { setPreview(null); setAssignOne(e.target.value); }} className={inputCls}>
                        <option value="">Choose...</option>
                        {staff.map((s) => <option key={s.userId} value={s.userId}>{s.fullName}</option>)}
                      </select>
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 md:col-span-2 lg:col-span-4">
                    <input type="checkbox" checked={settings.skipOpenDuplicates}
                      onChange={(e) => { setPreview(null); setSettings((s) => ({ ...s, skipOpenDuplicates: e.target.checked })); }} />
                    Skip customers who already have an open lead (and repeats inside this file)
                  </label>
                </div>
                {assignMode === "many" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {staff.map((s) => {
                      const on = assignMany.includes(s.userId);
                      return (
                        <button key={s.userId} type="button"
                          onClick={() => { setPreview(null); setAssignMany((m) => (on ? m.filter((x) => x !== s.userId) : [...m, s.userId])); }}
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${on ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"}`}>
                          {s.fullName}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button onClick={check} disabled={!!busy} className="inline-flex items-center gap-2 rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-60">
                  {busy === "check" && <Loader2 className="h-4 w-4 animate-spin" />} 4. Check Rows
                </button>
                <button onClick={runImport} disabled={!preview || toImport === 0 || !!busy} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-sm font-medium disabled:opacity-50">
                  {busy === "import" && <Loader2 className="h-4 w-4 animate-spin" />} Import {preview ? toImport : ""} Leads
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {report && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="flex flex-wrap gap-4 px-4 py-3 border-b border-gray-200 dark:border-slate-700 text-sm">
            <span className="font-semibold text-gray-900 dark:text-white">{report.dryRun ? "Check result — nothing saved yet" : "Import result"}</span>
            <span className="text-green-700 dark:text-green-400">{report.newCustomers} new customers</span>
            <span className="text-blue-700 dark:text-blue-400">{report.existingCustomers} existing customers</span>
            <span className="text-amber-700 dark:text-amber-400">{report.duplicates} skipped</span>
            <span className="text-red-700 dark:text-red-400">{report.errors} errors</span>
          </div>
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                <tr className="text-left text-gray-600 dark:text-gray-300">
                  <th className="px-4 py-2.5 font-medium">Row</th>
                  <th className="px-4 py-2.5 font-medium">Result</th>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Mobile</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Lead</th>
                  <th className="px-4 py-2.5 font-medium">Assign To</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => {
                  const o = OUTCOME[r.outcome];
                  return (
                    <tr key={r.row} className="border-b border-gray-100 dark:border-slate-800 align-top">
                      <td className="px-4 py-2 text-gray-500">{r.row + 1}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${o.cls}`}>{o.label}</span>
                        {r.message && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{r.message}</div>}
                      </td>
                      <td className="px-4 py-2 text-gray-900 dark:text-white">{r.customerName || "—"}</td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">{r.mobileNo ? `+${r.mobileNo}` : "—"}</td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{r.email || "—"}</td>
                      <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-300">
                        {r.lead && (
                          <>
                            {requirementSummary(r.lead)}
                            <div className="text-gray-400">{labelOf(LEAD_SOURCES, r.lead.source)} · {labelOf(PRIORITIES, r.lead.priority)}</div>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{r.assignTo ? staffName(r.assignTo) : r.outcome === "NEW" || r.outcome === "EXISTING" ? "Unassigned" : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
