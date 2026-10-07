import { useEffect, useState } from "react";
import { ImageOff, ExternalLink, MessagesSquare, Mail, Loader2, RefreshCw, Check } from "lucide-react";
import { LeadService } from "@/ServiceLayer/LeadService/LeadService";
import { inputCls } from "@/components/common/ui";
import { apiError } from "@/lib/apiClient";
import { formatDate } from "@/lib/utils";
import { toDate } from "@/lib/time";
import { PROPERTY_TYPES, labelOf, bedroomsLabel, formatNumber, formatAed, priceLabel, fileUrl } from "@/lib/realEstate";

const MAX_SHARE = 10;

export default function LeadMatches({ lead, onShared, onError }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  const load = async () => {
    setLoading(true);
    try { setRows(await LeadService.matches(lead.leadId)); }
    catch { onError("Failed to load matching properties."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    setSelected([]);
    // Requirement edits change the matches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.leadId, lead.updatedAt]);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_SHARE ? s : [...s, id]));

  const share = async (channel) => {
    setBusy(channel);
    try {
      const r = await LeadService.share(lead.leadId, { propertyIds: selected, channel, message: message.trim() || null });
      const how = channel === "WHATSAPP" ? "on WhatsApp" : "by email";
      onShared(r.failed.length
        ? `${r.sent} shared ${how}. Not sent: ${r.failed.join("; ")}`
        : `${r.sent} ${r.sent === 1 ? "property" : "properties"} shared ${how}.`);
      setSelected([]); setMessage(""); load();
    } catch (err) {
      onError(apiError(err, "Failed to share."));
    } finally { setBusy(""); }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Matching Properties ({rows.length})</h3>
        <button onClick={load} className="rounded p-1 text-gray-400 hover:text-gray-600" title="Refresh"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Available {lead.purpose === "RENT" ? "rentals" : "sales"} that fit the type, emirate, bedrooms and budget (±10%){lead.purpose === "BUY" ? ", down payment, EMI, finance and required amenities" : ""}. Preferred areas first. EMI is estimated at 4.5% over 25 years.
      </p>

      {rows.length === 0 && !loading && (
        <p className="text-sm text-gray-400">No available property matches yet. Widen the requirement (budget, bedrooms, type) or add listings.</p>
      )}

      <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {rows.map((p) => {
          const on = selected.includes(p.propertyId);
          return (
            <li key={p.propertyId}>
              <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-2 transition-colors ${on
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50"}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(p.propertyId)} className="mt-1" />
                {p.coverFile ? (
                  <img src={fileUrl(p.propertyId, p.coverFile)} alt="" className="h-14 w-20 shrink-0 rounded-md object-cover" />
                ) : (
                  <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-md bg-gray-100 dark:bg-slate-800"><ImageOff className="h-4 w-4 text-gray-400" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">{p.refNo}</span>
                    {p.inPreferredArea && <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">Preferred area</span>}
                    {p.lastSharedAt && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-slate-800 dark:text-gray-300">
                        <Check className="h-3 w-3" /> Sent {p.lastSharedChannel === "EMAIL" ? "by email" : "on WhatsApp"} {formatDate(toDate(p.lastSharedAt))}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-sm font-medium text-gray-900 dark:text-white">{p.title}</div>
                  {p.projectName && <div className="truncate text-xs font-medium text-blue-600 dark:text-blue-400">{p.projectNo} · {p.projectName}</div>}
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {[bedroomsLabel(p.bedrooms), labelOf(PROPERTY_TYPES, p.propertyType), p.buaSqft && `${formatNumber(p.buaSqft)} sq.ft`].filter(Boolean).join(" · ")}
                    {" · "}{[p.community, p.emirate].filter(Boolean).join(", ")}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">{priceLabel(p)}</span>
                    {p.downPaymentAmount && <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Down {formatAed(p.downPaymentAmount)} ({p.downPaymentPct}%)</span>}
                    {p.estimatedEmi && lead.purpose === "BUY" && <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">EMI ~{formatAed(p.estimatedEmi)}/mo</span>}
                    {p.publicUrl && (
                      <a href={p.publicUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        Public page <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </label>
            </li>
          );
        })}
      </ul>

      {selected.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-gray-100 dark:border-slate-800 pt-3">
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={1000} className={inputCls}
            placeholder="Intro message (optional), e.g. Hi Ahmed, here are the options we discussed." />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-xs text-gray-500 dark:text-gray-400">{selected.length} selected (max {MAX_SHARE})</span>
            <button onClick={() => share("EMAIL")} disabled={!!busy || !lead.email} title={lead.email ? "" : "Customer has no email ID"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50">
              {busy === "EMAIL" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Share by Email
            </button>
            <button onClick={() => share("WHATSAPP")} disabled={!!busy || !lead.mobileNo} title={lead.mobileNo ? "" : "Customer has no mobile number"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50">
              {busy === "WHATSAPP" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessagesSquare className="h-4 w-4" />} Share on WhatsApp
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">WhatsApp: one message per property with its cover photo and link. Only within 24 hours of the customer's last message.</p>
        </div>
      )}
    </div>
  );
}
