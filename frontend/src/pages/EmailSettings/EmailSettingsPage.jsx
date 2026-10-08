import { useEffect, useState } from "react";
import { AtSign, RefreshCw, Save, ShieldCheck, Loader2 } from "lucide-react";
import { EmailService } from "@/ServiceLayer/EmailService/EmailService";
import { Alerts, inputCls, labelCls } from "@/components/common/ui";
import { apiError } from "@/lib/apiClient";
import { dateTime } from "@/lib/time";

const emptyForm = {
  emailAddress: "", fromName: "", username: "", password: "",
  imapHost: "imap.gmail.com", imapPort: "993", smtpHost: "smtp.gmail.com", smtpPort: "587",
};

export default function EmailSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const apply = (s) => {
    setSettings(s);
    if (!s.emailAddress) return;
    setForm({
      emailAddress: s.emailAddress ?? "", fromName: s.fromName ?? "", username: s.username ?? "", password: "",
      imapHost: s.imapHost ?? "", imapPort: String(s.imapPort ?? 993),
      smtpHost: s.smtpHost ?? "", smtpPort: String(s.smtpPort ?? 587),
    });
  };

  const load = async () => {
    setLoading(true);
    try { apply(await EmailService.getSettings()); }
    catch (err) { setError(apiError(err, "Failed to load email settings.")); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // The login is usually the email address itself.
  const setEmail = (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, emailAddress: v, username: !f.username || f.username === f.emailAddress ? v : f.username }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.emailAddress.trim()) return setError("Email address is required.");
    if (!form.username.trim()) return setError("Username is required.");
    if (!form.password.trim() && settings?.hasPassword !== "T") return setError("Password is required.");
    if (!form.imapHost.trim() || !form.smtpHost.trim()) return setError("IMAP and SMTP servers are required.");
    setSaving(true); setError("");
    try {
      apply(await EmailService.saveSettings({
        emailAddress: form.emailAddress.trim(),
        fromName: form.fromName.trim() || null,
        username: form.username.trim(),
        password: form.password || null,
        imapHost: form.imapHost.trim(),
        imapPort: Number(form.imapPort) || 993,
        smtpHost: form.smtpHost.trim(),
        smtpPort: Number(form.smtpPort) || 587,
      }));
      setSuccess("Email settings saved. Click Verify Connection to start receiving emails.");
    } catch (err) {
      setError(apiError(err, "Failed to save email settings."));
    } finally { setSaving(false); }
  };

  const verify = async () => {
    setVerifying(true); setError(""); setSuccess("");
    try {
      apply(await EmailService.verify());
      setSuccess("Connected. New emails will appear in the Email Inbox within a minute.");
    } catch (err) {
      setError(apiError(err, "Verification failed."));
      load();
    } finally { setVerifying(false); }
  };

  const verified = settings?.isVerified === "T";

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600/10 p-2"><AtSign className="h-6 w-6 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Settings</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Connect your company mailbox to capture customers by email</p>
          </div>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <Alerts success={success} error={error} onClearSuccess={() => setSuccess("")} onClearError={() => setError("")} />

      <form onSubmit={save} className="max-w-3xl bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <AtSign className="h-5 w-5 text-blue-600" /> Company Mailbox
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            When someone emails this address, their email ID and name are saved as a customer and the email
            appears in the Email Inbox. Assign the customer to staff, who reply from here — the full sent and
            received history is kept.
          </p>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
              verified ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-amber-400 text-gray-900"}`}>
              {verified ? "Connected" : "Not connected"}
            </span>
            {verified && settings?.lastCheckedAt && (
              <span className="text-xs text-gray-500 dark:text-gray-400">Last checked {dateTime(settings.lastCheckedAt)}</span>
            )}
          </div>
          {settings?.lastError && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">Last error: {settings.lastError}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Email Address <span className="text-red-500">*</span></label>
            <input type="email" value={form.emailAddress} onChange={setEmail} className={inputCls} placeholder="support@yourcompany.com" />
          </div>
          <div>
            <label className={labelCls}>Sender Name</label>
            <input value={form.fromName} onChange={set("fromName")} className={inputCls} placeholder="e.g. iStreams Support" />
          </div>
          <div>
            <label className={labelCls}>Username <span className="text-red-500">*</span></label>
            <input value={form.username} onChange={set("username")} className={inputCls} autoComplete="off" />
          </div>
          <div>
            <label className={labelCls}>Password {settings?.hasPassword !== "T" && <span className="text-red-500">*</span>}</label>
            <input type="password" value={form.password} onChange={set("password")} className={inputCls}
              autoComplete="new-password" placeholder={settings?.hasPassword === "T" ? "••••••••" : ""} />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {settings?.hasPassword === "T"
                ? "A password is already saved. Leave blank to keep it."
                : "Gmail: use a 16-character App Password (Google Account → Security → App passwords)."}
            </p>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-slate-800 pt-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Servers</h3>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-4">
            <div>
              <label className={labelCls}>IMAP Server (incoming) <span className="text-red-500">*</span></label>
              <input value={form.imapHost} onChange={set("imapHost")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>IMAP Port</label>
              <input type="number" value={form.imapPort} onChange={set("imapPort")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>SMTP Server (outgoing) <span className="text-red-500">*</span></label>
              <input value={form.smtpHost} onChange={set("smtpHost")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>SMTP Port</label>
              <input type="number" value={form.smtpPort} onChange={set("smtpPort")} className={inputCls} />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Gmail: imap.gmail.com 993 / smtp.gmail.com 587 · Outlook: outlook.office365.com 993 / smtp.office365.com 587 ·
            Zoho: imap.zoho.com 993 / smtp.zoho.com 587
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Email Settings"}
          </button>
          <button type="button" onClick={verify} disabled={verifying || settings?.hasPassword !== "T"}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50">
            {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Verify Connection
          </button>
        </div>
      </form>
    </div>
  );
}
