import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, ShieldCheck, User, Phone, Building2,
  CheckCircle2, RefreshCw, ArrowLeft, MessageCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AuthService } from "@/ServiceLayer/AuthService/AuthService";
import { apiError } from "@/lib/apiClient";

const TABS = [
  { key: "admin", label: "Admin" },
  { key: "staff", label: "Staff" },
  { key: "signup", label: "Sign Up" },
];

function makeCaptcha() {
  const a = 2 + Math.floor(Math.random() * 8);
  const b = 2 + Math.floor(Math.random() * 8);
  return { a, b, answer: a + b };
}

const field =
  "w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition";
const label = "block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5";
const primaryBtn =
  "w-full inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-60 transition";

function Field({ icon: Icon, ...props }) {
  return (
    <div className="relative">
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      <input className={field} {...props} />
    </div>
  );
}

function PasswordField({ value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      <input type={show ? "text" : "password"} required value={value} onChange={onChange}
        placeholder={placeholder} autoComplete={autoComplete} className={`${field} pr-10`} />
      <button type="button" onClick={() => setShow((v) => !v)} tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function CaptchaRow({ captcha, onRefresh, value, onChange }) {
  return (
    <div>
      <label className={label}>Security Check</label>
      <div className="flex gap-2">
        <div className="flex items-center gap-2 rounded-lg bg-gray-900 dark:bg-slate-800 px-4 text-sm font-bold text-white whitespace-nowrap">
          {captcha.a} + {captcha.b} = ?
          <button type="button" onClick={onRefresh} tabIndex={-1} className="text-gray-400 hover:text-white" title="New question">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
        <input type="number" required value={value} onChange={onChange} placeholder="Answer"
          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>
    </div>
  );
}

function ErrorBanner({ children }) {
  if (!children) return null;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
      {children}
    </div>
  );
}

function BrandPanel() {
  const features = [
    "One business WhatsApp number for the whole team",
    "Assign every customer to the right staff member",
    "Staff reply from the browser, full chat history kept",
    "Bot collects name and email automatically",
    "Separate, secure space for every company",
  ];
  return (
    <div className="hidden md:flex md:w-[380px] shrink-0 relative flex-col justify-center px-10 py-12 bg-gradient-to-br from-slate-900 via-green-950 to-slate-900 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_15%,rgba(34,197,94,0.25)_0%,transparent_55%),radial-gradient(ellipse_at_80%_85%,rgba(34,197,94,0.12)_0%,transparent_55%)]" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center shadow-lg shadow-green-900/40">
            <MessageCircle className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="text-white font-bold leading-tight">WhatsApp CRM</div>
            <div className="text-[10px] uppercase tracking-widest text-green-300/70">by iStreams</div>
          </div>
        </div>

        <h2 className="text-2xl font-extrabold text-white leading-snug mb-3">
          Every customer chat, <span className="text-green-400">handled by the right person.</span>
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Admins see the whole inbox and assign customers; staff reply to their own chats.
        </p>

        <ul className="space-y-2.5 mb-8">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
              <span className="h-4 w-4 shrink-0 rounded-full bg-green-500/20 border border-green-500/40 text-green-400 flex items-center justify-center">
                <CheckCircle2 className="h-3 w-3" />
              </span>
              {f}
            </li>
          ))}
        </ul>

        <p className="text-[11px] text-slate-500 pt-5 border-t border-white/10">© {new Date().getFullYear()} iStreams</p>
      </div>
    </div>
  );
}

