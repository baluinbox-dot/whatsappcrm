import { X, AlertTriangle, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export const inputCls =
  "w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500";
export const labelCls = "block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1";

export function Breadcrumb({ items }) {
  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-4 w-4" />}
          {it.to ? (
            <Link to={it.to} className="hover:text-blue-600 hover:underline">{it.label}</Link>
          ) : (
            <span className="text-gray-900 dark:text-white font-medium">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function StatusBadge({ label, colorMap }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: colorMap?.[label] || "#64748b" }}
    >
      {label}
    </span>
  );
}

export function Alerts({ success, error, onClearSuccess, onClearError }) {
  return (
    <>
      {success && (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 px-4 py-2 text-sm text-green-700 dark:text-green-300">
          <span>{success}</span>
          <button onClick={onClearSuccess}><X className="h-4 w-4" /></button>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-2 text-sm text-red-700 dark:text-red-300">
          <span>{error}</span>
          <button onClick={onClearError}><X className="h-4 w-4" /></button>
        </div>
      )}
    </>
  );
}

export function DeleteModal({ open, name, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-lg p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Confirm Delete</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Delete <span className="font-medium text-gray-900 dark:text-white">{name}</span>? This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="rounded-lg border border-gray-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">
            Cancel
          </button>
          <button onClick={onConfirm} className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-5 py-2 text-sm font-medium">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
