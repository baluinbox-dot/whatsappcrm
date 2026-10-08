import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Mail, RefreshCw, Search, Send, Loader2, Phone, UserCheck, AlertCircle, Inbox, Reply,
  ArrowLeft,
} from "lucide-react";
import { EmailService } from "@/ServiceLayer/EmailService/EmailService";
import { CustomerService } from "@/ServiceLayer/WhatsAppService/WhatsAppService";
import { StaffService } from "@/ServiceLayer/AuthService/AuthService";
import { useAuth } from "@/context/AuthContext";
import { Alerts, inputCls } from "@/components/common/ui";
import { apiError } from "@/lib/apiClient";
import { shortTime, dateTime, displayName } from "@/lib/time";

const POLL_MS = 15000;

const replySubject = (emails) => {
  const last = [...emails].reverse().find((e) => e.subject);
  if (!last) return "";
  return /^re:/i.test(last.subject) ? last.subject : `Re: ${last.subject}`;
};

export default function EmailInboxPage() {
  const { isAdmin, refreshUnread } = useAuth();
  const [params, setParams] = useSearchParams();
  const filter = params.get("filter") || "";
  const staffId = params.get("staffId") || "";
  const customerParam = params.get("customer");

  const [conversations, setConversations] = useState([]);
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [thread, setThread] = useState(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const lastCountRef = useRef(0);

  const setQuery = (next) => {
    const p = {};
    if (next.filter) p.filter = next.filter;
    if (next.staffId) p.staffId = next.staffId;
    setParams(p);
  };

  const loadConversations = async () => {
    try {
      setConversations(await EmailService.conversations({
        filter: filter || undefined, staffId: staffId || undefined, search: search || undefined,
      }));
    } catch { setError("Failed to load emails."); }
  };

  const loadThread = async (id) => {
    if (!id) return null;
    try {
      const t = await EmailService.emails(id);
      setThread(t);
      return t;
    } catch (err) {
      if (err?.response?.status === 404) { setActiveId(null); setThread(null); }
      else setError("Failed to load emails.");
      return null;
    }
  };

  const refresh = async () => {
    setLoading(true);
    await Promise.all([loadConversations(), loadThread(activeId)]);
    setLoading(false);
  };

  useEffect(() => {
    if (customerParam) setActiveId(Number(customerParam));
  }, [customerParam]);

  useEffect(() => {
    if (isAdmin) StaffService.getAll().then((rows) => setStaff(rows.filter((s) => s.isActive === "T"))).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    loadConversations();
    const t = setInterval(loadConversations, POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, staffId, search]);

  useEffect(() => {
    setThread(null);
    setBody("");
    setSubject("");
    lastCountRef.current = 0;
    if (!activeId) return;
    loadThread(activeId).then((t) => {
      if (t) setSubject(replySubject(t.emails));
      loadConversations();
      refreshUnread();
    });
    const t = setInterval(() => loadThread(activeId), POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    const count = thread?.emails?.length ?? 0;
    if (count !== lastCountRef.current) bottomRef.current?.scrollIntoView({ block: "end" });
    lastCountRef.current = count;
  }, [thread]);

  const send = async (e) => {
    e.preventDefault();
    if (sending || !activeId) return;
    if (!subject.trim() || !body.trim()) { setError("Subject and message are required."); return; }
    setSending(true); setError("");
    try {
      await EmailService.send(activeId, subject.trim(), body.trim());
      setBody("");
      setSuccess("Email sent.");
      await Promise.all([loadThread(activeId), loadConversations()]);
    } catch (err) {
      setError(apiError(err, "Failed to send email."));
      loadThread(activeId);
    } finally { setSending(false); }
  };

  const assign = async (value) => {
    if (!activeId) return;
    setAssigning(true); setError("");
    try {
      const updated = await CustomerService.assign(activeId, value ? Number(value) : null);
      setSuccess(updated.assignedToName ? `Assigned to ${updated.assignedToName}.` : "Customer unassigned.");
      await Promise.all([loadThread(activeId), loadConversations()]);
    } catch (err) {
      setError(apiError(err, "Failed to assign customer."));
    } finally { setAssigning(false); }
  };

  const c = thread?.customer;
  const tabs = isAdmin
    ? [{ key: "", label: "All" }, { key: "unassigned", label: "Unassigned" }, { key: "unread", label: "Unread" }]
    : [{ key: "", label: "My Emails" }, { key: "unread", label: "Unread" }];

  return (
    <div className="p-4 sm:p-6 space-y-4 h-full flex flex-col">
      <div className={`flex flex-wrap items-start justify-between gap-3 ${activeId ? "hidden md:flex" : ""}`}>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600/10 p-2"><Mail className="h-6 w-6 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Inbox</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isAdmin ? "All customer emails — assign each customer to a staff member" : "Emails from your assigned customers"}
            </p>
          </div>
        </div>
        <button onClick={refresh} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <Alerts success={success} error={error} onClearSuccess={() => setSuccess("")} onClearError={() => setError("")} />

      <div className="flex-1 min-h-[520px] grid grid-cols-1 md:grid-cols-[340px_1fr] bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className={`${activeId ? "hidden md:flex" : "flex"} flex-col min-h-0 md:border-r border-gray-200 dark:border-slate-800`}>
          <div className="p-3 space-y-2 border-b border-gray-200 dark:border-slate-800">
            <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-slate-800 p-1">
              {tabs.map((t) => (
                <button key={t.key} onClick={() => setQuery({ filter: t.key, staffId: "" })}
                  className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                    filter === t.key && !staffId
                      ? "bg-white dark:bg-slate-900 text-blue-600 shadow-sm"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {isAdmin && (
              <select value={staffId} onChange={(e) => setQuery({ filter: "", staffId: e.target.value })} className={inputCls}>
                <option value="">Filter by staff…</option>
                {staff.map((s) => <option key={s.userId} value={s.userId}>{s.fullName}</option>)}
              </select>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email..." className={`${inputCls} pl-9`} />
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto max-h-[70vh]">
            {conversations.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-gray-400">No emails.</li>
            )}
            {conversations.map((cv) => (
              <li key={cv.customerId}>
                <button onClick={() => setActiveId(cv.customerId)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-slate-800 transition-colors ${
                    cv.customerId === activeId ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-slate-800/50"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm truncate text-gray-900 dark:text-white ${cv.emailUnreadCount > 0 ? "font-bold" : "font-semibold"}`}>{displayName(cv)}</span>
                    <span className={`text-[11px] shrink-0 ${cv.emailUnreadCount > 0 ? "text-blue-600 font-semibold" : "text-gray-400"}`}>
                      {shortTime(cv.lastEmailAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                      {cv.lastDirection === "OUT" && <Reply className="inline h-3 w-3 mr-1 -mt-0.5" />}
                      {cv.lastSubject || "(no subject)"}
                    </span>
                    {cv.emailUnreadCount > 0 && (
                      <span className="shrink-0 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">{cv.emailUnreadCount}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 truncate mt-0.5">{cv.lastBody}</div>
                  {isAdmin && (
                    <div className={`mt-1 text-[11px] ${cv.assignedToName ? "text-gray-400" : "text-amber-600 font-medium"}`}>
                      {cv.assignedToName ? `→ ${cv.assignedToName}` : "Unassigned"}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className={`${activeId ? "flex" : "hidden md:flex"} flex-col min-h-0`}>
          {!activeId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-16">
              <Inbox className="h-10 w-10 mb-2" />
              <p className="text-sm">Select a customer to read emails.</p>
            </div>
          ) : !thread ? (
            <div className="flex-1 flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : (
            <>
              <button type="button" onClick={() => setActiveId(null)}
                className="md:hidden flex items-center gap-1.5 border-b border-gray-200 dark:border-slate-800 px-4 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400">
                <ArrowLeft className="h-4 w-4" /> All chats
              </button>
              <div className="px-5 py-3 border-b border-gray-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-white">{displayName(c)}</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {c.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email}</span>}
                    {c.mobileNo && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> +{c.mobileNo}</span>}
                  </div>
                </div>
                {isAdmin ? (
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-gray-400" />
                    <select value={c.assignedTo ?? ""} disabled={assigning} onChange={(e) => assign(e.target.value)}
                      className={`${inputCls.replace("w-full ", "")} w-48 ${c.assignedTo ? "" : "border-amber-400"}`}>
                      <option value="">Unassigned</option>
                      {staff.map((s) => <option key={s.userId} value={s.userId}>{s.fullName}</option>)}
                    </select>
                  </div>
                ) : (
                  <span className="text-xs text-gray-500 dark:text-gray-400">Assigned to you</span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto max-h-[55vh] px-5 py-4 space-y-3 bg-gray-50 dark:bg-slate-950/40">
                {thread.emails.length === 0 && <p className="text-center text-sm text-gray-400 py-10">No emails yet.</p>}
                {thread.emails.map((m) => {
                  const out = m.direction === "OUT";
                  return (
                    <div key={m.emailId} className={`rounded-xl border shadow-sm ${out ? "ml-8 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30" : "mr-8 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900"}`}>
                      <div className="px-4 py-2 border-b border-inherit flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{m.subject || "(no subject)"}</div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                            {out ? `${m.sentByName || "Staff"} → ${m.toAddress}` : `From ${m.fromAddress}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-gray-400 shrink-0">
                          {out && m.status === "failed" && (
                            <span className="inline-flex items-center gap-1 text-red-600"><AlertCircle className="h-3.5 w-3.5" /> Failed</span>
                          )}
                          {out && m.status === "sent" && <span className="text-blue-600">Sent</span>}
                          {!out && <span className="text-green-600">Received</span>}
                          {dateTime(m.createdAt)}
                        </div>
                      </div>
                      <div className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                        {m.body || <span className="italic text-gray-400">(empty)</span>}
                      </div>
                      {m.status === "failed" && m.errorText && (
                        <div className="px-4 pb-3 text-xs text-red-600 dark:text-red-400">{m.errorText}</div>
                      )}
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {c.email ? (
                <form onSubmit={send} className="p-3 border-t border-gray-200 dark:border-slate-800 space-y-2">
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={500}
                    placeholder="Subject" className={inputCls} />
                  <div className="flex items-end gap-2">
                    <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4}
                      placeholder={`Write to ${c.email}...`} className={`${inputCls} resize-y`} />
                    <button type="submit" disabled={sending || !body.trim() || !subject.trim()}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-3 border-t border-gray-200 dark:border-slate-800 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20">
                  This customer has no email ID. Add one on the Customers page to send email.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
