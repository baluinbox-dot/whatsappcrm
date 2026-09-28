import { useRef, useState } from "react";
import { ImagePlus, Star, Trash2, FileText, Upload, Loader2 } from "lucide-react";
import { PropertyService } from "@/ServiceLayer/PropertyService/PropertyService";
import { apiError } from "@/lib/apiClient";
import { fileUrl } from "@/lib/realEstate";

const KINDS = {
  IMAGE: { title: "Photos", accept: ".jpg,.jpeg,.png,.webp", hint: "JPG, PNG or WEBP, up to 10 MB each. The starred photo is the cover." },
  FLOORPLAN: { title: "Floor Plans", accept: ".jpg,.jpeg,.png,.webp,.pdf", hint: "Image or PDF." },
  BROCHURE: { title: "Brochure", accept: ".pdf", hint: "PDF, up to 20 MB." },
};

const sizeLabel = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const isImage = (f) => f.contentType.startsWith("image/");

function UploadButton({ kind, busy, onFiles }) {
  const ref = useRef(null);
  return (
    <>
      <input ref={ref} type="file" multiple={kind !== "BROCHURE"} accept={KINDS[kind].accept} className="hidden"
        onChange={(e) => { const files = [...e.target.files]; e.target.value = ""; if (files.length) onFiles(files); }} />
      <button type="button" disabled={busy} onClick={() => ref.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : kind === "IMAGE" ? <ImagePlus className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
        {busy ? "Uploading..." : "Upload"}
      </button>
    </>
  );
}

export default function PropertyMedia({ property, onChanged, onError }) {
  const [busyKind, setBusyKind] = useState("");

  const upload = async (kind, files) => {
    setBusyKind(kind);
    try { await PropertyService.upload(property.propertyId, kind, files); await onChanged(); }
    catch (err) { onError(apiError(err, "Upload failed.")); }
    finally { setBusyKind(""); }
  };

  const act = async (fn, fallback) => {
    try { await fn(); await onChanged(); }
    catch (err) { onError(apiError(err, fallback)); }
  };

  const files = (kind) => property.files.filter((f) => f.fileKind === kind);
  const images = files("IMAGE");

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{KINDS.IMAGE.title} ({images.length})</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">{KINDS.IMAGE.hint}</p>
          </div>
          <UploadButton kind="IMAGE" busy={busyKind === "IMAGE"} onFiles={(f) => upload("IMAGE", f)} />
        </div>
        {images.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 dark:border-slate-700 py-6 text-center text-xs text-gray-400">No photos yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {images.map((f) => (
              <div key={f.fileId} className={`group relative overflow-hidden rounded-lg border-2 ${f.isCover === "T" ? "border-amber-400" : "border-transparent"}`}>
                <a href={fileUrl(f.propertyId, f.storedName)} target="_blank" rel="noreferrer">
                  <img src={fileUrl(f.propertyId, f.storedName)} alt={f.fileName} className="h-28 w-full object-cover" />
                </a>
                {f.isCover === "T" && (
                  <span className="absolute left-1.5 top-1.5 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-white">Cover</span>
                )}
                <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {f.isCover !== "T" && (
                    <button type="button" title="Make cover" onClick={() => act(() => PropertyService.setCover(f.fileId), "Failed to set cover.")}
                      className="rounded bg-white/90 p-1 text-gray-700 hover:text-amber-500"><Star className="h-3.5 w-3.5" /></button>
                  )}
                  <button type="button" title="Delete" onClick={() => act(() => PropertyService.removeFile(f.fileId), "Failed to delete file.")}
                    className="rounded bg-white/90 p-1 text-gray-700 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {["FLOORPLAN", "BROCHURE"].map((kind) => (
          <div key={kind}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{KINDS[kind].title}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">{KINDS[kind].hint}</p>
              </div>
              <UploadButton kind={kind} busy={busyKind === kind} onFiles={(f) => upload(kind, f)} />
            </div>
            {files(kind).length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 dark:border-slate-700 py-4 text-center text-xs text-gray-400">None uploaded.</p>
            ) : (
              <ul className="space-y-1.5">
                {files(kind).map((f) => (
                  <li key={f.fileId} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-2">
                    {isImage(f)
                      ? <img src={fileUrl(f.propertyId, f.storedName)} alt="" className="h-8 w-8 rounded object-cover" />
                      : <FileText className="h-5 w-5 text-red-500" />}
                    <a href={fileUrl(f.propertyId, f.storedName)} target="_blank" rel="noreferrer"
                      className="flex-1 truncate text-sm text-blue-600 hover:underline">{f.fileName}</a>
                    <span className="text-xs text-gray-400">{sizeLabel(f.sizeBytes)}</span>
                    <button type="button" title="Delete" onClick={() => act(() => PropertyService.removeFile(f.fileId), "Failed to delete file.")}
                      className="rounded p-1 text-gray-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
