const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// The API sends dates as "2026-06-01T00:00:00" (no zone). Pull the calendar
// date straight from that text so a client timezone never shifts the day.
function dateParts(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return { y: +m[1], mo: +m[2], d: +m[3] };
  }
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return { y: dt.getFullYear(), mo: dt.getMonth() + 1, d: dt.getDate() };
}

// -> "25-JUN-26"
export function formatDate(value) {
  const p = dateParts(value);
  if (!p) return "";
  return `${String(p.d).padStart(2, "0")}-${MONTHS[p.mo - 1]}-${String(p.y).slice(-2)}`;
}

// -> "yyyy-mm-dd" for <input type="date">
export function toInputDate(value) {
  const p = dateParts(value);
  if (!p) return "";
  return `${p.y}-${String(p.mo).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}
