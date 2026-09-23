import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  MessagesSquare, RefreshCw, Search, Send, Bot, Check, CheckCheck, AlertCircle, Clock, Loader2, Mail, Phone, UserCheck,
} from "lucide-react";
import { InboxService, CustomerService } from "@/ServiceLayer/WhatsAppService/WhatsAppService";
import { StaffService } from "@/ServiceLayer/AuthService/AuthService";
import { useAuth } from "@/context/AuthContext";
import { Alerts, inputCls } from "@/components/common/ui";
import { apiError } from "@/lib/apiClient";
import { formatDate } from "@/lib/utils";
import { toDate, hhmm, shortTime, displayName } from "@/lib/time";

const POLL_MS = 5000;

function preview(c) {
  if (!c.lastDirection) return "";
  const body = c.lastType && c.lastType !== "text" ? `[${c.lastType}]` : c.lastBody || "";
  return c.lastDirection === "OUT" ? `You: ${body}` : body;
}

function StatusIcon({ status }) {
  if (status === "read") return <CheckCheck className="h-3.5 w-3.5 text-sky-300" />;
  if (status === "delivered") return <CheckCheck className="h-3.5 w-3.5" />;
  if (status === "sent") return <Check className="h-3.5 w-3.5" />;
  if (status === "failed") return <AlertCircle className="h-3.5 w-3.5 text-red-200" />;
  return <Clock className="h-3.5 w-3.5" />;
}

