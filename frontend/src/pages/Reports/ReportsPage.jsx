import { useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import client, { apiError } from "@/lib/apiClient";
import { StaffService } from "@/ServiceLayer/AuthService/AuthService";
import { useAuth } from "@/context/AuthContext";
import { Alerts, inputCls, labelCls } from "@/components/common/ui";
import { formatDate } from "@/lib/utils";
import { LEAD_STATUSES, LEAD_SOURCES, labelOf, formatAed } from "@/lib/realEstate";

const card = "bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm";
const bar = "bg-blue-600 dark:bg-blue-500";
const track = "bg-gray-100 dark:bg-slate-800";

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const PRESETS = {
  thisMonth: { label: "This month", range: (t) => [new Date(t.getFullYear(), t.getMonth(), 1), t] },
  lastMonth: { label: "Last month", range: (t) => [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)] },
  last30: { label: "Last 30 days", range: (t) => [new Date(t.getFullYear(), t.getMonth(), t.getDate() - 29), t] },
  last90: { label: "Last 90 days", range: (t) => [new Date(t.getFullYear(), t.getMonth(), t.getDate() - 89), t] },
  thisYear: { label: "This year", range: (t) => [new Date(t.getFullYear(), 0, 1), t] },
  custom: { label: "Custom range" },
};

const pct = (a, b) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

function Stat({ label, value, hint }) {
  return (
    <div className={`${card} p-4`}>
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-xl xl:text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-gray-400">{hint}</div>}
    </div>
  );
}

// Days in the period, zero-filled; grouped by week when the period is long.
function buildSeries(byDay, from, to) {
  const counts = Object.fromEntries(byDay.map((d) => [d.day.slice(0, 10), d.leads]));
  const days = [];
  for (let d = new Date(`${from}T00:00:00`); iso(d) <= to; d.setDate(d.getDate() + 1)) days.push({ day: iso(d), leads: counts[iso(d)] ?? 0 });
  if (days.length <= 62) return { weekly: false, points: days.map((d) => ({ label: formatDate(d.day), leads: d.leads })) };
  const weeks = [];
  days.forEach((d, i) => {
    if (i % 7 === 0) weeks.push({ label: `Week of ${formatDate(d.day)}`, leads: 0 });
    weeks[weeks.length - 1].leads += d.leads;
  });
  return { weekly: true, points: weeks };
}

function LeadsOverTime({ series }) {
  const max = Math.max(1, ...series.points.map((p) => p.leads));
  const n = series.points.length;
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">New leads {series.weekly ? "per week" : "per day"}</h3>
        <span className="text-xs text-gray-400">max {max}</span>
      </div>
      <div className="mt-3 flex h-40 items-end gap-[2px] border-b border-gray-200 dark:border-slate-700">
        {series.points.map((p, i) => (
          <div key={i} className="group relative flex h-full flex-1 items-end justify-center">
            <div className={`w-full max-w-6 rounded-t ${p.leads ? bar : ""}`} style={{ height: `${(p.leads / max) * 100}%` }} />
            <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow group-hover:block">
              {p.label}: <b>{p.leads}</b> {p.leads === 1 ? "lead" : "leads"}
            </div>
          </div>
        ))}
      </div>
      {n > 0 && (
        <div className="mt-1 flex justify-between text-[11px] text-gray-400">
          <span>{series.points[0].label}</span>
          {n > 1 && <span>{series.points[n - 1].label}</span>}
        </div>
      )}
    </div>
  );
}