function ForgotForm({ onBack }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true); setError("");
    try { await AuthService.forgotPassword(email.trim()); setSent(true); }
    catch (err) { setError(apiError(err, "Could not send the reset email.")); }
    finally { setBusy(false); }
  };

  if (sent) {
    return (
      <div className="text-center py-4">
        <Mail className="h-10 w-10 text-green-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">Check your inbox</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          If an account exists for <span className="font-semibold text-green-600">{email}</span>, a reset link has been sent.
        </p>
        <button onClick={onBack} className="text-sm font-semibold text-green-600 hover:underline">← Back to sign in</button>
      </div>
    );
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-gray-500 hover:text-green-600 dark:text-gray-400 mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
      </button>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">Reset Password</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Enter your registered email and we'll send a reset link.</p>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBanner>{error}</ErrorBanner>
        <Field icon={Mail} type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? "Sending…" : "Send Reset Link"}
        </button>
      </form>
    </div>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState(makeCaptcha);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const newCaptcha = () => { setCaptcha(makeCaptcha()); setCaptchaAnswer(""); };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (Number(captchaAnswer) !== captcha.answer) {
      setError("Incorrect answer to the security check.");
      newCaptcha();
      return;
    }
    setBusy(true); setError("");
    try {
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(apiError(err, "Invalid email or password."));
      newCaptcha();
    } finally { setBusy(false); }
  };

  if (showForgot) return <ForgotForm onBack={() => setShowForgot(false)} />;

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Welcome back 👋</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Sign in to your admin account</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBanner>{error}</ErrorBanner>
        <div>
          <label className={label}>Email Address</label>
          <Field icon={Mail} type="email" required autoComplete="email" placeholder="you@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className={label}>Password</label>
          <PasswordField value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password" autoComplete="current-password" />
        </div>
        <CaptchaRow captcha={captcha} onRefresh={newCaptcha} value={captchaAnswer} onChange={(e) => setCaptchaAnswer(e.target.value)} />
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? "Signing In…" : "Sign In"}
          {!busy && <ArrowRight className="h-4 w-4" />}
        </button>
        <button type="button" onClick={() => setShowForgot(true)} className="w-full text-center text-sm text-green-600 hover:underline">
          Forgot password?
        </button>
      </form>
    </div>
  );
}

function StaffForm() {
  const { staffLogin } = useAuth();
  const navigate = useNavigate();
  const [adminEmail, setAdminEmail] = useState("");
  const [mobileNo, setMobileNo] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState(makeCaptcha);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const newCaptcha = () => { setCaptcha(makeCaptcha()); setCaptchaAnswer(""); };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (Number(captchaAnswer) !== captcha.answer) {
      setError("Incorrect answer to the security check.");
      newCaptcha();
      return;
    }
    setBusy(true); setError("");
    try {
      await staffLogin(adminEmail.trim(), mobileNo.replace(/[^\d]/g, ""), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(apiError(err, "Invalid admin email, mobile number or password."));
      newCaptcha();
    } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Staff sign in</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Use your company admin's email and your own mobile number</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBanner>{error}</ErrorBanner>
        <div>
          <label className={label}>Admin Email</label>
          <Field icon={Building2} type="email" required autoComplete="off" placeholder="admin@yourcompany.com"
            value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
        </div>
        <div>
          <label className={label}>Your Mobile No</label>
          <Field icon={Phone} type="tel" required autoComplete="tel" placeholder="919876543210"
            value={mobileNo} onChange={(e) => setMobileNo(e.target.value)} />
        </div>
        <div>
          <label className={label}>Password</label>
          <PasswordField value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password" autoComplete="current-password" />
        </div>
        <CaptchaRow captcha={captcha} onRefresh={newCaptcha} value={captchaAnswer} onChange={(e) => setCaptchaAnswer(e.target.value)} />
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? "Signing In…" : "Staff Sign In"}
          {!busy && <ArrowRight className="h-4 w-4" />}
        </button>
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">Forgot your password? Ask your admin to reset it.</p>
      </form>
    </div>
  );
}

