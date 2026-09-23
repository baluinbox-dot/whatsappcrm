import { formatDate } from "@/lib/utils";

// The API stores UTC without a zone suffix; mark it as UTC so the browser shows local time.
export const toDate = (s) => (s ? new Date(/Z|[+-]\d\d:\d\d$/.test(s) ? s : `${s}Z`) : null);

export const hhmm = (d) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// Today -> "03:45 PM", otherwise "25-JUN-26".
export function shortTime(s) {
  const d = toDate(s);
  if (!d) return "";
  return d.toDateString() === new Date().toDateString() ? hhmm(d) : formatDate(d);
}

// "25-JUN-26 03:45 PM"
export function dateTime(s) {
  const d = toDate(s);
  return d ? `${formatDate(d)} ${hhmm(d)}` : "";
}

export const displayName = (c) => c?.customerName || c?.whatsappName || (c?.mobileNo ? `+${c.mobileNo}` : "");