export default function InboxPage() {
  const { isAdmin, refreshUnread } = useAuth();
  const [params, setParams] = useSearchParams();
  const filter = params.get("filter") || "";
  const staffId = params.get("staffId") || "";

  const [conversations, setConversations] = useState([]);
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [thread, setThread] = useState(null);
  const [text, setText] = useState("");
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
      setConversations(await InboxService.conversations({
        filter: filter || undefined, staffId: staffId || undefined, search: search || undefined,
      }));
    } catch { setError("Failed to load conversations."); }
  };

  const loadThread = async (id) => {
    if (!id) return;
    try { setThread(await InboxService.messages(id)); }
    catch (err) {
      // Reassigned away from this staff member while open.
      if (err?.response?.status === 404) { setActiveId(null); setThread(null); }
      else setError("Failed to load messages.");
    }
  };

  const refresh = async () => {
    setLoading(true);
    await Promise.all([loadConversations(), loadThread(activeId)]);
    setLoading(false);
  };

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
    lastCountRef.current = 0;
    if (!activeId) return;
    loadThread(activeId).then(() => { loadConversations(); refreshUnread(); });
    const t = setInterval(() => loadThread(activeId), POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Only jump to the bottom when new messages arrive, not on every poll.
  useEffect(() => {
    const count = thread?.messages?.length ?? 0;
    if (count !== lastCountRef.current) bottomRef.current?.scrollIntoView({ block: "end" });
    lastCountRef.current = count;
  }, [thread]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending || !activeId) return;
    setSending(true); setError("");
    try {
      await InboxService.send(activeId, body);
      setText("");
      await Promise.all([loadThread(activeId), loadConversations()]);
    } catch (err) {
      setError(apiError(err, "Failed to send message."));
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
    : [{ key: "", label: "My Chats" }, { key: "unread", label: "Unread" }];

  return (
    <div className="p-6 space-y-4 h-full flex flex-col">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-green-600/10 p-2"><MessagesSquare className="h-6 w-6 text-green-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">WhatsApp Inbox</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isAdmin ? "All customer chats — assign each customer to a staff member" : "Chats with your assigned customers"}
            </p>
          </div>
        </div>
        <button onClick={refresh} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <Alerts success={success} error={error} onClearSuccess={() => setSuccess("")} onClearError={() => setError("")} />

      <div className="flex-1 min-h-[520px] grid grid-cols-1 md:grid-cols-[340px_1fr] bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="flex flex-col min-h-0 border-b md:border-b-0 md:border-r border-gray-200 dark:border-slate-800">
          <div className="p-3 space-y-2 border-b border-gray-200 dark:border-slate-800">
            <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-slate-800 p-1">
              {tabs.map((t) => (
                <button key={t.key} onClick={() => setQuery({ filter: t.key, staffId: "" })}
                  className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                    filter === t.key && !staffId
                      ? "bg-white dark:bg-slate-900 text-green-600 shadow-sm"
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
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or mobile..." className={`${inputCls} pl-9`} />
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto max-h-[70vh]">
            {conversations.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-gray-400">No conversations.</li>
            )}
            {conversations.map((cv) => (
              <li key={cv.customerId}>
                <button onClick={() => setActiveId(cv.customerId)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-slate-800 transition-colors ${
                    cv.customerId === activeId ? "bg-green-50 dark:bg-green-900/20" : "hover:bg-gray-50 dark:hover:bg-slate-800/50"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{displayName(cv)}</span>
                    <span className={`text-[11px] shrink-0 ${cv.unreadCount > 0 ? "text-green-600 font-semibold" : "text-gray-400"}`}>
                      {shortTime(cv.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{preview(cv)}</span>
                    {cv.unreadCount > 0 && (
                      <span className="shrink-0 rounded-full bg-green-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">{cv.unreadCount}</span>
                    )}
                  </div>
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

        <div className="flex flex-col min-h-0">
          {!activeId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-16">
              <MessagesSquare className="h-10 w-10 mb-2" />
              <p className="text-sm">Select a conversation to read messages.</p>
            </div>
          ) : !thread ? (
            <div className="flex-1 flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-gray-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-white">{displayName(c)}</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> +{c.mobileNo}</span>
                    {c.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email}</span>}
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

              <div className="flex-1 overflow-y-auto max-h-[60vh] px-5 py-4 space-y-2 bg-gray-50 dark:bg-slate-950/40">
                {thread.messages.length === 0 && <p className="text-center text-sm text-gray-400 py-10">No messages yet.</p>}
                {thread.messages.map((m, i) => {
                  const d = toDate(m.createdAt);
                  const prev = i > 0 ? toDate(thread.messages[i - 1].createdAt) : null;
                  const newDay = !prev || prev.toDateString() !== d.toDateString();
                  const out = m.direction === "OUT";
                  return (
                    <div key={m.messageId}>
                      {newDay && (
                        <div className="flex justify-center my-3">
                          <span className="rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                            {formatDate(d)}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 shadow-sm ${
                          out ? "bg-green-600 text-white rounded-br-sm" : "bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-bl-sm"}`}>
                          {out && (
                            <div className="flex items-center gap-1 text-[10px] font-medium text-green-100 mb-0.5">
                              {m.isBot === "T" ? <><Bot className="h-3 w-3" /> Bot</> : m.sentByName || "Staff"}
                            </div>
                          )}
                          <div className="text-sm whitespace-pre-wrap break-words">
                            {m.msgType !== "text" ? <span className="italic opacity-80">[{m.msgType} message]</span> : m.body}
                          </div>
                          <div className={`flex items-center justify-end gap-1 mt-0.5 text-[10px] ${out ? "text-green-100" : "text-gray-400"}`}>
                            {hhmm(d)}
                            {out && <StatusIcon status={m.status} />}
                          </div>
                          {m.status === "failed" && m.errorText && <div className="text-[11px] text-red-100 mt-1">{m.errorText}</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {thread.canReply ? (
                <form onSubmit={send} className="flex items-end gap-2 p-3 border-t border-gray-200 dark:border-slate-800">
                  <textarea value={text} onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) send(e); }}
                    rows={2} maxLength={4096} placeholder="Type a reply... (Enter to send, Shift+Enter for new line)"
                    className={`${inputCls} resize-none`} />
                  <button type="submit" disabled={sending || !text.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
                  </button>
                </form>
              ) : (
                <div className="p-3 border-t border-gray-200 dark:border-slate-800 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20">
                  The 24-hour reply window has closed. WhatsApp only allows a reply after the customer messages you again.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
