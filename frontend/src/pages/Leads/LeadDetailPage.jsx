import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Target, Pencil, Trash2, MessagesSquare, Mail, Phone, CalendarClock, CheckCircle2, Plus, X, StickyNote, Users,
  Eye, ArrowRightLeft, UserCheck, Sparkles, Bot, Send,
} from "lucide-react";
import { LeadService, FollowUpService } from "@/ServiceLayer/LeadService/LeadService";
import { PropertyService } from "@/ServiceLayer/PropertyService/PropertyService";
import { StaffService } from "@/ServiceLayer/AuthService/AuthService";
import { useAuth } from "@/context/AuthContext";
import { Alerts, Breadcrumb, DeleteModal, inputCls, labelCls } from "@/components/common/ui";
import { apiError } from "@/lib/apiClient";
import { dateTime, displayName, toDate } from "@/lib/time";
import {
  LEAD_STATUSES, LEAD_SOURCES, LOST_REASONS, FOLLOW_UP_TYPES, CALL_OUTCOMES, FINANCE, BUY_PLANS, LEAD_COMPLETIONS, MOVE_TIMELINES,
  BUYER_TYPES, PROPERTY_TYPES, labelOf, bedroomsLabel, formatAed, requirementSummary,
} from "@/lib/realEstate";
import LeadForm from "./LeadForm";
import LeadMatches from "./LeadMatches";
import { statusOf, priorityOf } from "./LeadsPage";

const card = "bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm";
const btnOutline = "rounded-lg border border-gray-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800";
const btnPrimary = "rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 text-sm font-medium disabled:opacity-60";

const pad = (n) => String(n).padStart(2, "0");
const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const tomorrow10 = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return toLocalInput(d); };

const propertyLabel = (p) => `${p.refNo} · ${p.title}`;