function SignupForm({ onDone }) {
  const [form, setForm] = useState({ companyName: "", fullName: "", email: "", mobileNo: "", password: "", confirm: "" });
  const [captcha, setCaptcha] = useState(makeCaptcha);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const newCaptcha = () => { setCaptcha(makeCaptcha()); setCaptchaAnswer(""); };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    if (Number(captchaAnswer) !== captcha.answer) {
      setError("Incorrect answer to the security check.");
      newCaptcha();
      return;
    }
    setBusy(true); setError("");
    try {
      await AuthService.signup({
        companyName: form.companyName.trim(),
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        mobileNo: form.mobileNo.replace(/[^\d]/g, "") || null,
        password: form.password,
      });
      setDone(true);
    } catch (err) {
      setError(apiError(err, "Could not create the account."));
      newCaptcha();
    } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="text-center py-4">
        <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">Registration received</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          <span className="font-semibold">{form.companyName}</span> is waiting for approval. You can sign in as soon as it is approved.
        </p>
        <button onClick={onDone} className="text-sm font-semibold text-green-600 hover:underline">← Back to sign in</button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Register your company</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">You will be the company admin</p>
      </div>
      <form onSubmit={submit} className="space-y-3.5">
        <ErrorBanner>{error}</ErrorBanner>
        <div>
          <label className={label}>Company Name</label>
          <Field icon={Building2} required maxLength={150} placeholder="Your business name" value={form.companyName} onChange={set("companyName")} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className={label}>Your Name</label>
            <Field icon={User} required maxLength={150} placeholder="Full name" value={form.fullName} onChange={set("fullName")} />
          </div>
          <div>
            <label className={label}>Mobile</label>
            <Field icon={Phone} maxLength={20} placeholder="919876543210" value={form.mobileNo} onChange={set("mobileNo")} />
          </div>
        </div>
        <div>
          <label className={label}>Email Address</label>
          <Field icon={Mail} type="email" required autoComplete="email" placeholder="you@example.com" value={form.email} onChange={set("email")} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className={label}>Password</label>
            <PasswordField value={form.password} onChange={set("password")} placeholder="Min 6 characters" autoComplete="new-password" />
          </div>
          <div>
            <label className={label}>Confirm Password</label>
            <PasswordField value={form.confirm} onChange={set("confirm")} placeholder="Re-enter" autoComplete="new-password" />
          </div>
        </div>
        <CaptchaRow captcha={captcha} onRefresh={newCaptcha} value={captchaAnswer} onChange={(e) => setCaptchaAnswer(e.target.value)} />
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? "Registering…" : "Register Company"}
        </button>
      </form>
    </div>
  );
}

function ResetPasswordForm({ token, onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true); setError("");
    try { await AuthService.resetPassword(token, password); setDone(true); }
    catch (err) { setError(apiError(err, "This reset link is invalid or has expired.")); }
    finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="text-center py-4">
        <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">Password updated</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">You can now sign in with your new password.</p>
        <button onClick={onDone} className="text-sm font-semibold text-green-600 hover:underline">← Back to sign in</button>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">Choose a new password</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Enter and confirm your new password.</p>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBanner>{error}</ErrorBanner>
        <div>
          <label className={label}>New Password</label>
          <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
        </div>
        <div>
          <label className={label}>Confirm Password</label>
          <PasswordField value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" autoComplete="new-password" />
        </div>
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? "Saving…" : "Reset Password"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const resetToken = searchParams.get("reset");
  const requested = searchParams.get("tab");
  const [tab, setTab] = useState(TABS.some((t) => t.key === requested) ? requested : "admin");

  return (
    <div className="relative min-h-full flex items-center justify-center bg-gray-100 dark:bg-slate-950 p-4 sm:p-6 overflow-hidden">
      <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-green-300/20 blur-3xl dark:bg-green-600/10" />
      <div className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-600/10" />

      <div className="relative w-full max-w-4xl flex flex-col md:flex-row rounded-2xl shadow-2xl overflow-hidden bg-white dark:bg-slate-900 border border-gray-200/50 dark:border-slate-800">
        <BrandPanel />

        <div className="flex-1 p-6 sm:p-10 overflow-y-auto">
          <div className="flex md:hidden items-center gap-2.5 mb-6 pb-5 border-b border-gray-200 dark:border-slate-800">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-gray-900 dark:text-white text-sm">WhatsApp CRM</div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400">by iStreams</div>
            </div>
          </div>

          {resetToken ? (
            <ResetPasswordForm token={resetToken} onDone={() => setSearchParams({})} />
          ) : (
            <>
              <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-slate-800 p-1 mb-6">
                {TABS.map((t) => (
                  <button key={t.key} type="button" onClick={() => setTab(t.key)}
                    className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                      tab === t.key
                        ? "bg-white dark:bg-slate-900 text-green-600 dark:text-green-400 shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              {tab === "admin" && <LoginForm />}
              {tab === "staff" && <StaffForm />}
              {tab === "signup" && <SignupForm onDone={() => setTab("admin")} />}
            </>
          )}

          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6 flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Secured with a math security check on every sign-in
          </p>
        </div>
      </div>
    </div>
  );
}
