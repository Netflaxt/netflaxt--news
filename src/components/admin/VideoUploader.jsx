/* ─────────────────────────────────────────────────────────────
   src/components/admin/VideoUploader.jsx
   Componente per il form admin: carica video su Cloudinary OPPURE
   incolla un URL YouTube/Vimeo. Output: oggetto `video` da salvare
   nel doc articolo, o null se l'admin lo rimuove.
   ───────────────────────────────────────────────────────────── */
import React, { useRef, useState } from "react";
import {
  uploadVideoToCloudinary,
  normalizeVideoFromUrl,
  formatDuration,
  MAX_VIDEO_MB,
} from "../../utils/videoUpload";

export default function VideoUploader({ value, onChange }) {
  const [mode, setMode] = useState(value?.type === "youtube" || value?.type === "vimeo" ? "embed" : "upload");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [urlInput, setUrlInput] = useState(
    value?.type === "youtube" || value?.type === "vimeo" ? value.url : ""
  );
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadVideoToCloudinary(file, setProgress);
      onChange(result);
    } catch (err) {
      setError(err.message || "Errore upload video");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleUrlConfirm = () => {
    setError("");
    const normalized = normalizeVideoFromUrl(urlInput);
    if (!normalized) {
      setError("URL non riconosciuto. Usa YouTube, Vimeo o un link diretto a un file mp4/webm.");
      return;
    }
    onChange(normalized);
  };

  const handleRemove = () => {
    onChange(null);
    setUrlInput("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* Preview se c'è già un video */
  if (value?.url) {
    return (
      <div className="space-y-3">
        <div className="relative rounded-lg overflow-hidden border border-border bg-bg-elevated aspect-video">
          <VideoPreview video={value} />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition text-sm font-bold"
            title="Rimuovi video"
          >
            ✕
          </button>
          {value.type && (
            <span className="absolute top-2 left-2 px-2 py-1 bg-bg-base/80 backdrop-blur text-text-primary text-[10px] font-bold uppercase tracking-widest rounded">
              {value.type === "youtube" && "▶ YouTube"}
              {value.type === "vimeo" && "▶ Vimeo"}
              {value.type === "cloudinary" && "▶ Caricato"}
              {value.duration && ` · ${formatDuration(value.duration)}`}
            </span>
          )}
        </div>
        <div className="text-xs text-text-muted truncate">
          <span className="font-bold text-text-secondary">URL:</span> {value.url}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toggle modalità */}
      <div className="inline-flex rounded-lg border border-border bg-bg-elevated p-1">
        <ModeBtn active={mode === "upload"} onClick={() => setMode("upload")}>
          Carica file
        </ModeBtn>
        <ModeBtn active={mode === "embed"} onClick={() => setMode("embed")}>
          Link YouTube / Vimeo
        </ModeBtn>
      </div>

      {/* MODE: Upload file su Cloudinary */}
      {mode === "upload" && (
        <>
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 ${
              uploading
                ? "border-accent/60 bg-accent/5 cursor-wait"
                : "border-border hover:border-accent/50 hover:bg-accent/5"
            }`}
          >
            {uploading ? (
              <>
                <div className="w-full max-w-sm">
                  <div className="h-2 bg-bg-base rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-accent font-semibold text-center tabular-nums">
                    Upload {progress}% — il video viene ottimizzato in automatico
                  </div>
                </div>
              </>
            ) : (
              <>
                <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <div className="text-center">
                  <span className="text-sm font-semibold text-text-primary">
                    Carica un video
                  </span>
                  <p className="text-xs text-text-muted mt-1">
                    MP4 / WebM / MOV — max {MAX_VIDEO_MB} MB
                  </p>
                  <p className="text-[10px] text-text-muted mt-1">
                    Per video più lunghi (es. partite): usa "Link YouTube"
                  </p>
                </div>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </div>
        </>
      )}

      {/* MODE: Incolla URL YouTube/Vimeo */}
      {mode === "embed" && (
        <div className="space-y-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=... oppure https://vimeo.com/..."
            className="adminInput"
          />
          <button
            type="button"
            onClick={handleUrlConfirm}
            disabled={!urlInput.trim()}
            className="px-4 py-2 bg-accent text-text-inverse font-bold rounded-md text-sm hover:shadow-[0_0_18px_-4px_rgba(56,189,248,0.6)] transition disabled:opacity-50"
          >
            Aggiungi video →
          </button>
          <p className="text-[11px] text-text-muted">
            ✓ YouTube · ✓ Vimeo · ✓ Link diretto a file .mp4/.webm
          </p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-error/10 border border-error/30 rounded-md text-error text-xs">
          {error}
        </div>
      )}
    </div>
  );
}

function ModeBtn({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition ${
        active
          ? "bg-accent text-text-inverse shadow-[0_0_18px_-4px_rgba(56,189,248,0.5)]"
          : "text-text-secondary hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function VideoPreview({ video }) {
  if (video.type === "youtube" || video.type === "vimeo") {
    return (
      <iframe
        src={video.embedUrl}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Video preview"
      />
    );
  }
  return (
    <video
      src={video.url}
      controls
      preload="metadata"
      poster={video.thumbnail || undefined}
      className="w-full h-full object-contain bg-black"
    />
  );
}
