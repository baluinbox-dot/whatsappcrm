import { useEffect, useState } from "react";
import { NotebookPen, Plus, RefreshCw, Search, X, Pencil, Trash2, FileText } from "lucide-react";
import { NoteService } from "@/ServiceLayer/WhatsAppService/WhatsAppService";
import { toDate } from "@/lib/time";
import { Alerts, DeleteModal, inputCls, labelCls } from "@/components/common/ui";
import { formatDate } from "@/lib/utils";

const emptyForm = { title: "", content: "" };

// Lines starting with "# " render as section headings; everything else keeps its line breaks.
function NoteContent({ text }) {
  if (!text) return <p className="text-sm text-gray-400">This note is empty.</p>;
  const blocks = [];
  let buffer = [];
  const flush = () => {
    if (buffer.length) blocks.push({ type: "text", value: buffer.join("\n") });
    buffer = [];
  };
  text.split("\n").forEach((line) => {
    if (line.startsWith("# ")) { flush(); blocks.push({ type: "heading", value: line.slice(2) }); }
    else buffer.push(line);
  });
  flush();

  return (
    <div className="space-y-2">
      {blocks.map((b, i) =>
        b.type === "heading" ? (
          <h3 key={i} className="pt-3 text-base font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-slate-800 pb-1">
            {b.value}
          </h3>
        ) : (
          <pre key={i} className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {b.value.replace(/^\n+|\n+$/g, "")}
          </pre>
        )
      )}
    </div>
  );
}

export default function NotesPage() {
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const load = async (keepId) => {
    setLoading(true);
    try {
      const data = await NoteService.getAll(search || undefined);
      setRows(data);
      const want = keepId ?? selectedId;
      setSelectedId(data.some((n) => n.noteId === want) ? want : data[0]?.noteId ?? null);
    } catch { setError("Failed to load notes."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = rows.find((n) => n.noteId === selectedId);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openAdd = () => { setEditId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (n) => { setEditId(n.noteId); setForm({ title: n.title ?? "", content: n.content ?? "" }); setShowForm(true); };

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.title.trim()) { setError("Title is required."); return; }
    setSaving(true); setError("");
    const payload = { title: form.title.trim(), content: form.content };
    try {
      const saved = editId ? await NoteService.update(editId, payload) : await NoteService.create(payload);
      setSuccess(editId ? "Note updated." : "Note added.");
      setShowForm(false); setEditId(null); setForm(emptyForm);
      load(saved.noteId);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save note.");
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    try { await NoteService.remove(deleteTarget.noteId); setSuccess("Note deleted."); }
    catch { setError("Failed to delete note."); }
    finally { setDeleteTarget(null); load(); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600/10 p-2"><NotebookPen className="h-6 w-6 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notes</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Documents, guides and notes for the team</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load()} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium">
            <Plus className="h-4 w-4" /> Add Note
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search title or content..." className={`${inputCls} pl-9`} />
        </div>
        <button onClick={() => load()} className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">Apply</button>
      </div>

      <Alerts success={success} error={error} onClearSuccess={() => setSuccess("")} onClearError={() => setError("")} />

      {showForm && (
        <form onSubmit={submit} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editId ? "Edit Note" : "New Note"}</h2>
            <button type="button" onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Title *</label>
              <input value={form.title} onChange={set("title")} maxLength={200} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Content</label>
              <textarea value={form.content} onChange={set("content")} rows={16}
                className={`${inputCls} font-mono text-[13px] leading-relaxed`}
                placeholder={"# Heading\nWrite your note here. Start a line with \"# \" to make it a heading."} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-sm font-medium disabled:opacity-60">{saving ? "Saving..." : editId ? "Update" : "Save"}</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden self-start">
          <div className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">
            {rows.length} {rows.length === 1 ? "note" : "notes"}
          </div>
          {rows.length === 0 && !loading && (
            <p className="px-4 py-10 text-center text-sm text-gray-400">No notes found.</p>
          )}
          <ul className="max-h-[65vh] overflow-y-auto">
            {rows.map((n) => (
              <li key={n.noteId}>
                <button onClick={() => setSelectedId(n.noteId)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-slate-800 transition-colors ${
                    n.noteId === selectedId ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-slate-800/50"}`}>
                  <div className="flex items-start gap-2">
                    <FileText className={`h-4 w-4 mt-0.5 shrink-0 ${n.noteId === selectedId ? "text-blue-600" : "text-gray-400"}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">{n.title}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Updated {formatDate(toDate(n.updatedAt))}</div>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-6 min-w-0">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selected.title}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Created {formatDate(toDate(selected.createdAt))}{selected.createdByName ? ` by ${selected.createdByName}` : ""}
                    {" · "}Updated {formatDate(toDate(selected.updatedAt))}{selected.updatedByName ? ` by ${selected.updatedByName}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(selected)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-blue-600" title="Edit"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setDeleteTarget(selected)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <NoteContent text={selected.content} />
            </>
          ) : (
            <p className="py-10 text-center text-sm text-gray-400">Select a note to read it.</p>
          )}
        </div>
      </div>

      <DeleteModal open={!!deleteTarget} name={deleteTarget?.title}
        onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
    </div>
  );
}