function HBars({ title, rows, empty }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className={`${card} p-4`}>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-gray-400">{empty}</p> : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="grid grid-cols-[130px_1fr_auto] items-center gap-3 text-sm" title={`${r.label}: ${r.value}${r.note ? ` · ${r.note}` : ""}`}>
              <span className="truncate text-gray-600 dark:text-gray-300">{r.label}</span>
              <div className={`h-3 rounded ${track}`}>
                <div className={`h-3 rounded ${bar}`} style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
              <span className="w-20 text-right tabular-nums text-gray-900 dark:text-white">
                {r.value}{r.note && <span className="ml-1 text-xs text-gray-400">{r.note}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const { isAdmin } = useAuth();
  const [preset, setPreset] = useState("thisMonth");
  const [range, setRange] = useState(() => PRESETS.thisMonth.range(new Date()).map(iso));
  const [agentId, setAgentId] = useState("");
  const [staff, setStaff] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async (r = range, a = agentId) => {
    setLoading(true); setError("");
    try {
      const res = await client.get("/reports/leads", {
        params: { from: r[0], to: r[1], tzOffset: new Date().getTimezoneOffset(), agentId: a || undefined },
      });
      setData({ ...res.data, from: r[0], to: r[1] });
    } catch (err) { setError(apiError(err, "Failed to load the report.")); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    if (isAdmin) StaffService.getAll().then(setStaff).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choosePreset = (p) => {
    setPreset(p);
    if (p === "custom") return;
    const r = PRESETS[p].range(new Date()).map(iso);
    setRange(r); load(r);
  };

  const setCustom = (i) => (e) => {
    const r = [...range]; r[i] = e.target.value; setRange(r);
    if (r[0] && r[1] && r[0] <= r[1]) load(r);
  };

  const series = useMemo(() => (data ? buildSeries(data.byDay, data.from, data.to) : null), [data]);
  const s = data?.summary;

  const statusRows = data ? LEAD_STATUSES
    .map((st) => ({ label: st.label, value: data.byStatus.find((x) => x.key === st.value)?.leads ?? 0 }))
    .filter((r) => r.value > 0) : [];
  const sourceRows = data ? data.bySource.map((x) => ({
    label: labelOf(LEAD_SOURCES, x.key), value: x.leads, note: x.won ? `${x.won} won` : "",
  })) : [];

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600/10 p-2"><BarChart3 className="h-6 w-6 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{isAdmin ? "Leads, conversions and agent performance" : "Your leads and results"}</p>
          </div>
        </div>
        <button onClick={() => load()} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={labelCls}>Period</label>
          <select value={preset} onChange={(e) => choosePreset(e.target.value)} className={`${inputCls.replace("w-full ", "")} w-40`}>
            {Object.entries(PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        {preset === "custom" ? (
          <>
            <div><label className={labelCls}>From</label><input type="date" value={range[0]} onChange={setCustom(0)} className={`${inputCls.replace("w-full ", "")} w-40`} /></div>
            <div><label className={labelCls}>To</label><input type="date" value={range[1]} onChange={setCustom(1)} className={`${inputCls.replace("w-full ", "")} w-40`} /></div>
          </>
        ) : (
          <span className="pb-2 text-sm text-gray-500 dark:text-gray-400">{formatDate(range[0])} – {formatDate(range[1])}</span>
        )}
        {isAdmin && (
          <div>
            <label className={labelCls}>Agent</label>
            <select value={agentId} onChange={(e) => { setAgentId(e.target.value); load(range, e.target.value); }} className={`${inputCls.replace("w-full ", "")} w-44`}>
              <option value="">All agents</option>
              {staff.map((u) => <option key={u.userId} value={u.userId}>{u.fullName}{u.isActive === "T" ? "" : " (inactive)"}</option>)}
            </select>
          </div>
        )}
      </div>

      <Alerts error={error} onClearError={() => setError("")} />

      {s && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="New Leads" value={s.newLeads} hint="created in the period" />
            <Stat label="Conversion" value={pct(s.newLeadsWon, s.newLeads)} hint={`${s.newLeadsWon} of the new leads are won`} />
            <Stat label="Deals Won" value={s.dealsWon} hint={`win rate ${pct(s.dealsWon, s.dealsWon + s.dealsLost)} of ${s.dealsWon + s.dealsLost} closed`} />
            <Stat label="Deal Value" value={formatAed(s.dealValue) || "AED 0"} hint={`commission ${formatAed(s.commission) || "AED 0"}`} />
            <Stat label="Open Leads" value={s.openLeads} hint="right now" />
            <Stat label="Deals Lost" value={s.dealsLost} hint="lost / not interested in the period" />
            <Stat label="Overdue Follow-ups" value={s.overdueFollowUps} hint="right now" />
            <Stat label="Avg. Deal" value={s.dealsWon ? formatAed(s.dealValue / s.dealsWon) : "—"} hint="deal value ÷ deals won" />
          </div>

          <LeadsOverTime series={series} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <HBars title="New leads by current status" rows={statusRows} empty="No leads created in this period." />
            <HBars title="New leads by source" rows={sourceRows} empty="No leads created in this period." />
          </div>

          <div className={`${card} overflow-hidden`}>
            <h3 className="px-4 pt-4 pb-3 text-sm font-semibold text-gray-900 dark:text-white">{isAdmin ? "Agent performance" : "My performance"}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-slate-800 border-y border-gray-200 dark:border-slate-700">
                  <tr className="text-left text-gray-600 dark:text-gray-300">
                    <th className="px-4 py-2.5 font-medium">Agent</th>
                    <th className="px-4 py-2.5 font-medium text-right">New Leads</th>
                    <th className="px-4 py-2.5 font-medium text-right">Still Open</th>
                    <th className="px-4 py-2.5 font-medium text-right">Won</th>
                    <th className="px-4 py-2.5 font-medium text-right">Lost</th>
                    <th className="px-4 py-2.5 font-medium text-right">Conversion</th>
                    <th className="px-4 py-2.5 font-medium text-right">Deals Closed</th>
                    <th className="px-4 py-2.5 font-medium text-right">Deal Value</th>
                    <th className="px-4 py-2.5 font-medium text-right">Commission</th>
                    <th className="px-4 py-2.5 font-medium text-right">Follow-ups Done</th>
                    <th className="px-4 py-2.5 font-medium text-right">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byAgent.length === 0 && (
                    <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">No activity in this period.</td></tr>
                  )}
                  {data.byAgent.map((a) => (
                    <tr key={a.userId ?? "none"} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors tabular-nums">
                      <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{a.fullName ?? <span className="text-amber-600">Unassigned</span>}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-200">{a.leads}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-200">{a.open}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-200">{a.won}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-200">{a.lost}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-200">{pct(a.won, a.leads)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-200">{a.dealsWon}</td>
                      <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white">{a.dealValue ? formatAed(a.dealValue) : "—"}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-200">{a.commission ? formatAed(a.commission) : "—"}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-200">{a.followUpsDone}</td>
                      <td className={`px-4 py-2.5 text-right ${a.overdueFollowUps ? "font-semibold text-red-600" : "text-gray-700 dark:text-gray-200"}`}>{a.overdueFollowUps}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-3 text-xs text-gray-400">
              New Leads, Still Open, Won, Lost and Conversion count leads created in the period. Deals Closed, Deal Value and Commission count deals won in the period. Overdue is right now.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