function Info({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-right font-medium text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}

const ACTIVITY_ICON = {
  NOTE: StickyNote, CALL: Phone, MEETING: Users, VIEWING: Eye, STATUS: ArrowRightLeft, ASSIGN: UserCheck, CREATED: Sparkles,
  SHARE: Send,
};

function TimelineItem({ t }) {
  if (t.kind !== "ACTIVITY") {
    const inbound = t.direction === "IN";
    const Icon = t.kind === "WHATSAPP" ? (t.byName === "Bot" ? Bot : MessagesSquare) : Mail;
    return (
      <li className="flex gap-3">
        <div className={`mt-0.5 rounded-full p-1.5 h-fit ${t.kind === "WHATSAPP" ? "bg-green-100 text-green-700 dark:bg-green-900/30" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30"}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t.kind === "WHATSAPP" ? "WhatsApp" : "Email"} {inbound ? "from customer" : `sent${t.byName ? ` by ${t.byName}` : ""}`} · {dateTime(t.createdAt)}
          </div>
          {t.subject && <div className="text-sm font-medium text-gray-900 dark:text-white">{t.subject}</div>}
          <p className={`mt-0.5 whitespace-pre-wrap break-words text-sm line-clamp-4 ${inbound ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-300"}`}>
            {t.body || (t.activityType && t.activityType !== "text" ? `[${t.activityType}]` : "")}
          </p>
        </div>
      </li>
    );
  }

  const Icon = ACTIVITY_ICON[t.activityType] ?? StickyNote;
  const title = {
    NOTE: "Note", CALL: `Call${t.outcome ? ` – ${labelOf(CALL_OUTCOMES, t.outcome)}` : ""}`, MEETING: "Meeting", VIEWING: "Viewing",
    CREATED: t.byName ? "Lead created" : "Lead created automatically",
    SHARE: "Properties shared",
    ASSIGN: `Assigned to ${t.body}`,
    STATUS: `Status: ${t.statusFrom ? `${statusOf(t.statusFrom).label} → ` : ""}${statusOf(t.statusTo).label}`,
  }[t.activityType];
  const body = t.activityType === "ASSIGN" ? null : t.body;

  return (
    <li className="flex gap-3">
      <div className="mt-0.5 rounded-full bg-gray-100 dark:bg-slate-800 p-1.5 h-fit text-gray-600 dark:text-gray-300"><Icon className="h-3.5 w-3.5" /></div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-gray-900 dark:text-white">{title}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{t.byName ?? "System"} · {dateTime(t.createdAt)}</div>
        {t.propertyId && <div className="mt-0.5 text-xs text-blue-600">{t.propertyRef} · {t.propertyTitle}</div>}
        {body && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-300">{body}</p>}
      </div>
    </li>
  );
}

export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, refreshUnread } = useAuth();
  const [lead, setLead] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [properties, setProperties] = useState([]);
  const [staff, setStaff] = useState([]);
  const [editing, setEditing] = useState(false);
  const [statusForm, setStatusForm] = useState(null);
  const [activity, setActivity] = useState({ activityType: "NOTE", body: "", outcome: "ANSWERED", propertyId: "" });
  const [followForm, setFollowForm] = useState(null);
  const [completing, setCompleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const [l, t, f] = await Promise.all([LeadService.get(id), LeadService.timeline(id), LeadService.followUps(id)]);
      setLead(l); setTimeline(t); setFollowUps(f);
    } catch (err) {
      setError(err?.response?.status === 404 ? "Lead not found, or it is assigned to someone else." : "Failed to load lead.");
    }
  };

  useEffect(() => {
    load();
    PropertyService.getAll({}).then(setProperties).catch(() => {});
    if (isAdmin) StaffService.getAll().then((r) => setStaff(r.filter((s) => s.isActive === "T"))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const run = async (fn, ok, fallback) => {
    if (busy) return false;
    setBusy(true); setError("");
    try { await fn(); if (ok) setSuccess(ok); await load(); refreshUnread(); return true; }
    catch (err) { setError(apiError(err, fallback)); return false; }
    finally { setBusy(false); }
  };

  if (!lead) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <Breadcrumb items={[{ label: "Leads", to: "/leads" }, { label: "Lead" }]} />
        <Alerts error={error} onClearError={() => setError("")} />
        {!error && <p className="text-sm text-gray-400">Loading…</p>}
      </div>
    );
  }

  const st = statusOf(lead.status);
  const pr = priorityOf(lead.priority);
  const openFollowUps = followUps.filter((f) => f.isDone === "F");
  const doneFollowUps = followUps.filter((f) => f.isDone === "T").slice(0, 5);

  const saveStatus = async (e) => {
    e.preventDefault();
    const payload = {
      status: statusForm.status,
      lostReason: statusForm.lostReason || null,
      wonPropertyId: statusForm.wonPropertyId ? Number(statusForm.wonPropertyId) : null,
      dealValue: statusForm.dealValue === "" ? null : Number(statusForm.dealValue),
      commissionAmount: statusForm.commissionAmount === "" ? null : Number(statusForm.commissionAmount),
      note: statusForm.note.trim() || null,
    };
    if (await run(() => LeadService.setStatus(lead.leadId, payload), `Status changed to ${statusOf(payload.status).label}.`, "Failed to change status.")) setStatusForm(null);
  };

  const addActivity = async (e) => {
    e.preventDefault();
    const payload = {
      activityType: activity.activityType,
      body: activity.body.trim() || null,
      outcome: activity.activityType === "CALL" ? activity.outcome : null,
      propertyId: activity.activityType === "VIEWING" && activity.propertyId ? Number(activity.propertyId) : null,
    };
    if (await run(() => LeadService.addActivity(lead.leadId, payload), "", "Failed to save.")) {
      setActivity((a) => ({ ...a, body: "", propertyId: "" }));
    }
  };

  const addFollowUp = async (e) => {
    e.preventDefault();
    if (!followForm.dueAt) { setError("Choose the date and time."); return; }
    const payload = {
      followUpType: followForm.followUpType,
      dueAt: new Date(followForm.dueAt).toISOString(),
      notes: followForm.notes.trim() || null,
      propertyId: followForm.propertyId ? Number(followForm.propertyId) : null,
    };
    if (await run(() => LeadService.addFollowUp(lead.leadId, payload), "Follow-up scheduled.", "Failed to schedule follow-up.")) setFollowForm(null);
  };

  const completeFollowUp = async (e) => {
    e.preventDefault();
    if (await run(() => FollowUpService.complete(completing.id, completing.result.trim() || null), "Follow-up done.", "Failed to update follow-up.")) setCompleting(null);
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <Breadcrumb items={[{ label: "Leads", to: "/leads" }, { label: lead.leadNo }]} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600/10 p-2"><Target className="h-6 w-6 text-blue-600" /></div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{displayName(lead) || lead.leadNo}</h1>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${pr.cls}`}>{pr.label}</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{lead.leadNo} · {requirementSummary(lead)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lead.mobileNo && (
            <Link to={`/inbox?customer=${lead.customerId}`} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">
              <MessagesSquare className="h-4 w-4 text-green-600" /> Chat
            </Link>
          )}
          {lead.email && (
            <Link to={`/email-inbox?customer=${lead.customerId}`} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">
              <Mail className="h-4 w-4 text-blue-600" /> Email
            </Link>
          )}
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">
            <Pencil className="h-4 w-4" /> Edit
          </button>
          {isAdmin && (
            <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-2 text-sm font-medium">
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
        </div>
      </div>

      <Alerts success={success} error={error} onClearSuccess={() => setSuccess("")} onClearError={() => setError("")} />

      {editing && (
        <LeadForm lead={lead} staff={staff} isAdmin={isAdmin} onError={setError} onCancel={() => setEditing(false)}
          onSaved={() => { setEditing(false); setSuccess("Lead updated."); load(); }} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 items-start">
        <div className="space-y-4">
          <div className={`${card} p-4`}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Contact</h3>
            <Info label="Name" value={displayName(lead)} />
            <Info label="Mobile" value={lead.mobileNo && `+${lead.mobileNo}`} />
            <Info label="Email" value={lead.email} />
            <Info label="Nationality" value={lead.nationality} />
            <Info label="Source" value={labelOf(LEAD_SOURCES, lead.source)} />
            <Info label="Created" value={dateTime(lead.createdAt)} />
            <div className="flex items-center justify-between gap-3 py-1 text-sm">
              <span className="text-gray-500 dark:text-gray-400">Agent</span>
              {isAdmin ? (
                <select value={lead.assignedTo ?? ""} disabled={busy}
                  onChange={(e) => run(() => LeadService.assign(lead.leadId, e.target.value ? Number(e.target.value) : null), "Agent updated.", "Failed to assign lead.")}
                  className={`${inputCls.replace("w-full ", "")} py-1 w-44 ${lead.assignedTo ? "" : "border-amber-400 text-amber-700"}`}>
                  <option value="">Unassigned</option>
                  {staff.map((s) => <option key={s.userId} value={s.userId}>{s.fullName}</option>)}
                  {lead.assignedTo && !staff.some((s) => s.userId === lead.assignedTo) && <option value={lead.assignedTo}>{lead.assignedToName} (inactive)</option>}
                </select>
              ) : <span className="font-medium text-gray-900 dark:text-white">{lead.assignedToName ?? "Unassigned"}</span>}
            </div>
          </div>

          <div className={`${card} p-4`}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Requirement</h3>
            <Info label="Looking to" value={lead.purpose === "BUY" ? "Buy" : "Rent"} />
            <Info label="Type" value={labelOf(PROPERTY_TYPES, lead.propertyType) || "Any"} />
            <Info label="Emirate" value={lead.emirate || "Any"} />
            <Info label="Communities" value={lead.communities} />
            <Info label="Bedrooms" value={lead.bedroomsMin !== null || lead.bedroomsMax !== null
              ? [bedroomsLabel(lead.bedroomsMin) || "Any", bedroomsLabel(lead.bedroomsMax) || "Any"].join(" – ") : null} />
            <Info label="Budget" value={lead.budgetMin || lead.budgetMax
              ? `${lead.budgetMin ? formatAed(lead.budgetMin) : "Any"} – ${lead.budgetMax ? formatAed(lead.budgetMax) : "Any"}` : null} />
            <Info label="Finance" value={labelOf(FINANCE, lead.finance)} />
            <Info label="Down payment max" value={lead.downPaymentMax ? formatAed(lead.downPaymentMax) : null} />
            <Info label="Monthly EMI" value={lead.monthlyEmiMax ? formatAed(lead.monthlyEmiMax) : null} />
            <Info label="Plan" value={labelOf(BUY_PLANS, lead.buyPlan)} />
            <Info label="Min. amenities" value={lead.minAmenities} />
            <Info label="Ready / Off-Plan" value={labelOf(LEAD_COMPLETIONS, lead.completion)} />
            <Info label="Timeline" value={labelOf(MOVE_TIMELINES, lead.moveTimeline)} />
            <Info label="Buyer Type" value={labelOf(BUYER_TYPES, lead.buyerType)} />
            {lead.requirements && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{lead.requirements}</p>}
          </div>

          <div className={`${card} p-4`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Status</h3>
              {!statusForm && (
                <button onClick={() => setStatusForm({ status: lead.status, lostReason: lead.lostReason ?? "", wonPropertyId: lead.wonPropertyId ?? "", dealValue: lead.dealValue ?? "", commissionAmount: lead.commissionAmount ?? "", note: "" })}
                  className={btnOutline}>Change</button>
              )}
            </div>
            {!statusForm ? (
              <>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                <Info label="Reason" value={labelOf(LOST_REASONS, lead.lostReason)} />
                <Info label="Property" value={lead.wonPropertyRef && `${lead.wonPropertyRef} · ${lead.wonPropertyTitle}`} />
                <Info label="Deal Value" value={lead.dealValue && formatAed(lead.dealValue)} />
                <Info label="Commission" value={lead.commissionAmount && formatAed(lead.commissionAmount)} />
                <Info label="Closed" value={lead.closedAt && dateTime(lead.closedAt)} />
              </>
            ) : (
              <form onSubmit={saveStatus} className="space-y-3">
                <select value={statusForm.status} onChange={(e) => setStatusForm((s) => ({ ...s, status: e.target.value }))} className={inputCls}>
                  {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                {["LOST", "NOT_INTERESTED"].includes(statusForm.status) && (
                  <div>
                    <label className={labelCls}>Reason *</label>
                    <select value={statusForm.lostReason} onChange={(e) => setStatusForm((s) => ({ ...s, lostReason: e.target.value }))} className={inputCls} required>
                      <option value="">Choose...</option>
                      {LOST_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                )}
                {statusForm.status === "WON" && (
                  <>
                    <div>
                      <label className={labelCls}>Property</label>
                      <select value={statusForm.wonPropertyId} onChange={(e) => setStatusForm((s) => ({ ...s, wonPropertyId: e.target.value }))} className={inputCls}>
                        <option value="">—</option>
                        {properties.map((p) => <option key={p.propertyId} value={p.propertyId}>{propertyLabel(p)}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Deal Value (AED)</label>
                        <input type="number" min="0" value={statusForm.dealValue} onChange={(e) => setStatusForm((s) => ({ ...s, dealValue: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Commission (AED)</label>
                        <input type="number" min="0" value={statusForm.commissionAmount} onChange={(e) => setStatusForm((s) => ({ ...s, commissionAmount: e.target.value }))} className={inputCls} />
                      </div>
                    </div>
                  </>
                )}
                <textarea value={statusForm.note} onChange={(e) => setStatusForm((s) => ({ ...s, note: e.target.value }))} rows={2} maxLength={2000}
                  placeholder="Note (optional)" className={inputCls} />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setStatusForm(null)} className={btnOutline}>Cancel</button>
                  <button type="submit" disabled={busy} className={btnPrimary}>Save</button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="space-y-4 min-w-0">
          <LeadMatches lead={lead} onError={setError} onShared={(msg) => { setSuccess(msg); load(); }} />

          <div className={`${card} p-4`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Follow-ups</h3>
              {!followForm && (
                <button onClick={() => setFollowForm({ followUpType: "CALL", dueAt: tomorrow10(), notes: "", propertyId: "" })}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-medium">
                  <Plus className="h-3.5 w-3.5" /> Schedule
                </button>
              )}
            </div>

            {followForm && (
              <form onSubmit={addFollowUp} className="mb-4 rounded-lg border border-gray-200 dark:border-slate-700 p-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Type</label>
                    <select value={followForm.followUpType} onChange={(e) => setFollowForm((f) => ({ ...f, followUpType: e.target.value }))} className={inputCls}>
                      {FOLLOW_UP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Date & Time *</label>
                    <input type="datetime-local" value={followForm.dueAt} onChange={(e) => setFollowForm((f) => ({ ...f, dueAt: e.target.value }))} className={inputCls} />
                  </div>
                  {["VIEWING", "MEETING"].includes(followForm.followUpType) && (
                    <div>
                      <label className={labelCls}>Property</label>
                      <select value={followForm.propertyId} onChange={(e) => setFollowForm((f) => ({ ...f, propertyId: e.target.value }))} className={inputCls}>
                        <option value="">—</option>
                        {properties.filter((p) => p.status === "AVAILABLE").map((p) => <option key={p.propertyId} value={p.propertyId}>{propertyLabel(p)}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <input value={followForm.notes} onChange={(e) => setFollowForm((f) => ({ ...f, notes: e.target.value }))} maxLength={1000}
                  placeholder="What is this follow-up about?" className={inputCls} />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setFollowForm(null)} className={btnOutline}>Cancel</button>
                  <button type="submit" disabled={busy} className={btnPrimary}>Schedule</button>
                </div>
              </form>
            )}

            {openFollowUps.length === 0 && !followForm && (
              <p className="text-sm text-gray-400">No follow-up scheduled. Schedule one so this lead doesn't go cold.</p>
            )}
            <ul className="space-y-2">
              {openFollowUps.map((f) => {
                const overdue = toDate(f.dueAt) < new Date();
                return (
                  <li key={f.followUpId} className={`rounded-lg border px-3 py-2 ${overdue ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/10" : "border-gray-200 dark:border-slate-700"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className={`flex items-center gap-1.5 text-sm font-medium ${overdue ? "text-red-700 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>
                          <CalendarClock className="h-4 w-4" />
                          {labelOf(FOLLOW_UP_TYPES, f.followUpType)} · {dateTime(f.dueAt)}{overdue && " · Overdue"}
                        </div>
                        {f.propertyRef && <div className="text-xs text-blue-600">{f.propertyRef} · {f.propertyTitle}</div>}
                        {f.notes && <div className="text-sm text-gray-600 dark:text-gray-300">{f.notes}</div>}
                      </div>
                      {completing?.id !== f.followUpId && (
                        <div className="flex shrink-0 items-center gap-1">
                          <button onClick={() => setCompleting({ id: f.followUpId, result: "" })} className="inline-flex items-center gap-1 rounded-lg border border-green-300 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Done
                          </button>
                          <button onClick={() => run(() => FollowUpService.remove(f.followUpId), "Follow-up removed.", "Failed to remove follow-up.")}
                            className="rounded p-1 text-gray-400 hover:text-red-600" title="Remove"><X className="h-4 w-4" /></button>
                        </div>
                      )}
                    </div>
                    {completing?.id === f.followUpId && (
                      <form onSubmit={completeFollowUp} className="mt-2 flex gap-2">
                        <input autoFocus value={completing.result} onChange={(e) => setCompleting((c) => ({ ...c, result: e.target.value }))} maxLength={2000}
                          placeholder="What happened? (optional)" className={inputCls} />
                        <button type="submit" disabled={busy} className={btnPrimary}>Save</button>
                        <button type="button" onClick={() => setCompleting(null)} className={btnOutline}>Cancel</button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
            {doneFollowUps.length > 0 && (
              <div className="mt-3 border-t border-gray-100 dark:border-slate-800 pt-2">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Recently done</div>
                <ul className="space-y-1">
                  {doneFollowUps.map((f) => (
                    <li key={f.followUpId} className="text-xs text-gray-500 dark:text-gray-400 line-through decoration-gray-300">
                      {labelOf(FOLLOW_UP_TYPES, f.followUpType)} · {dateTime(f.dueAt)}{f.notes ? ` · ${f.notes}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className={`${card} p-4`}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Timeline</h3>
            <form onSubmit={addActivity} className="mb-5 rounded-lg border border-gray-200 dark:border-slate-700 p-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                {[["NOTE", "Note", StickyNote], ["CALL", "Log Call", Phone], ["MEETING", "Meeting", Users], ["VIEWING", "Viewing", Eye]].map(([v, label, Icon]) => (
                  <button type="button" key={v} onClick={() => setActivity((a) => ({ ...a, activityType: v }))}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${activity.activityType === v
                      ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"}`}>
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
              {activity.activityType === "CALL" && (
                <select value={activity.outcome} onChange={(e) => setActivity((a) => ({ ...a, outcome: e.target.value }))} className={`${inputCls} max-w-xs`}>
                  {CALL_OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
              {activity.activityType === "VIEWING" && (
                <select value={activity.propertyId} onChange={(e) => setActivity((a) => ({ ...a, propertyId: e.target.value }))} className={inputCls}>
                  <option value="">Property viewed...</option>
                  {properties.map((p) => <option key={p.propertyId} value={p.propertyId}>{propertyLabel(p)}</option>)}
                </select>
              )}
              <textarea value={activity.body} onChange={(e) => setActivity((a) => ({ ...a, body: e.target.value }))} rows={2} maxLength={2000}
                placeholder={activity.activityType === "NOTE" ? "Write a note..." : "Details / customer feedback (optional)"} className={inputCls} />
              <div className="flex justify-end">
                <button type="submit" disabled={busy} className={btnPrimary}>Add to Timeline</button>
              </div>
            </form>

            {timeline.length === 0 ? <p className="text-sm text-gray-400">Nothing yet.</p> : (
              <ul className="space-y-4">
                {timeline.map((t) => <TimelineItem key={`${t.kind}-${t.id}`} t={t} />)}
              </ul>
            )}
          </div>
        </div>
      </div>

      <DeleteModal open={confirmDelete} name={`${lead.leadNo} – ${displayName(lead)}`} onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try { await LeadService.remove(lead.leadId); navigate("/leads"); }
          catch { setError("Failed to delete lead."); setConfirmDelete(false); }
        }} />
    </div>
  );
}
