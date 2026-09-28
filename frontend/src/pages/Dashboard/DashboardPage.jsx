import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard, RefreshCw, Users, UserPlus, Inbox, MailWarning, MessageSquare, Clock, CalendarClock, AlarmClock, Eye,
  Target, Snowflake, CheckCircle2, Building2, ImageOff, Sparkles, Send, ArrowRightLeft, Phone, ArrowRight, Bot,
} from "lucide-react";
import { DashboardService } from "@/ServiceLayer/WhatsAppService/WhatsAppService";
import { FollowUpService } from "@/ServiceLayer/LeadService/LeadService";
import { useAuth } from "@/context/AuthContext";
import { Alerts } from "@/components/common/ui";
import { dateTime, displayName, shortTime, toDate } from "@/lib/time";
import { FOLLOW_UP_TYPES, LEAD_STATUSES, CLOSED_STATUSES, LEAD_SOURCES, labelOf, formatAed } from "@/lib/realEstate";

const card = "bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm";

function StatCard({ icon: Icon, label, value, hint, to, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-600/10 text-blue-600",
    green: "bg-green-600/10 text-green-600",
    amber: "bg-amber-500/10 text-amber-600",
    red: "bg-red-600/10 text-red-600",
  };
  const body = (
    <div className={`${card} p-4 h-full hover:border-gray-300 dark:hover:border-slate-700 transition-colors`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
        <span className={`rounded-lg p-1.5 ${tones[tone]}`}><Icon className="h-4 w-4" /></span>
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">{value ?? "–"}</div>
      {hint && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{hint}</div>}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

function Section({ title, action, children }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const MoreLink = ({ to, children }) => (
  <Link to={to} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">{children} <ArrowRight className="h-3 w-3" /></Link>
);

const pct = (a, b) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

function activityText(a) {
  switch (a.activityType) {
    case "CREATED": return a.byName ? "New lead added" : `New lead from ${labelOf(LEAD_SOURCES, a.leadSource)}`;
    case "SHARE": return `Properties shared — ${a.body ?? ""}`;
    case "STATUS": return a.statusTo === "WON" ? "Deal won" : `Status → ${labelOf(LEAD_STATUSES, a.statusTo)}`;
    case "VIEWING": return "Viewing done";
    case "MEETING": return "Meeting logged";
    case "CALL": return "Call logged";
    default: return a.activityType;
  }
}

const ACTIVITY_ICON = { CREATED: Sparkles, SHARE: Send, STATUS: ArrowRightLeft, VIEWING: Eye, MEETING: Users, CALL: Phone };

export default function DashboardPage() {
  const { isAdmin, user, refreshUnread } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try { setData(await DashboardService.get()); }
    catch { setError("Failed to load dashboard."); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const markDone = async (f) => {
    try { await FollowUpService.complete(f.followUpId, null); load(); refreshUnread(); }
    catch { setError("Failed to update follow-up."); }
  };

  const s = data?.stats;
  const w = data?.work;
  const m = data?.month;
  const inv = data?.inventory;
  const pipeline = LEAD_STATUSES.filter((st) => !CLOSED_STATUSES.includes(st.value))
    .map((st) => ({ ...st, count: data?.pipeline.find((p) => p.status === st.value)?.leads ?? 0 }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600/10 p-2"><LayoutDashboard className="h-6 w-6 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isAdmin ? `${user?.companyName} — all leads, customers and staff` : "Your leads, follow-ups and customers"}
            </p>
          </div>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <Alerts error={error} onClearError={() => setError("")} />

      <Section title="Today">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard icon={AlarmClock} label="Overdue follow-ups" value={w?.overdueFollowUps} tone={w?.overdueFollowUps > 0 ? "red" : "blue"} to="/follow-ups" />
          <StatCard icon={CalendarClock} label="Due today" value={w?.dueToday} to="/follow-ups" />
          <StatCard icon={Eye} label="Viewings today" value={w?.viewingsToday} hint={w ? `${w.viewingsTomorrow} tomorrow` : null} tone="green" to="/follow-ups" />
          <StatCard icon={Target} label="New leads today" value={w?.newLeadsToday} tone="green" to="/leads" />
          {isAdmin && (
            <StatCard icon={Inbox} label="Unassigned leads" value={w?.unassignedLeads} tone={w?.unassignedLeads > 0 ? "amber" : "blue"}
              hint="Waiting for an agent" to="/leads?view=unassigned" />
          )}
          <StatCard icon={Snowflake} label="Going cold" value={w?.coldLeads} tone={w?.coldLeads > 0 ? "amber" : "blue"}
            hint="No activity 7+ days" to="/leads?view=cold" />
        </div>
      </Section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Section title="Next follow-ups" action={<MoreLink to="/follow-ups">All follow-ups</MoreLink>}>
          <div className={`${card} divide-y divide-gray-100 dark:divide-slate-800`}>
            {data && data.nextFollowUps.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-400">Nothing due today.</p>}
            {data?.nextFollowUps.map((f) => {
              const overdue = toDate(f.dueAt) < new Date();
              return (
                <div key={f.followUpId} className="flex items-center gap-3 px-4 py-2.5">
                  <div className={`w-24 shrink-0 text-xs font-medium ${overdue ? "text-red-600" : "text-gray-700 dark:text-gray-300"}`}>
                    {shortTime(f.dueAt)}{overdue && <div className="font-normal">Overdue</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to={`/leads/${f.leadId}`} className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600">{displayName(f) || f.leadNo}</Link>
                    <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {labelOf(FOLLOW_UP_TYPES, f.followUpType)}{f.propertyRef ? ` · ${f.propertyRef}` : ""}{f.notes ? ` · ${f.notes}` : ""}
                      {isAdmin && f.assignedToName ? ` · ${f.assignedToName}` : ""}
                    </div>
                  </div>
                  <button onClick={() => markDone(f)} title="Mark done"
                    className="inline-flex items-center gap-1 rounded-lg border border-green-300 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Done
                  </button>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="Recent activity" action={<MoreLink to="/leads">All leads</MoreLink>}>
          <div className={`${card} divide-y divide-gray-100 dark:divide-slate-800`}>
            {data && data.activity.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-400">No lead activity yet.</p>}
            {data?.activity.map((a) => {
              const Icon = a.activityType === "CREATED" && !a.byName ? Bot : ACTIVITY_ICON[a.activityType] ?? Sparkles;
              const won = a.activityType === "STATUS" && a.statusTo === "WON";
              return (
                <Link key={a.activityId} to={`/leads/${a.leadId}`} className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <span className={`mt-0.5 rounded-full p-1.5 ${won ? "bg-green-100 text-green-700 dark:bg-green-900/30" : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300"}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-gray-900 dark:text-white">
                      <span className="font-medium">{displayName(a) || a.leadNo}</span> — {activityText(a)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{a.leadNo} · {a.byName ?? "Automatic"} · {dateTime(a.createdAt)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Section>
      </div>

      <Section title="This month" action={<MoreLink to="/reports">Full reports</MoreLink>}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard icon={Target} label="New leads" value={m?.newLeads} to="/reports" />
          <StatCard icon={CheckCircle2} label="Deals won" value={m?.dealsWon} tone="green" hint={m ? `${m.dealsLost} lost` : null} to="/reports" />
          <StatCard icon={Target} label="Conversion" value={m ? pct(m.newLeadsWon, m.newLeads) : null} hint="new leads now won" to="/reports" />
          <StatCard icon={Building2} label="Deal value" value={m ? formatAed(m.dealValue) : null} tone="green" to="/reports" />
          <StatCard icon={Building2} label="Commission" value={m ? formatAed(m.commission) : null} tone="green" to="/reports" />
        </div>
        <div className={`${card} p-3`}>
          <div className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Open pipeline — {pipeline.reduce((a, p) => a + p.count, 0)} leads</div>
          <div className="flex flex-wrap gap-2">
            {pipeline.map((p) => (
              <Link key={p.value} to={`/leads?status=${p.value}`}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium hover:opacity-80 ${p.cls}`}>
                {p.label} <span className="font-bold tabular-nums">{p.count}</span>
              </Link>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Properties" action={<MoreLink to="/properties">All properties</MoreLink>}>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard icon={Building2} label="For sale" value={inv?.availableSale} hint="available" to="/properties" />
          <StatCard icon={Building2} label="For rent" value={inv?.availableRent} hint="available" to="/properties" />
          <StatCard icon={Building2} label="Reserved" value={inv?.reserved} tone="amber" to="/properties" />
          <StatCard icon={CheckCircle2} label="Sold" value={inv?.soldMonth} hint="marked this month" tone="green" to="/properties" />
          <StatCard icon={CheckCircle2} label="Rented" value={inv?.rentedMonth} hint="marked this month" tone="green" to="/properties" />
          <StatCard icon={ImageOff} label="No photos" value={inv?.missingPhotos} tone={inv?.missingPhotos > 0 ? "amber" : "blue"}
            hint="available listings" to="/properties" />
        </div>
      </Section>

      <Section title="Chats">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard icon={Users} label={isAdmin ? "Customers" : "My customers"} value={s?.totalCustomers} to="/customers" />
          <StatCard icon={UserPlus} label="New customers today" value={s?.newToday} tone="green" to="/customers" />
          {isAdmin && (
            <StatCard icon={Inbox} label="Unassigned chats" value={s?.unassigned} tone={s?.unassigned > 0 ? "amber" : "blue"} to="/inbox?filter=unassigned" />
          )}
          <StatCard icon={MailWarning} label="Unread chats" value={s?.unreadChats} tone={s?.unreadChats > 0 ? "red" : "blue"} to="/inbox?filter=unread" />
          <StatCard icon={MessageSquare} label="Messages today" value={s?.messagesToday} to="/inbox" />
          <StatCard icon={Clock} label="Reply window open" value={s?.openWindows} tone="green" hint="wrote in last 24h" to="/inbox" />
        </div>
      </Section>

      {isAdmin && (
        <Section title="Staff">
          <div className={`${card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                  <tr className="text-left text-gray-600 dark:text-gray-300">
                    <th className="px-4 py-3 font-medium">Staff</th>
                    <th className="px-4 py-3 font-medium text-right">Open leads</th>
                    <th className="px-4 py-3 font-medium text-right">Overdue follow-ups</th>
                    <th className="px-4 py-3 font-medium text-right">Won this month</th>
                    <th className="px-4 py-3 font-medium text-right">Deal value</th>
                    <th className="px-4 py-3 font-medium text-right">Customers</th>
                    <th className="px-4 py-3 font-medium text-right">Unread chats</th>
                    <th className="px-4 py-3 font-medium text-right">Replies today</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {(data?.staff ?? []).map((st) => (
                    <tr key={st.userId} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        <Link to={`/inbox?staffId=${st.userId}`} className="hover:text-blue-600">{st.fullName}</Link>
                      </td>
                      <td className="px-4 py-3 text-right">{st.openLeads}</td>
                      <td className={`px-4 py-3 text-right ${st.overdueFollowUps > 0 ? "text-red-600 font-semibold" : ""}`}>{st.overdueFollowUps}</td>
                      <td className="px-4 py-3 text-right">{st.dealsWonMonth}</td>
                      <td className="px-4 py-3 text-right">{st.dealValueMonth ? formatAed(st.dealValueMonth) : "—"}</td>
                      <td className="px-4 py-3 text-right">{st.customers}</td>
                      <td className={`px-4 py-3 text-right ${st.unreadChats > 0 ? "text-red-600 font-semibold" : ""}`}>{st.unreadChats}</td>
                      <td className="px-4 py-3 text-right">{st.repliesToday}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          st.isActive === "T" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                              : "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400"}`}>
                          {st.isActive === "T" ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
