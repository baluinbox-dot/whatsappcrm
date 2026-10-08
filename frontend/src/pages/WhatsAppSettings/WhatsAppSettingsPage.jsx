import { useEffect, useState } from "react";
import { MessageCircle, RefreshCw, Save, ShieldCheck, Copy, Loader2 } from "lucide-react";
import { WhatsAppService } from "@/ServiceLayer/WhatsAppService/WhatsAppService";
import { Alerts, inputCls, labelCls } from "@/components/common/ui";
import { apiError, apiBase } from "@/lib/apiClient";

const emptyForm = { wabaId: "", phoneNumberId: "", displayNumber: "", accessToken: "", verifyToken: "", appSecret: "" };

export default function WhatsAppSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const apply = (s) => {
    setSettings(s);
    setForm({
      wabaId: s.wabaId ?? "", phoneNumberId: s.phoneNumberId ?? "", displayNumber: s.displayNumber ?? "",
      accessToken: "", verifyToken: s.verifyToken ?? "", appSecret: "",
    });
  };

  const load = async () => {
    setLoading(true);
    try { apply(await WhatsAppService.getSettings()); }
    catch (err) { setError(apiError(err, "Failed to load WhatsApp settings.")); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.phoneNumberId.trim()) return setError("Phone Number ID is required.");
    if (!form.verifyToken.trim()) return setError("Webhook Verify Token is required.");
    if (!form.accessToken.trim() && settings?.hasAccessToken !== "T") return setError("Access Token is required.");
    setSaving(true); setError("");
    try {
      apply(await WhatsAppService.saveSettings({
        wabaId: form.wabaId || null,
        phoneNumberId: form.phoneNumberId,
        displayNumber: form.displayNumber || null,
        accessToken: form.accessToken || null,
        verifyToken: form.verifyToken,
        appSecret: form.appSecret || null,
      }));
      setSuccess("WhatsApp settings saved.");
    } catch (err) {
      setError(apiError(err, "Failed to save WhatsApp settings."));
    } finally { setSaving(false); }
  };

  const verify = async () => {
    setVerifying(true); setError(""); setSuccess("");
    try {
      const s = await WhatsAppService.verify();
      apply(s);
      setSuccess(`Connected: ${s.verifiedName || "number verified"}.`);
    } catch (err) {
      setError(apiError(err, "Verification failed."));
      load();
    } finally { setVerifying(false); }
  };

  const copy = (text) => navigator.clipboard?.writeText(text).then(() => setSuccess("Copied to clipboard."));

  const verified = settings?.isVerified === "T";
  const webhookUrl = settings?.companyCode ? `${new URL(apiBase(), window.location.origin).href}/whatsapp/webhook/${settings.companyCode}` : "";

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-green-600/10 p-2"><MessageCircle className="h-6 w-6 text-green-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">WhatsApp Settings</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Connect your WhatsApp Business number to capture customers</p>
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
            <MessageCircle className="h-5 w-5 text-green-600" /> WhatsApp Business API
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Connect your own WhatsApp Business Account (WABA). When someone messages your number, the bot asks for
            their name and email and saves them as an unassigned customer for you to assign to staff.
          </p>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
              verified ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                       : "bg-amber-400 text-gray-900"}`}>
              {verified ? "Verified" : "Not verified"}
            </span>
            {verified && settings?.verifiedName && (
              <span className="text-xs text-gray-500 dark:text-gray-400">{settings.verifiedName}</span>
            )}
          </div>
        </div>

        <div>
          <label className={labelCls}>WABA ID</label>
          <input value={form.wabaId} onChange={set("wabaId")} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Phone Number ID <span className="text-red-500">*</span></label>
          <input value={form.phoneNumberId} onChange={set("phoneNumberId")} className={inputCls} />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Meta's ID for the number (Meta App Dashboard → WhatsApp → API Setup), not the phone number itself.
          </p>
        </div>
        <div>
          <label className={labelCls}>Display Number</label>
          <input value={form.displayNumber} onChange={set("displayNumber")} className={inputCls} placeholder="e.g. 919600034839" />
        </div>
        <div>
          <label className={labelCls}>Access Token {settings?.hasAccessToken !== "T" && <span className="text-red-500">*</span>}</label>
          <input type="password" value={form.accessToken} onChange={set("accessToken")} className={inputCls}
            autoComplete="off" placeholder={settings?.hasAccessToken === "T" ? "••••••••" : ""} />
          {settings?.hasAccessToken === "T" && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">An access token is already saved. Leave blank to keep it.</p>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-slate-800 pt-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Webhook</h3>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Callback URL</label>
              <div className="flex gap-2">
                <input readOnly value={webhookUrl} className={`${inputCls} bg-gray-50 dark:bg-slate-800`} />
                <button type="button" onClick={() => copy(webhookUrl)} title="Copy"
                  className="rounded-lg border border-gray-300 dark:border-slate-700 px-3 text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                This address is unique to your company. Meta needs a public HTTPS address — replace the host with your public domain or tunnel URL.
              </p>
            </div>
            <div>
              <label className={labelCls}>Webhook Verify Token <span className="text-red-500">*</span></label>
              <input value={form.verifyToken} onChange={set("verifyToken")} className={inputCls}
                placeholder="Any secret word — enter the same value in Meta" />
            </div>
            <div>
              <label className={labelCls}>App Secret (recommended)</label>
              <input type="password" value={form.appSecret} onChange={set("appSecret")} className={inputCls}
                autoComplete="off" placeholder={settings?.hasAppSecret === "T" ? "••••••••" : ""} />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {settings?.hasAppSecret === "T"
                  ? "An app secret is already saved. Leave blank to keep it."
                  : "Used to check that incoming messages really come from Meta."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save WhatsApp Settings"}
          </button>
          <button type="button" onClick={verify} disabled={verifying || settings?.hasAccessToken !== "T"}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50">
            {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Verify Connection
          </button>
        </div>
      </form>
    </div>
  );
}
